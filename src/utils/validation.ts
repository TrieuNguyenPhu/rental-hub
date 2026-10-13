import type { BookingInput, BuildingInput, EstateData, RoomInput } from '../types/index.ts'
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
  if (data.rooms.some(room => room.id !== id && room.buildingId === input.buildingId && room.roomNumber.toLocaleLowerCase('vi') === input.roomNumber.trim().toLocaleLowerCase('vi'))) return 'Số phòng đã tồn tại trong tòa nhà này.'
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
  const previous = data.bookings.find(item => item.id === id)
  if (room.status === 'maintenance' && (!previous || previous.roomId !== room.id)) return 'Phòng đang bảo trì, không thể tạo hoặc chuyển booking vào phòng này.'
  if (!validDate(input.checkIn) || !validDate(input.checkOut)) return 'Vui lòng nhập ngày nhận và trả phòng hợp lệ (YYYY-MM-DD).'
  if (input.checkOut <= input.checkIn) return 'Ngày trả phòng phải sau ngày nhận phòng.'
  if (hasBookingOverlap(data.bookings, input.roomId, input.checkIn, input.checkOut, id)) return 'Lịch đặt bị trùng với một booking đã xác nhận của phòng này. Vui lòng chọn ngày hoặc phòng khác.'
}
