import type { BookingInput, BuildingInput, EstateData, ImageAsset, RoomInput } from '../types/index.ts'
import { hasBookingOverlap } from './bookingOverlap.ts'

export function validateBuilding(input: BuildingInput, data: EstateData, id?: string): string | undefined {
  if (!input.name.trim() || !input.address.trim() || !input.city.trim()) return 'Vui lòng nhập tên, địa chỉ và thành phố của tòa nhà.'
  if (!Number.isInteger(input.floors) || input.floors <= 0) return 'Số tầng phải là số nguyên dương.'
  if (!['active', 'inactive', 'maintenance'].includes(input.status)) return 'Trạng thái tòa nhà không hợp lệ.'
  if (id && data.rooms.some(room => room.buildingId === id && room.floor > input.floors)) return 'Không thể giảm số tầng xuống thấp hơn tầng của phòng hiện có.'
}

export function validateRoom(input: RoomInput, data: EstateData, id?: string): string | undefined {
  const building = data.buildings.find(item => item.id === input.buildingId)
  if (!building) return 'Vui lòng chọn một tòa nhà tồn tại.'
  if (!input.roomNumber.trim()) return 'Vui lòng nhập số phòng.'
  if (data.rooms.some(room => room.id !== id && room.buildingId === input.buildingId && room.roomNumber.trim().toLocaleLowerCase('vi') === input.roomNumber.trim().toLocaleLowerCase('vi'))) return 'Số phòng đã tồn tại trong tòa nhà này.'
  if (!Number.isInteger(input.floor) || input.floor <= 0 || input.floor > building.floors) return `Tầng phải là số nguyên từ 1 đến ${building.floors}.`
  if (!Number.isFinite(input.area) || input.area <= 0) return 'Diện tích phải lớn hơn 0.'
  if (!Number.isSafeInteger(input.rentalPrice) || input.rentalPrice < 0) return 'Giá thuê phải là số nguyên VND không âm.'
  if (!['available', 'occupied', 'maintenance'].includes(input.status)) return 'Trạng thái phòng không hợp lệ.'
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateBooking(input: BookingInput, data: EstateData, id?: string): string | undefined {
  if (!input.customerName.trim()) return 'Vui lòng nhập tên khách hàng.'
  if (!input.customerPhone.trim()) return 'Vui lòng nhập số điện thoại khách hàng.'
  const room = data.rooms.find(item => item.id === input.roomId)
  if (!room) return 'Vui lòng chọn một phòng tồn tại.'
  if (room.status === 'maintenance') return 'Phòng đang bảo trì, không thể tạo hoặc sửa booking vào phòng này.'
  if (data.buildings.find(item => item.id === room.buildingId)?.status !== 'active') return 'Tòa nhà không hoạt động, không thể tạo hoặc sửa booking.'
  if (!validDate(input.checkIn) || !validDate(input.checkOut)) return 'Vui lòng nhập ngày nhận và trả phòng hợp lệ (YYYY-MM-DD).'
  if (input.checkOut <= input.checkIn) return 'Ngày trả phòng phải sau ngày nhận phòng.'
  if (hasBookingOverlap(data.bookings, input.roomId, input.checkIn, input.checkOut, id)) return 'Lịch đặt bị trùng với một booking đã xác nhận của phòng này. Vui lòng chọn ngày hoặc phòng khác.'
}

export function validImages(value: unknown): value is ImageAsset[] {
  return Array.isArray(value) && value.length <= 5 && value.every(image => {
    if (!image || typeof image !== 'object' || typeof image.id !== 'string') return false
    const url = /^\/images\/(building-image|room-image)\/[A-Za-z0-9_-]{1,64}\/([A-Za-z0-9_-]{1,64})\/\d+-[A-Za-z0-9_-]+_600\.webp$/
    const match = typeof image.url600 === 'string' ? image.url600.match(url) : null
    return match?.[2] === image.id && image.url1200 === image.url600.replace(/_600\.webp$/, '_1200.webp') &&
      image.width600 === 600 && image.width1200 === 1200 &&
      [image.height600, image.height1200, image.bytes600, image.bytes1200].every(n => Number.isSafeInteger(n) && n > 0)
  })
}

export function readEstateData(value: unknown): EstateData {
  if (!value || typeof value !== 'object') throw new Error('Invalid storage')
  const envelope = value as { version?: unknown; state?: unknown }
  if (![0, 1].includes(envelope.version as number) || !envelope.state || typeof envelope.state !== 'object') throw new Error('Invalid storage')
  const data = envelope.state as EstateData
  if (![data.buildings, data.rooms, data.bookings].every(Array.isArray)) throw new Error('Invalid collections')
  const strings = (item: unknown, keys: string[]) => item !== null && typeof item === 'object' && keys.every(key => typeof (item as Record<string, unknown>)[key] === 'string')
  for (const collection of [data.buildings, data.rooms, data.bookings]) {
    if (!collection.every(item => strings(item, ['id']) && /^[A-Za-z0-9_-]{1,64}$/.test(item.id)) || new Set(collection.map(item => item.id)).size !== collection.length) throw new Error('Invalid IDs')
  }
  for (const building of data.buildings) {
    if (!strings(building, ['name', 'address', 'city', 'status']) || validateBuilding(building, { ...data, rooms: [] }) || !validImages(building.images === undefined ? [] : building.images)) throw new Error('Invalid building')
  }
  for (const room of data.rooms) {
    if (!strings(room, ['buildingId', 'roomNumber', 'status']) || validateRoom(room, data, room.id) || !validImages(room.images === undefined ? [] : room.images)) throw new Error('Invalid room')
  }
  for (const booking of data.bookings) {
    if (!strings(booking, ['roomId', 'customerName', 'customerPhone', 'checkIn', 'checkOut', 'status']) || !booking.customerName.trim() || !booking.customerPhone.trim() || !data.rooms.some(room => room.id === booking.roomId) || !['confirmed', 'cancelled'].includes(booking.status) || !validDate(booking.checkIn) || !validDate(booking.checkOut) || booking.checkOut <= booking.checkIn || (booking.status === 'confirmed' && hasBookingOverlap(data.bookings, booking.roomId, booking.checkIn, booking.checkOut, booking.id))) throw new Error('Invalid booking')
  }
  return { buildings: data.buildings.map(item => ({ ...item, images: item.images ?? [] })), rooms: data.rooms.map(item => ({ ...item, images: item.images ?? [] })), bookings: data.bookings }
}
