import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadHttpImage } from '../../apps/web/src/services/uploadHttpImage.ts'

const asset = {
  id: 'image-1',
  url600: '/images/room-image/room-1/image-1/1-test_600.webp',
  url1200: '/images/room-image/room-1/image-1/1-test_1200.webp',
  width600: 600, width1200: 1200, height600: 400, height1200: 800, bytes600: 100, bytes1200: 200,
}

test('HTTP upload forwards the file and cancellation signal, then validates its response', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(asset)))
  const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
  const signal = new AbortController().signal
  assert.deepEqual(await uploadHttpImage(file, 'room', 'room-1', signal), asset)
  assert.deepEqual(fetch.mock.calls[0].arguments, ['/api/images?entityType=room&entityId=room-1', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: file, signal,
  }])
})

test('HTTP upload preserves API errors and rejects malformed success responses', async t => {
  const responses = [
    new Response(JSON.stringify({ message: 'Storage is full.' }), { status: 507 }),
    new Response('not JSON', { status: 502 }),
    new Response(JSON.stringify({ id: 'fake' })),
  ]
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!)
  const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
  const signal = new AbortController().signal
  await assert.rejects(uploadHttpImage(file, 'room', 'room-1', signal), /Storage is full/)
  await assert.rejects(uploadHttpImage(file, 'room', 'room-1', signal), /HTTP 502/)
  await assert.rejects(uploadHttpImage(file, 'room', 'room-1', signal), /Phản hồi ảnh không hợp lệ/)
})
