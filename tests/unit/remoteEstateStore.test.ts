import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createDemoData } from '../../apps/web/src/domain/demoData.ts'
import { createRemoteEstateStore } from '../../apps/web/src/services/remoteEstateStore.ts'

test('remote store waits for AWS and refreshes shared data on a write conflict', async () => {
  const original = createDemoData()
  const changed = { ...original, buildings: original.buildings.map((item, index) => index ? item : { ...item, name: 'Updated elsewhere' }) }
  const requests: object[] = []
  const fetch = mock.method(globalThis, 'fetch', async (_url: string, options?: RequestInit) => {
    if (options?.method !== 'POST') return Response.json({ data: original, version: 'v1' })
    requests.push(JSON.parse(options.body as string))
    return Response.json({ data: changed, version: 'v2', message: 'Changed elsewhere' }, { status: 409 })
  })
  try {
    const store = await createRemoteEstateStore()
    const action = store.getState().deleteBuilding('building-1')
    assert.equal(store.getState().buildings.length, original.buildings.length)
    const result = await action
    assert.deepEqual(result, { ok: false, error: 'Changed elsewhere' })
    assert.equal(store.getState().buildings[0].name, 'Updated elsewhere')
    assert.deepEqual(requests, [{ action: 'deleteBuilding', id: 'building-1', version: 'v1' }])
  } finally { fetch.mock.restore() }
})
