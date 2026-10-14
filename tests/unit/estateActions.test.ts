import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEstateActions } from '../../apps/web/src/domain/estateActions.ts'
import type { EstateData } from '../../packages/domain/models.ts'

test('estate actions run with plain state and preserve data on rejection', () => {
  let data: EstateData = { buildings: [], rooms: [], bookings: [] }
  const actions = createEstateActions(() => data, (patch, id) => {
    data = { ...data, ...patch }
    return { ok: true, id }
  }, { exportData: JSON.stringify, reset: () => {} })
  assert.equal(actions.resetDemoData().ok, false)
  const result = actions.addBuilding({ name: '  Test  ', address: '1 Road', city: 'Huế', floors: 2, status: 'active' })
  assert.ok(result.ok)
  assert.equal(data.buildings[0].name, 'Test')
  const before = data
  assert.equal(actions.addRoom({ buildingId: result.id, roomNumber: '101', floor: 3, area: 30, rentalPrice: 0, status: 'available' }).ok, false)
  assert.equal(data, before)
  assert.equal(actions.deleteBuilding(result.id).ok, true)
  assert.deepEqual(data.buildings, [])
  actions.exportData()
  assert.equal(actions.resetDemoData().ok, true)
  assert.equal(data.buildings.length, 3)
})
