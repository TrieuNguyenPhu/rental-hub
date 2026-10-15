import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(import.meta.dirname, '../..')
const output = path.join(root, '.local/build/aws-media')
await fs.rm(output, { recursive: true, force: true })
await fs.mkdir(output, { recursive: true })
await build({
  entryPoints: [path.join(root, 'apps/aws-media/src/handler.ts')],
  outfile: path.join(output, 'index.mjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'esm', external: ['sharp'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
})
const modules = path.join(root, 'node_modules')
for (const name of ['sharp', 'detect-libc', 'semver', '@img/colour']) {
  await fs.cp(path.join(modules, name), path.join(output, 'node_modules', name), { recursive: true })
}
const imagePackages = (await fs.readdir(path.join(modules, '@img')))
  .filter(name => name === `sharp-${process.platform}-${process.arch}` || name === `sharp-libvips-${process.platform}-${process.arch}`)
if (imagePackages.length !== (process.platform === 'linux' ? 2 : 1)) throw new Error('Sharp native package is unavailable for this build host')
for (const name of imagePackages) {
  await fs.cp(path.join(modules, '@img', name), path.join(output, 'node_modules/@img', name), { recursive: true })
}
await import(pathToFileURL(path.join(output, 'index.mjs')).href)
console.info(`AWS media package ready for ${process.platform}/${process.arch}`)
