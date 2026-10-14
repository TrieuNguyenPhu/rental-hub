import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDemoData } from '../../apps/web/src/domain/demoData.ts'
import { bookingRoomError, validateBooking } from '../../apps/web/src/domain/validation.ts'
import type { Building, Room } from '../../packages/domain/models.ts'

test('booking eligibility is shared across UI and validation for every room/building status', () => {
  const data = createDemoData()
  const building = data.buildings[0]
  const room = data.rooms.find(item => item.buildingId === building.id)!
  const input = { roomId: room.id, customerName: 'Guest', customerPhone: '0901234567', checkIn: '2099-01-01', checkOut: '2099-01-02' }
  const buildings: Building['status'][] = ['active', 'inactive', 'maintenance']
  const rooms: Room['status'][] = ['available', 'occupied', 'maintenance']
  for (const buildingStatus of buildings) {
    for (const roomStatus of rooms) {
      building.status = buildingStatus
      room.status = roomStatus
      const error = bookingRoomError(room, data.buildings)
      assert.equal(error === undefined, buildingStatus === 'active' && roomStatus !== 'maintenance')
      assert.equal(validateBooking(input, data), error)
    }
  }
  room.status = 'available'
  assert.match(bookingRoomError(room, [])!, /Tòa nhà không hoạt động/)
  assert.match(bookingRoomError(undefined, data.buildings)!, /phòng tồn tại/)
})
