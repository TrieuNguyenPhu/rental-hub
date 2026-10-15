import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { processImage } from '../../apps/media/src/images.ts'

async function roots(t: TestContext) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'rental-images-test-'))
  const images = path.join(root, 'images'), temp = path.join(root, 'tmp')
  await fs.mkdir(images); await fs.mkdir(temp)
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return { images, temp }
}
const source = (width = 1600, height = 1000) => sharp({ create: { width, height, channels: 3, background: '#8c9fab' } }).jpeg().toBuffer()
const target = { entityType: 'building', entityId: 'building-1' } as const

test('images remain publicly readable under the service umask', { skip: process.platform === 'win32' }, async t => {
  const { images, temp } = await roots(t)
  const unit = await fs.readFile(new URL('../../ops/deploy/systemd/rental-hub-media.service', import.meta.url), 'utf8')
  const mask = unit.match(/^UMask=(\d+)$/m)
  assert.ok(mask)
  const previous = process.umask(Number.parseInt(mask[1], 8))
  try {
    const result = await processImage(await source(), 'image/jpeg', target, images, temp)
    for (const url of [result.url600, result.url1200]) {
      assert.equal((await fs.stat(path.join(images, url.slice(8)))).mode & 0o777, 0o644)
    }
  } finally { process.umask(previous) }
})

test('images.producesPairedWebp', async t => {
  const { images, temp } = await roots(t)
  const result = await processImage(await source(), 'image/jpeg', target, images, temp)
  assert.match(result.url600, new RegExp(`/building-image/building-1/${result.id}/\\d+-[a-z0-9-]+_600\\.webp$`))
  assert.equal(result.url1200, result.url600.replace('_600', '_1200'))
  for (const [url, width, height, bytes] of [[result.url600, 600, 375, result.bytes600], [result.url1200, 1200, 750, result.bytes1200]] as const) {
    const file = path.join(images, url.slice('/images/'.length))
    const metadata = await sharp(await fs.readFile(file)).metadata()
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, width); assert.equal(metadata.height, height)
    assert.equal((await fs.stat(file)).size, bytes)
  }
  assert.equal(result.height600, 375); assert.equal(result.height1200, 750)
  assert.deepEqual(await fs.readdir(temp), [])
})

test('images.rejectsFakeAndUnsupported and MIME mismatch', async t => {
  const { images, temp } = await roots(t)
  for (const [buffer, mime, status] of [[Buffer.alloc(0), 'image/jpeg', 422], [Buffer.from('fake jpeg'), 'image/jpeg', 422], [Buffer.from('<svg/>'), 'image/svg+xml', 415], [Buffer.from('GIF89a'), 'image/gif', 415], [await source(), 'image/png', 415]] as const) {
    await assert.rejects(processImage(buffer, mime, target, images, temp), { status })
  }
  assert.deepEqual(await fs.readdir(images), [])
})

test('images rejects APNG even when the decoder reports no frame count', async t => {
  const { images, temp } = await roots(t)
  // Two distinct 1600x10 frames with valid PNG/APNG chunks and CRCs.
  const animated = Buffer.from('iVBORw0KGgoAAAANSUhEUgAABkAAAAAKCAIAAABjfQXAAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAZAAAAACgAAAAAAAAAAAAEACgAAmkJniwAAAGFJREFUeJztzjENwEAQBLHjT/rDYNtJYckAfO8OAAAAAH6rHwAAAADA0A8AAAAAYOgHAAAAADD0AwAAAAAY+gEAAAAADP0AAAAAAIZ+AAAAAABDPwAAAACAoR8AAAAAwPABCdFFI7DgfpAAAAAaZmNUTAAAAAEAAAZAAAAACgAAAAAAAAAAAAEACgAAATGNXwAAAGVmZEFUAAAAAnic7c5BDYAAEASx828aFLDf4dGkAnp3DwAAAAD8WD8AAAAAgKEfAAAAAMDQDwAAAABg6AcAAAAAMPQDAAAAABj6AQAAAAAM/QAAAAAAhn4AAAAAAEM/AAAAAIBPL39+RSNSbI8oAAAAAElFTkSuQmCC', 'base64')
  await assert.rejects(processImage(animated, 'image/png', target, images, temp), { status: 422, code: 'IMAGE_LIMIT' })
  assert.deepEqual(await fs.readdir(images), [])
})

test('images explains when the required output exceeds the WebP height limit', async t => {
  const { images, temp } = await roots(t)
  const tall = await sharp({ create: { width: 1200, height: 16666, channels: 3, background: '#aaa' } }).png().toBuffer()
  await assert.rejects(processImage(tall, 'image/png', target, images, temp), { status: 422, code: 'IMAGE_LIMIT' })
  assert.deepEqual(await fs.readdir(images), [])
})

test('images.rejectsLimits and multiple frames', async t => {
  const { images, temp } = await roots(t)
  const frames = Buffer.concat([Buffer.alloc(1600 * 1000 * 3, 100), Buffer.alloc(1600 * 1000 * 3, 200)])
  const animated = await sharp(frames, { raw: { width: 1600, height: 2000, channels: 3, pageHeight: 1000 } }).webp({ delay: [100, 100], loop: 0 }).toBuffer()
  assert.equal((await sharp(animated).metadata()).pages, 2)
  for (const [buffer, mime, status] of [[Buffer.alloc(10 * 1024 * 1024 + 1), 'image/jpeg', 413], [await source(1199), 'image/jpeg', 422], [await source(6000, 3500), 'image/jpeg', 422], [animated, 'image/webp', 422]] as const) {
    await assert.rejects(processImage(buffer, mime, target, images, temp), { status })
  }
  assert.deepEqual(await fs.readdir(images), [])
})

test('images.orientsAndStripsMetadata', async t => {
  const { images, temp } = await roots(t)
  const input = await sharp(await source(1000, 1600)).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  const result = await processImage(input, 'image/jpeg', target, images, temp)
  const metadata = await sharp(await fs.readFile(path.join(images, result.url1200.slice(8)))).metadata()
  assert.equal(metadata.width, 1200); assert.equal(metadata.height, 750)
  assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined); assert.equal(metadata.orientation, undefined)
})

test('images.secondWriteFailurePublishesNothing', async t => {
  const { images, temp } = await roots(t)
  const write = fs.writeFile
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).endsWith('_1200.webp')) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    return write(...args)
  })
  await assert.rejects(processImage(await source(), 'image/jpeg', target, images, temp), { code: 'ENOSPC' })
  // Empty entity parents may exist, but no final imageId directory may be published.
  const published = await fs.readdir(images, { recursive: true })
  assert.equal(published.some(file => String(file).endsWith('.webp')), false)
  assert.deepEqual(await fs.readdir(temp), [])
})
