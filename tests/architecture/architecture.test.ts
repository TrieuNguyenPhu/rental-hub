import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'

function files(directory: string): string[] {
  if (!fs.statSync(directory).isDirectory()) return [directory]
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? files(file) : [file]
  })
}

test('business rules stay independent and UI never imports concrete services', () => {
  const ui = ['apps/web/src/components', 'apps/web/src/pages', 'apps/web/src/utils', 'apps/web/src/App.tsx', 'apps/web/src/AppContext.ts', 'apps/web/src/store.ts']
  const roots = ['apps/web/src/main.tsx', 'apps/media/src/main.ts']
  const allowed: Record<string, string[]> = {
    'packages/domain': ['packages/domain'],
    'apps/web/src/domain': ['packages/domain', 'apps/web/src/domain'],
    'apps/web/src/services': ['packages/domain', 'apps/web/src/domain', 'apps/web/src/services'],
    ...Object.fromEntries(ui.map(directory => [directory, ['packages/domain', 'apps/web/src/domain', ...ui]])),
    'apps/web/src/main.tsx': ['packages/domain', 'apps/web/src'],
    'apps/media/src/media.ts': ['packages/domain'],
    'apps/media/src/mediaServer.ts': ['packages/domain', 'apps/media/src'],
    'apps/media/src/mediaStorage.ts': ['packages/domain', 'apps/media/src'],
    'apps/media/src/images.ts': ['packages/domain', 'apps/media/src'],
    'apps/media/src/main.ts': ['packages/domain', 'apps/media/src'],
  }
  for (const [layer, dependencies] of Object.entries(allowed)) {
    for (const file of files(layer).filter(file => /\.tsx?$/.test(file))) {
      const source = fs.readFileSync(file, 'utf8')
      if (!roots.includes(file)) assert.doesNotMatch(source, /\b(?:import\.meta|process)\.env\b/, `${file} reads environment outside a composition root`)
      for (const { fileName } of ts.preProcessFile(source, true, true).importedFiles) {
        if (!fileName.startsWith('.')) {
          assert.ok(!layer.endsWith('/domain') && layer !== 'apps/media/src/media.ts', `${file} imports ${fileName}`)
          continue
        }
        const target = path.resolve(path.dirname(file), fileName).replace(/\.tsx?$/, '')
        assert.ok(dependencies.some(dependency => {
          const allowedPath = path.resolve(dependency).replace(/\.tsx?$/, '')
          return target === allowedPath || target.startsWith(allowedPath + path.sep)
        }), `${file} imports ${fileName}`)
      }
    }
  }
})

test('every AWS module resource has a unique migration from its original root address', () => {
  const resources = files('infra/aws/modules').filter(file => file.endsWith('.tf')).flatMap(file => {
    const module = path.basename(path.dirname(file))
    return [...fs.readFileSync(file, 'utf8').matchAll(/^resource "([^"]+)" "([^"]+)"/gm)]
      .map(match => ({ from: `${match[1]}.${match[2]}`, to: `module.${module}.${match[1]}.${match[2]}` }))
  })
  const moves = [...fs.readFileSync('infra/aws/moved.tf', 'utf8').matchAll(/moved\s*\{\s*from\s*=\s*(\S+)\s*to\s*=\s*(\S+)\s*\}/g)]
    .map(match => ({ from: match[1], to: match[2] }))
  const sort = (values: typeof moves) => values.sort((a, b) => a.from.localeCompare(b.from))
  assert.equal(new Set(moves.map(move => move.from)).size, moves.length)
  assert.equal(new Set(moves.map(move => move.to)).size, moves.length)
  assert.deepEqual(sort(moves), sort(resources))
})
