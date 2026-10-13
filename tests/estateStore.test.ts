import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEstateStore } from '../src/store/estateStore.ts'
import { createDemoData } from '../src/data/demo.ts'
import { hasBookingOverlap } from '../src/utils/bookingOverlap.ts'
import type { StateStorage } from 'zustand/middleware'
import type { BookingInput, BuildingInput, RoomInput } from '../src/types/index.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  const storage: StateStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
  return { storage, values }
}
const buildingInput: BuildingInput = { name: 'Test Tower', address: '1 Test Road', city: 'Huế', floors: 5, status: 'active' }
const roomInput: RoomInput = { buildingId: 'building-1', roomNumber: 'TEST', floor: 2, area: 30, rentalPrice: 5_000_000, status: 'available' }
const bookingInput: BookingInput = { roomId: 'room-8', customerName: 'Test Guest', customerPhone: '0912345678', checkIn: '2027-02-10', checkOut: '2027-02-20' }
function fixture() { return createEstateStore(memoryStorage().storage) }

test('first visit immediately saves the seed; reload restores the same data', () => {
  const { storage, values } = memoryStorage()
  const first = createEstateStore(storage)
  assert.equal(values.size, 1)
  assert.deepEqual(createEstateStore(storage).getState().bookings, first.getState().bookings)
})
test('demo has 3 buildings, 12 rooms, 7 bookings with valid references and no overlaps', () => {
  const data = createDemoData()
  assert.equal(data.buildings.length, 3); assert.equal(data.rooms.length, 12); assert.equal(data.bookings.length, 7)
  for (const room of data.rooms) assert.ok(data.buildings.some(item => item.id === room.buildingId && item.floors >= room.floor))
  for (const booking of data.bookings) {
    assert.ok(data.rooms.some(room => room.id === booking.roomId))
    if (booking.status === 'confirmed') assert.equal(hasBookingOverlap(data.bookings, booking.roomId, booking.checkIn, booking.checkOut, booking.id), false)
  }
})
test('building CRUD trims values, preserves ID and blocks deletion with linked rooms', () => {
  const store = fixture()
  assert.equal(store.getState().addBuilding({ ...buildingInput, name: '  Test Tower  ' }).ok, true)
  const building = store.getState().buildings.at(-1)!
  assert.equal(building.name, 'Test Tower')
  assert.equal(store.getState().updateBuilding(building.id, { ...buildingInput, name: 'Edited' }).ok, true)
  assert.equal(store.getState().buildings.at(-1)!.id, building.id)
  assert.equal(store.getState().deleteBuilding(building.id).ok, true)
  assert.equal(store.getState().deleteBuilding('building-1').ok, false)
  assert.equal(store.getState().updateBuilding('building-1', { ...buildingInput, floors: 1 }).ok, false)
})
test('building actions reject empty strings, fractional and nonpositive floors', () => {
  const store = fixture()
  for (const patch of [{ name: ' ' }, { address: '' }, { city: '' }, { floors: 0 }, { floors: -1 }, { floors: 1.5 }, { floors: NaN }]) {
    assert.equal(store.getState().addBuilding({ ...buildingInput, ...patch }).ok, false)
  }
})
test('room CRUD maintains references and rejects duplicates, invalid floors, area and prices', () => {
  const store = fixture()
  for (const patch of [{ buildingId: 'missing' }, { roomNumber: ' ' }, { roomNumber: '101' }, { floor: 0 }, { floor: 9 }, { floor: 1.2 }, { area: 0 }, { area: NaN }, { rentalPrice: -1 }, { rentalPrice: Infinity }]) {
    assert.equal(store.getState().addRoom({ ...roomInput, ...patch }).ok, false)
  }
  assert.equal(store.getState().addRoom({ ...roomInput, roomNumber: ' TEST ' }).ok, true)
  const room = store.getState().rooms.at(-1)!
  assert.equal(room.roomNumber, 'TEST')
  assert.equal(store.getState().addRoom({ ...roomInput, roomNumber: 'test' }).ok, false)
  assert.equal(store.getState().updateRoom(room.id, { ...roomInput, buildingId: 'building-2' }).ok, true)
  assert.equal(store.getState().rooms.at(-1)!.id, room.id)
  assert.equal(store.getState().deleteRoom(room.id).ok, true)
})
test('rooms with confirmed or cancelled bookings cannot be deleted', () => {
  const store = fixture()
  assert.equal(store.getState().deleteRoom('room-1').ok, false)
  assert.equal(store.getState().deleteRoom('room-7').ok, false)
})
test('booking validates room, maintenance, required fields, real dates and date order', () => {
  const store = fixture()
  for (const patch of [{ roomId: 'missing' }, { roomId: 'room-4' }, { customerName: ' ' }, { customerPhone: '' }, { checkIn: '' }, { checkIn: '2027-02-30' }, { checkIn: '2027-2-1' }, { checkOut: '2027-02-10' }, { checkOut: '2027-02-09' }]) {
    assert.equal(store.getState().addBooking({ ...bookingInput, ...patch }).ok, false)
  }
})
test('booking overlap and edit self-exclusion are enforced by store actions', () => {
  const store = fixture()
  assert.equal(store.getState().addBooking(bookingInput).ok, true)
  const booking = store.getState().bookings.at(-1)!
  assert.equal(store.getState().addBooking({ ...bookingInput, checkIn: '2027-02-15', checkOut: '2027-02-25' }).ok, false)
  assert.equal(store.getState().updateBooking(booking.id, { ...bookingInput, customerName: 'Edited Guest' }).ok, true)
  assert.equal(store.getState().addBooking({ ...bookingInput, checkIn: '2027-02-20', checkOut: '2027-02-25' }).ok, true)
  assert.equal(store.getState().bookings.find(item => item.id === booking.id)!.customerName, 'Edited Guest')
})
test('moving a booking checks the target room for overlaps and maintenance', () => {
  const store = fixture()
  store.getState().addBooking(bookingInput)
  const booking = store.getState().bookings.at(-1)!
  store.getState().addBooking({ ...bookingInput, roomId: 'room-3' })
  assert.equal(store.getState().updateBooking(booking.id, { ...bookingInput, roomId: 'room-3' }).ok, false)
  assert.equal(store.getState().updateBooking(booking.id, { ...bookingInput, roomId: 'room-4' }).ok, false)
  assert.equal(store.getState().updateBooking(booking.id, { ...bookingInput, roomId: 'room-2' }).ok, true)
})
test('cancelling retains history, frees dates and prevents further edits', () => {
  const store = fixture()
  store.getState().addBooking(bookingInput)
  const booking = store.getState().bookings.at(-1)!
  assert.equal(store.getState().cancelBooking(booking.id).ok, true)
  assert.equal(store.getState().bookings.find(item => item.id === booking.id)!.status, 'cancelled')
  assert.equal(store.getState().updateBooking(booking.id, bookingInput).ok, false)
  assert.equal(store.getState().cancelBooking(booking.id).ok, false)
  assert.equal(store.getState().addBooking(bookingInput).ok, true)
})
test('missing IDs return errors instead of silently succeeding', () => {
  const store = fixture().getState()
  for (const result of [store.deleteBuilding('x'), store.updateBuilding('x', buildingInput), store.deleteRoom('x'), store.updateRoom('x', roomInput), store.updateBooking('x', bookingInput), store.cancelBooking('x')]) assert.equal(result.ok, false)
})
test('writes persist, including empty collections which must never be reseeded', () => {
  const { storage } = memoryStorage()
  const store = createEstateStore(storage)
  store.getState().addBuilding(buildingInput)
  assert.equal(createEstateStore(storage).getState().buildings.length, 4)
  store.setState({ buildings: [], rooms: [], bookings: [] })
  const reloaded = createEstateStore(storage).getState()
  assert.deepEqual([reloaded.buildings, reloaded.rooms, reloaded.bookings], [[], [], []])
})
test('storage write failure returns an error and rolls back in-memory state', () => {
  const storage: StateStorage = { getItem: () => null, setItem: () => { throw new Error('quota exceeded') }, removeItem: () => {} }
  const store = createEstateStore(storage)
  const before = store.getState().buildings
  const result = store.getState().addBuilding(buildingInput)
  assert.equal(result.ok, false)
  assert.deepEqual(store.getState().buildings, before)
})
