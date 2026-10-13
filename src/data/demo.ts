import type { EstateData } from '../types/index.ts'
import { dateOffset } from '../utils/format.ts'

export function createDemoData(): EstateData {
  const buildings: EstateData['buildings'] = [
    { id: 'building-1', name: 'Riverside Residence', address: '28 Nguyễn Hữu Cảnh, Bình Thạnh', city: 'TP. Hồ Chí Minh', floors: 8, status: 'active' },
    { id: 'building-2', name: 'Lotus Garden', address: '86 Trần Duy Hưng, Cầu Giấy', city: 'Hà Nội', floors: 6, status: 'active' },
    { id: 'building-3', name: 'Ocean View', address: '12 Võ Nguyên Giáp, Sơn Trà', city: 'Đà Nẵng', floors: 5, status: 'maintenance' },
  ]
  const rooms: EstateData['rooms'] = buildings.flatMap((building, bi) => [1, 2, 3, 4].map((floor, ri) => ({
    id: `room-${bi * 4 + ri + 1}`, buildingId: building.id, roomNumber: `${floor}01`, floor,
    area: [32, 45, 56, 68][ri], rentalPrice: 4_500_000 + bi * 500_000 + ri * 1_500_000,
    status: bi === 2 || (bi === 0 && ri === 3) ? 'maintenance' : 'available',
  })))
  const names = ['Nguyễn Minh Anh', 'Trần Hoàng Nam', 'Lê Thu Hà', 'Phạm Quang Huy', 'Võ Ngọc Linh', 'Đặng Tuấn Anh', 'Bùi Thanh Mai']
  const bookings: EstateData['bookings'] = names.map((customerName, i) => ({
    id: `booking-${i + 1}`, roomId: `room-${[1, 2, 3, 5, 6, 7, 1][i]}`, customerName,
    customerPhone: `090123456${i}`, checkIn: dateOffset([-4, 2, 5, 8, 12, -20, 25][i]),
    checkOut: dateOffset([10, 16, 20, 24, 30, -10, 35][i]), status: i >= 5 ? 'cancelled' : 'confirmed',
  }))
  return { buildings, rooms, bookings }
}
