import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEstateStore } from '../../apps/web/src/store.ts'
import { createDemoData } from '../../apps/web/src/domain/demoData.ts'
import { hasBookingOverlap } from '../../apps/web/src/domain/bookingOverlap.ts'
import { validDate } from '../../apps/web/src/domain/validation.ts'
import type { EstateStorage } from '../../apps/web/src/domain/contracts.ts'
import { createEstatePersistence } from '../../apps/web/src/services/estatePersistence.ts'
import type { BookingInput, BuildingInput, RoomInput } from '../../packages/domain/models.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  const storage: EstateStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
  return { storage, values }
}
const buildingInput: BuildingInput = { name: 'Test Tower', address: '1 Test Road', city: 'Huế', floors: 5, status: 'active' }
const roomInput: RoomInput = { buildingId: 'building-1', roomNumber: 'TEST', floor: 2, area: 30, rentalPrice: 5_000_000, status: 'available' }
const bookingInput: BookingInput = { roomId: 'room-8', customerName: 'Test Guest', customerPhone: '0912345678', checkIn: '2027-02-10', checkOut: '2027-02-20' }
function fixture() { return createEstateStore(createEstatePersistence(memoryStorage().storage)) }

test('first visit immediately saves the seed; reload restores the same data', () => {
  const { storage, values } = memoryStorage()
  const first = createEstateStore(createEstatePersistence(storage))
  assert.equal(values.size, 1)
  assert.deepEqual(createEstateStore(createEstatePersistence(storage)).getState().bookings, first.getState().bookings)
})

test('estateStore.initializesAndPersistsMetadata returns stable IDs and image defaults', () => {
  const { storage, values } = memoryStorage()
  const store = createEstateStore(createEstatePersistence(storage))
  const result = store.getState().addBuilding(buildingInput)
  assert.ok(result.ok)
  assert.equal(typeof result.id, 'string')
  const reloaded = createEstateStore(createEstatePersistence(storage)).getState()
  assert.deepEqual(reloaded.buildings.find(item => item.id === result.id)?.images, [])
  assert.ok(reloaded.rooms.every(item => Array.isArray(item.images)))
  assert.doesNotMatch([...values.values()][0], /base64|Blob/)
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
  const before = store.getState().buildings
  for (const patch of [{ name: ' ' }, { address: ' ' }, { city: ' ' }, { floors: 0 }, { floors: -1 }, { floors: 1.5 }, { floors: NaN }, { floors: Infinity }]) {
    assert.equal(store.getState().addBuilding({ ...buildingInput, ...patch }).ok, false)
    assert.deepEqual(store.getState().buildings, before)
  }
})

test('building can be marked inactive without deleting rooms or bookings', () => {
  const store = fixture()
  const before = store.getState()
  assert.equal(store.getState().updateBuilding('building-1', { ...buildingInput, floors: 8, status: 'inactive' }).ok, true)
  assert.deepEqual(store.getState().rooms, before.rooms)
  assert.deepEqual(store.getState().bookings, before.bookings)
})
test('room CRUD maintains references and rejects duplicates, invalid floors, area and prices', () => {
  const store = fixture()
  const before = store.getState().rooms
  for (const patch of [{ buildingId: 'missing' }, { roomNumber: ' ' }, { roomNumber: '101' }, { floor: 0 }, { floor: 9 }, { floor: 1.2 }, { area: 0 }, { area: NaN }, { area: Infinity }, { rentalPrice: -1 }, { rentalPrice: 1.5 }, { rentalPrice: Infinity }]) {
    assert.equal(store.getState().addRoom({ ...roomInput, ...patch }).ok, false)
    assert.deepEqual(store.getState().rooms, before)
  }
  assert.equal(store.getState().addRoom({ ...roomInput, roomNumber: ' TEST ' }).ok, true)
  const room = store.getState().rooms.at(-1)!
  assert.equal(room.roomNumber, 'TEST')
  assert.equal(store.getState().addRoom({ ...roomInput, roomNumber: 'test' }).ok, false)
  assert.equal(store.getState().updateRoom(room.id, { ...roomInput, buildingId: 'building-2' }).ok, true)
  assert.equal(store.getState().rooms.at(-1)!.id, room.id)
  assert.equal(store.getState().deleteRoom(room.id).ok, true)
})

test('rooms accept zero whole VND and manual occupied status', () => {
  const store = fixture()
  assert.equal(store.getState().addRoom({ ...roomInput, rentalPrice: 0, status: 'occupied' }).ok, true)
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

test('leap dates are validated without changing date-only values', () => {
  assert.equal(validDate('2028-02-29'), true)
  assert.equal(validDate('2026-02-29'), false)
})

test('booking creation and edits recheck building and room availability', () => {
  for (const unavailable of ['room', 'building'] as const) {
    const store = fixture()
    const created = store.getState().addBooking(bookingInput)
    assert.ok(created.ok)
    if (unavailable === 'room') store.getState().updateRoom('room-8', { ...store.getState().rooms.find(r => r.id === 'room-8')!, status: 'maintenance' })
    else store.getState().updateBuilding('building-2', { ...store.getState().buildings.find(b => b.id === 'building-2')!, status: 'inactive' })
    const before = store.getState().bookings
    assert.equal(store.getState().updateBooking(created.id, bookingInput).ok, false)
    assert.equal(store.getState().addBooking({ ...bookingInput, checkIn: '2027-02-20', checkOut: '2027-02-25' }).ok, false)
    assert.deepEqual(store.getState().bookings, before)
  }
})
test('booking overlap and edit self-exclusion are enforced by store actions', () => {
  const store = fixture()
  assert.equal(store.getState().addBooking(bookingInput).ok, true)
  const booking = store.getState().bookings.at(-1)!
  assert.equal(store.getState().addBooking({ ...bookingInput, checkIn: '2027-02-15', checkOut: '2027-02-25' }).ok, false)
  assert.equal(store.getState().updateBooking(booking.id, { ...bookingInput, customerName: 'Edited Guest' }).ok, true)
  assert.equal(store.getState().addBooking({ ...bookingInput, checkIn: '2027-02-20', checkOut: '2027-02-25' }).ok, true)
  const before = store.getState().bookings
  assert.equal(store.getState().updateBooking(booking.id, { ...bookingInput, checkOut: '2027-02-24' }).ok, false)
  assert.deepEqual(store.getState().bookings, before)
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
  const store = createEstateStore(createEstatePersistence(storage))
  store.getState().addBuilding(buildingInput)
  assert.equal(createEstateStore(createEstatePersistence(storage)).getState().buildings.length, 4)
  store.setState({ buildings: [], rooms: [], bookings: [] })
  const reloaded = createEstateStore(createEstatePersistence(storage)).getState()
  assert.deepEqual([reloaded.buildings, reloaded.rooms, reloaded.bookings], [[], [], []])
})
test('storage write failure keeps memory and warns that reload will lose the change', () => {
  const storage: EstateStorage = { getItem: () => null, setItem: () => { throw new Error('quota exceeded') } }
  const store = createEstateStore(createEstatePersistence(storage))
  const before = store.getState().buildings
  const result = store.getState().addBuilding(buildingInput)
  assert.equal(result.ok, true)
  assert.equal(store.getState().buildings.length, before.length + 1)
  assert.ok(store.getState().storageWarning)
})

test('corrupt and malformed storage stays intact until exported and explicitly reset', () => {
  for (const raw of ['{bad', JSON.stringify({ state: { buildings: 'bad', rooms: [], bookings: [] }, version: 0 }), JSON.stringify({ state: { buildings: [{ id: 'b', name: 42 }], rooms: [], bookings: [] }, version: 1 })]) {
    const { storage, values } = memoryStorage()
    values.set('room-finder-estate-v1', raw)
    const store = createEstateStore(createEstatePersistence(storage))
    assert.ok(store.getState().storageWarning)
    assert.deepEqual(store.getState().buildings, [])
    store.getState().addBuilding(buildingInput)
    assert.equal(values.get('room-finder-estate-v1'), raw)
    assert.equal(store.getState().resetDemoData().ok, false)
    assert.equal(store.getState().exportData(), raw)
    assert.equal(store.getState().resetDemoData().ok, true)
    assert.equal(createEstateStore(createEstatePersistence(storage)).getState().buildings.length, 3)
  }
})

test('legacy data gets image defaults without changing the stored original on hydrate', () => {
  const { storage, values } = memoryStorage()
  const seed = createDemoData()
  const state = { ...seed, buildings: seed.buildings.map(({ images: _images, ...item }) => item), rooms: seed.rooms.map(({ images: _images, ...item }) => item) }
  const raw = JSON.stringify({ state, version: 0 })
  values.set('room-finder-estate-v1', raw)
  const store = createEstateStore(createEstatePersistence(storage))
  assert.deepEqual(store.getState().buildings[0].images, [])
  assert.deepEqual(store.getState().rooms[0].images, [])
  assert.equal(values.get('room-finder-estate-v1'), raw)
})

test('hydrate rejects explicitly null image lists and preserves the raw original', () => {
  const { storage, values } = memoryStorage()
  const seed = createDemoData()
  const raw = JSON.stringify({ version: 1, state: { ...seed, buildings: seed.buildings.map(item => ({ ...item, images: null })) } })
  values.set('room-finder-estate-v1', raw)
  const store = createEstateStore(createEstatePersistence(storage))
  assert.ok(store.getState().storageWarning)
  assert.equal(values.get('room-finder-estate-v1'), raw)
})

test('legacy room numbers with surrounding spaces still block normalized duplicates', () => {
  const { storage } = memoryStorage()
  const store = createEstateStore(createEstatePersistence(storage))
  store.setState({ rooms: store.getState().rooms.map(item => item.id === 'room-1' ? { ...item, roomNumber: ' TEST ' } : item) })
  const reloaded = createEstateStore(createEstatePersistence(storage))
  assert.equal(reloaded.getState().addRoom({ ...roomInput, roomNumber: 'test' }).ok, false)
})
