import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { handler } from '../../apps/aws-media/src/handler.ts'

const event = (body: Buffer) => ({
  requestContext: { http: { method: 'POST' } }, rawPath: '/api/images',
  queryStringParameters: { entityType: 'building', entityId: 'building-1' },
  headers: { 'content-type': 'image/jpeg' }, body: body.toString('base64'), isBase64Encoded: true,
})

test('AWS upload publishes two validated WebP sizes to S3', async () => {
  process.env.IMAGE_BUCKET = 'fixture'
  process.env.DATA_BUCKET = 'data-fixture'
  const writes: PutObjectCommand[] = []
  const send = mock.method(S3Client.prototype, 'send', async (command: unknown) => {
    if (command instanceof GetObjectCommand) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
    assert.ok(command instanceof PutObjectCommand)
    writes.push(command)
    return {}
  })
  try {
    const image = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#738a94' } }).jpeg().toBuffer()
    const result = await handler(event(image))
    assert.equal(result.statusCode, 201)
    const asset = JSON.parse(result.body)
    assert.match(asset.url600, /^\/images\/building-image\/building-1\/.+_600\.webp$/)
    assert.equal(asset.url1200, asset.url600.replace('_600.webp', '_1200.webp'))
    assert.deepEqual(await Promise.all(writes.map(async item => (await sharp(item.input.Body as Buffer).metadata()).width)), [600, 1200])
    assert.ok(writes.every(item => item.input.Bucket === 'fixture' && item.input.ContentType === 'image/webp'))
  } finally { send.mock.restore(); delete process.env.IMAGE_BUCKET; delete process.env.DATA_BUCKET }
})

test('AWS upload rejects oversized input before S3 writes', async () => {
  process.env.IMAGE_BUCKET = 'fixture'
  process.env.DATA_BUCKET = 'data-fixture'
  const send = mock.method(S3Client.prototype, 'send', async () => { throw new Error('unexpected S3 call') })
  try {
    const result = await handler(event(Buffer.alloc(4 * 1024 * 1024 + 1)))
    assert.equal(result.statusCode, 413)
    assert.equal(send.mock.callCount(), 0)
  } finally { send.mock.restore(); delete process.env.IMAGE_BUCKET; delete process.env.DATA_BUCKET }
})

test('AWS upload removes the first WebP if the second S3 write fails', async () => {
  process.env.IMAGE_BUCKET = 'fixture'
  process.env.DATA_BUCKET = 'data-fixture'
  let writes = 0
  let deleted = ''
  const send = mock.method(S3Client.prototype, 'send', async (command: unknown) => {
    if (command instanceof GetObjectCommand) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
    if (command instanceof DeleteObjectCommand) { deleted = command.input.Key ?? ''; return {} }
    if (command instanceof PutObjectCommand && ++writes === 2) throw new Error('S3 failure')
    return {}
  })
  const error = mock.method(console, 'error', () => {})
  try {
    const image = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#738a94' } }).jpeg().toBuffer()
    const result = await handler(event(image))
    assert.equal(result.statusCode, 500)
    assert.match(deleted, /^images\/building-image\/building-1\/.+_600\.webp$/)
  } finally { send.mock.restore(); error.mock.restore(); delete process.env.IMAGE_BUCKET; delete process.env.DATA_BUCKET }
})
