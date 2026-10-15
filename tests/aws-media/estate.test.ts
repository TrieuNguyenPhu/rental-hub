import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { handler } from '../../apps/aws-media/src/handler.ts'

const get = () => ({ requestContext: { http: { method: 'GET' } }, rawPath: '/api/estate' })
const post = (body: object) => ({ requestContext: { http: { method: 'POST' } }, rawPath: '/api/estate', body: JSON.stringify(body) })

test('AWS shared estate persists CRUD and rejects stale writes', async () => {
  process.env.DATA_BUCKET = 'private-data'
  let stored: string | null = null
  let version = 0
  const send = mock.method(S3Client.prototype, 'send', async (command: unknown) => {
    if (command instanceof GetObjectCommand) {
      if (stored === null) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
      return { ETag: `"${version}"`, Body: { transformToString: async () => stored } }
    }
    assert.ok(command instanceof PutObjectCommand)
    assert.equal(command.input.Bucket, 'private-data')
    if (stored === null) assert.equal(command.input.IfNoneMatch, '*')
    else assert.equal(command.input.IfMatch, `"${version}"`)
    stored = command.input.Body as string
    return { ETag: `"${++version}"` }
  })
  try {
    const first = JSON.parse((await handler(get())).body)
    assert.equal(first.version, null)
    const created = await handler(post({ action: 'addBuilding', version: null, input: { name: 'Test Tower', address: '1 Street', city: 'Hanoi', floors: 3, status: 'active' } }))
    assert.equal(created.statusCode, 200)
    const state = JSON.parse(created.body)
    assert.equal(state.data.buildings.length, first.data.buildings.length + 1)
    assert.equal(JSON.parse((await handler(get())).body).data.buildings.length, state.data.buildings.length)
    const stale = await handler(post({ action: 'addBuilding', version: null, input: { name: 'Lost', address: '1 Street', city: 'Hanoi', floors: 3, status: 'active' } }))
    assert.equal(stale.statusCode, 409)
    assert.equal(JSON.parse(stale.body).data.buildings.length, state.data.buildings.length)
  } finally { send.mock.restore(); delete process.env.DATA_BUCKET }
})

test('AWS shared estate validates untrusted input before domain mutation', async () => {
  process.env.DATA_BUCKET = 'private-data'
  const send = mock.method(S3Client.prototype, 'send', async () => { throw new Error('unexpected S3 call') })
  try {
    const result = await handler(post({ action: 'addBuilding', version: null, input: { name: null } }))
    assert.equal(result.statusCode, 400)
    assert.equal(send.mock.callCount(), 0)
  } finally { send.mock.restore(); delete process.env.DATA_BUCKET }
})
