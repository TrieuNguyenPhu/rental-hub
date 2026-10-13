import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { request } from 'node:http'
import { once } from 'node:events'
import sharp from 'sharp'
import { startMediaServer } from './main.ts'
import type { MediaConfig } from './main.ts'

const origin = 'http://127.0.0.1:5173'
const endpoint = '/api/images?entityType=room&entityId=room-1'
const jpeg = () => sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#aaa' } }).jpeg().toBuffer()

async function fixture(t: TestContext, readOnly = false, prepare?: (config: MediaConfig) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'rental-api-test-'))
  const config: MediaConfig = { host: '127.0.0.1', port: 0, imagesRoot: path.join(root, 'images'), tempRoot: path.join(root, 'tmp'), siteOrigin: origin, releaseId: 'test-release', readOnly }
  await fs.mkdir(config.imagesRoot); await fs.mkdir(config.tempRoot)
  await prepare?.(config)
  const server = await startMediaServer(config)
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  assert.equal(address.address, '127.0.0.1')
  const url = `http://127.0.0.1:${address.port}`
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }) })
  return { server, url, config }
}
const upload = (url: string, input: Buffer, headers: Record<string, string> = {}, route = endpoint) => fetch(url + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/jpeg', ...headers }, body: new Uint8Array(input) })

function streaming(url: string, headers: Record<string, string> = {}) {
  const req = request(url + endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/jpeg', ...headers } })
  const response = new Promise<{ status: number; body: string }>((resolve, reject) => {
    req.on('error', reject)
    req.on('response', res => {
      const chunks: Buffer[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }))
      res.on('error', reject)
    })
  })
  return { req, response }
}

test('api.acceptsValidImage, health and JSON 404', async t => {
  const { url, config } = await fixture(t)
  const health = await fetch(url + '/api/health')
  assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: 'ok', releaseId: 'test-release' })
  const result = await upload(url, await jpeg())
  assert.equal(result.status, 201)
  const asset = await result.json()
  assert.equal(asset.width600, 600); assert.equal(asset.width1200, 1200)
  assert.ok((await fs.stat(path.join(config.imagesRoot, asset.url1200.slice(8)))).isFile())
  assert.equal((await fetch(url + '/missing')).status, 404)
  await fs.rename(config.imagesRoot, config.imagesRoot + '-offline')
  assert.equal((await fetch(url + '/api/health')).status, 503)
})

test('api.boundsAndOrigin rejects untrusted input without paths or CORS wildcard', async t => {
  const { url } = await fixture(t)
  for (const headers of [{ Origin: '' }, { Origin: 'https://evil.example' }]) assert.equal((await upload(url, Buffer.from('x'), headers)).status, 403)
  for (const query of ['entityType=other&entityId=r1', 'entityType=room&entityId=..%2Fx', 'entityType=room&entityId=a%2Fb', 'entityType=room&entityId=' + 'a'.repeat(65)]) assert.equal((await upload(url, Buffer.from('x'), {}, '/api/images?' + query)).status, 400)
  assert.equal((await upload(url, Buffer.from('<svg/>'), { 'Content-Type': 'image/svg+xml' })).status, 415)
  const invalid = await upload(url, Buffer.from('fake'))
  assert.equal(invalid.status, 422)
  const error = await invalid.json()
  assert.equal(typeof error.code, 'string'); assert.doesNotMatch(JSON.stringify(error), /rental-api-test|stack|Authorization/)
  assert.equal(invalid.headers.get('access-control-allow-origin'), null)
  const length = streaming(url, { 'Content-Length': String(10 * 1024 * 1024 + 1) })
  length.req.flushHeaders()
  assert.equal((await length.response).status, 413)
  const chunked = streaming(url)
  chunked.req.end(Buffer.alloc(10 * 1024 * 1024 + 1))
  assert.equal((await chunked.response).status, 413)
})

test('api.serializes uploads, releases busy after failure, maps ENOSPC to 507', async t => {
  const { url, server } = await fixture(t)
  const pending = once(server, 'request')
  const first = streaming(url)
  first.req.flushHeaders(); await pending
  assert.equal((await upload(url, await jpeg())).status, 429)
  first.req.end(await jpeg())
  assert.equal((await first.response).status, 201)
  assert.equal((await upload(url, Buffer.from('fake'))).status, 422)
  const write = fs.writeFile
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).endsWith('_1200.webp')) throw Object.assign(new Error('private path'), { code: 'ENOSPC' })
    return write(...args)
  })
  const full = await upload(url, await jpeg())
  assert.equal(full.status, 507); assert.doesNotMatch(await full.text(), /private path/)
  t.mock.restoreAll()
  assert.equal((await upload(url, await jpeg())).status, 201)
})

test('api holds the busy slot while encoding and publishing', async t => {
  const { url } = await fixture(t)
  const write = fs.writeFile
  let release!: () => void, entered!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const writing = new Promise<void>(resolve => { entered = resolve })
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).endsWith('_600.webp')) { entered(); await gate }
    return write(...args)
  })
  const first = upload(url, await jpeg())
  await writing
  try { assert.equal((await upload(url, await jpeg())).status, 429) } finally { release() }
  assert.equal((await first).status, 201)
})

test('api readOnly keeps temp data and refuses POST', async t => {
  const { url, config } = await fixture(t, true, async config => {
    await fs.mkdir(path.join(config.tempRoot, 'upload-ABC123'))
    await fs.writeFile(path.join(config.tempRoot, 'upload-ABC123', '.owner'), 'rental-hub-image-upload')
  })
  assert.equal((await upload(url, await jpeg())).status, 503)
  assert.ok((await fs.stat(path.join(config.tempRoot, 'upload-ABC123'))).isDirectory())
  assert.deepEqual(await fs.readdir(config.imagesRoot), [])
})

test('api startup cleans only owned stale upload directories after obtaining its lock', async t => {
  const { config } = await fixture(t, false, async config => {
    for (const name of ['upload-ABC123', 'upload-DEF456', 'unrelated']) await fs.mkdir(path.join(config.tempRoot, name))
    await fs.writeFile(path.join(config.tempRoot, 'upload-ABC123', '.owner'), 'rental-hub-image-upload')
  })
  assert.deepEqual((await fs.readdir(config.tempRoot)).sort(), ['.media.lock', 'unrelated', 'upload-DEF456'])
})

test('api health reports unavailable writes and startup rejects different filesystems', async t => {
  const { config, url } = await fixture(t)
  const stat = fs.stat
  t.mock.method(fs, 'stat', async (...args: Parameters<typeof fs.stat>) => {
    const result = await stat(...args)
    if (path.basename(String(args[0])) === 'images') return Object.assign(result, { dev: -1 })
    return result
  })
  await assert.rejects(startMediaServer({ ...config, readOnly: true }), /filesystem/)
  t.mock.restoreAll()
  t.mock.method(fs, 'writeFile', async () => { throw Object.assign(new Error('permissions'), { code: 'EACCES' }) })
  assert.equal((await fetch(url + '/api/health')).status, 503)
})

test('api body deadline closes an incomplete request after 30 seconds', async t => {
  const { url, server } = await fixture(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = once(server, 'request')
  const incomplete = streaming(url)
  incomplete.req.flushHeaders(); await pending
  t.mock.timers.tick(30_001)
  assert.equal((await incomplete.response).status, 408)
  t.mock.timers.reset()
  assert.equal((await upload(url, await jpeg())).status, 201)
})

test('api development images are confined to imagesRoot; production has no static handler', async t => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous })
  const { url, config } = await fixture(t)
  const result = await (await upload(url, await jpeg())).json()
  const response = await fetch(url + result.url600)
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width, 600)
  for (const route of ['/images/%2e%2e%2fsecret.webp', '/images/missing.webp']) assert.equal((await fetch(url + route)).status, 404)
  await fs.writeFile(path.join(config.imagesRoot, 'secret.txt'), 'private')
  assert.equal((await fetch(url + '/images/secret.txt')).status, 404)
  process.env.NODE_ENV = 'production'
  const production = await fixture(t)
  assert.equal((await fetch(production.url + result.url600)).status, 404)
})

test('api config fails before listening and writable instances cannot share tempRoot', async t => {
  const { config } = await fixture(t)
  await assert.rejects(startMediaServer(config), /already running/)
  await assert.rejects(startMediaServer({ ...config, imagesRoot: 'relative' }), /absolute/)
  await assert.rejects(startMediaServer({ ...config, siteOrigin: '*' }), /origin/)
  await assert.rejects(startMediaServer({ ...config, imagesRoot: config.tempRoot }), /separate/)
})
