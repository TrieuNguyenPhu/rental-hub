import type { EstateData } from '../../../../packages/domain/models.ts'
import type { EstatePersistence, EstateStorage } from '../domain/contracts.ts'
import { validImages, validateBuilding, validateRoom, validDate } from '../domain/validation.ts'
import { hasBookingOverlap } from '../domain/bookingOverlap.ts'

export function readEstateData(value: unknown): EstateData {
  if (!value || typeof value !== 'object') throw new Error('Invalid storage')
  const envelope = value as { version?: unknown; state?: unknown }
  if (
    ![0, 1].includes(envelope.version as number) ||
    !envelope.state ||
    typeof envelope.state !== 'object'
  )
    throw new Error('Invalid storage')
  const data = envelope.state as EstateData
  if (![data.buildings, data.rooms, data.bookings].every(Array.isArray))
    throw new Error('Invalid collections')
  const strings = (item: unknown, keys: string[]) =>
    item !== null &&
    typeof item === 'object' &&
    keys.every((key) => typeof (item as Record<string, unknown>)[key] === 'string')
  for (const collection of [data.buildings, data.rooms, data.bookings]) {
    if (
      !collection.every((item) => strings(item, ['id']) && /^[A-Za-z0-9_-]{1,64}$/.test(item.id)) ||
      new Set(collection.map((item) => item.id)).size !== collection.length
    )
      throw new Error('Invalid IDs')
  }
  for (const building of data.buildings) {
    if (
      !strings(building, ['name', 'address', 'city', 'status']) ||
      validateBuilding(building, { ...data, rooms: [] }) ||
      !validImages(building.images === undefined ? [] : building.images)
    )
      throw new Error('Invalid building')
  }
  for (const room of data.rooms) {
    if (
      !strings(room, ['buildingId', 'roomNumber', 'status']) ||
      validateRoom(room, data, room.id) ||
      !validImages(room.images === undefined ? [] : room.images)
    )
      throw new Error('Invalid room')
  }
  for (const booking of data.bookings) {
    if (
      !strings(booking, [
        'roomId',
        'customerName',
        'customerPhone',
        'checkIn',
        'checkOut',
        'status',
      ]) ||
      !booking.customerName.trim() ||
      !booking.customerPhone.trim() ||
      !data.rooms.some((room) => room.id === booking.roomId) ||
      !['confirmed', 'cancelled'].includes(booking.status) ||
      !validDate(booking.checkIn) ||
      !validDate(booking.checkOut) ||
      booking.checkOut <= booking.checkIn ||
      (booking.status === 'confirmed' &&
        hasBookingOverlap(
          data.bookings,
          booking.roomId,
          booking.checkIn,
          booking.checkOut,
          booking.id,
        ))
    )
      throw new Error('Invalid booking')
  }
  return {
    buildings: data.buildings.map((item) => ({ ...item, images: item.images ?? [] })),
    rooms: data.rooms.map((item) => ({ ...item, images: item.images ?? [] })),
    bookings: data.bookings,
  }
}

export const browserStorage: EstateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
}

export function createEstatePersistence(storage: EstateStorage): EstatePersistence {
  const storageKey = 'room-finder-estate-v1'
  let raw: string | null = null
  let blocked = false
  let storageWarning: string | null = null
  let initialData: EstateData | null = { buildings: [], rooms: [], bookings: [] }
  try {
    const stored = storage.getItem(storageKey)
    if (stored !== null && typeof stored !== 'string')
      throw new Error('Storage must be synchronous')
    raw = stored
    initialData = raw === null ? null : readEstateData(JSON.parse(raw))
  } catch {
    blocked = true
    storageWarning =
      'Không thể đọc dữ liệu đã lưu. Dữ liệu gốc được giữ nguyên; hãy xuất dữ liệu trước khi khôi phục demo.'
  }
  const serialize = (data: EstateData) =>
    JSON.stringify({
      state: { buildings: data.buildings, rooms: data.rooms, bookings: data.bookings },
      version: 1,
    })
  return {
    initialData,
    storageWarning,
    fresh: raw === null,
    exportData: (data) => (blocked && raw !== null ? raw : serialize(data)),
    reset: () => {
      blocked = false
    },
    save: (data) => {
      if (blocked) return storageWarning
      try {
        storage.setItem(storageKey, serialize(data))
        return null
      } catch {
        return 'Không thể ghi localStorage. Thay đổi chỉ còn trong bộ nhớ và sẽ mất khi tải lại trang.'
      }
    },
  }
}
