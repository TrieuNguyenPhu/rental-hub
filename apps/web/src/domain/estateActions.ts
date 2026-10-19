import type {
  ActionResult,
  BookingInput,
  BuildingInput,
  EstateData,
  RoomInput,
} from '../../../../packages/domain/models.ts'
import { validImages, validateBooking, validateBuilding, validateRoom } from './validation.ts'
import type { EstatePersistence } from './contracts.ts'
import { createDemoData } from './demoData.ts'

export interface EstateActions {
  addBuilding: (input: BuildingInput) => ActionResult
  updateBuilding: (id: string, input: BuildingInput) => ActionResult
  deleteBuilding: (id: string) => ActionResult
  addRoom: (input: RoomInput) => ActionResult
  updateRoom: (id: string, input: RoomInput) => ActionResult
  deleteRoom: (id: string) => ActionResult
  addBooking: (input: BookingInput) => ActionResult
  updateBooking: (id: string, input: BookingInput) => ActionResult
  cancelBooking: (id: string) => ActionResult
  exportData: () => string
  resetDemoData: () => ActionResult
}

const failure = (error: string): ActionResult => ({ ok: false, error })
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
  byte.toString(16).padStart(2, '0')).join('')

export function createEstateActions(
  get: () => EstateData,
  update: (patch: Partial<EstateData>, id: string) => ActionResult,
  persistence: Pick<EstatePersistence, 'exportData' | 'reset'>,
): EstateActions {
  let exported = false
  const commit = (patch: Partial<EstateData>, id: string): ActionResult => {
    exported = false
    return update(patch, id)
  }
  return {
    exportData: () => {
      exported = true
      return persistence.exportData(get())
    },
    resetDemoData: () => {
      if (!exported) return failure('Hãy xuất dữ liệu trước khi khôi phục demo.')
      persistence.reset()
      return commit(createDemoData(), 'demo')
    },
    addBuilding: (input) => {
      if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
      const error = validateBuilding(input, get())
      if (error) return failure(error)
      const id = newId()
      return commit(
        {
          buildings: [
            ...get().buildings,
            {
              ...input,
              images: input.images ?? [],
              name: input.name.trim(),
              address: input.address.trim(),
              city: input.city.trim(),
              id,
            },
          ],
        },
        id,
      )
    },
    updateBuilding: (id, input) => {
      if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
      if (!get().buildings.some((item) => item.id === id))
        return failure('Tòa nhà không còn tồn tại.')
      const error = validateBuilding(input, get(), id)
      if (error) return failure(error)
      return commit(
        {
          buildings: get().buildings.map((item) =>
            item.id === id
              ? {
                  ...input,
                  images: input.images ?? item.images,
                  name: input.name.trim(),
                  address: input.address.trim(),
                  city: input.city.trim(),
                  id,
                }
              : item,
          ),
        },
        id,
      )
    },
    deleteBuilding: (id) => {
      if (!get().buildings.some((item) => item.id === id))
        return failure('Tòa nhà không còn tồn tại.')
      if (get().rooms.some((room) => room.buildingId === id))
        return failure('Không thể xóa tòa nhà đang có phòng liên kết. Hãy xử lý các phòng trước.')
      return commit({ buildings: get().buildings.filter((item) => item.id !== id) }, id)
    },
    addRoom: (input) => {
      if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
      const error = validateRoom(input, get())
      if (error) return failure(error)
      const id = newId()
      return commit(
        {
          rooms: [
            ...get().rooms,
            { ...input, images: input.images ?? [], roomNumber: input.roomNumber.trim(), id },
          ],
        },
        id,
      )
    },
    updateRoom: (id, input) => {
      if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
      if (!get().rooms.some((item) => item.id === id)) return failure('Phòng không còn tồn tại.')
      const error = validateRoom(input, get(), id)
      if (error) return failure(error)
      return commit(
        {
          rooms: get().rooms.map((item) =>
            item.id === id
              ? {
                  ...input,
                  images: input.images ?? item.images,
                  roomNumber: input.roomNumber.trim(),
                  id,
                }
              : item,
          ),
        },
        id,
      )
    },
    deleteRoom: (id) => {
      if (!get().rooms.some((item) => item.id === id)) return failure('Phòng không còn tồn tại.')
      if (get().bookings.some((booking) => booking.roomId === id))
        return failure(
          'Không thể xóa phòng có booking liên kết, kể cả booking đã hủy, để giữ nguyên lịch sử.',
        )
      return commit({ rooms: get().rooms.filter((item) => item.id !== id) }, id)
    },
    addBooking: (input) => {
      const error = validateBooking(input, get())
      if (error) return failure(error)
      const id = newId()
      return commit(
        {
          bookings: [
            ...get().bookings,
            {
              ...input,
              customerName: input.customerName.trim(),
              customerPhone: input.customerPhone.trim(),
              status: 'confirmed',
              id,
            },
          ],
        },
        id,
      )
    },
    updateBooking: (id, input) => {
      const booking = get().bookings.find((item) => item.id === id)
      if (!booking) return failure('Booking không còn tồn tại.')
      if (booking.status === 'cancelled')
        return failure('Booking đã hủy không thể chỉnh sửa hoặc kích hoạt lại.')
      const error = validateBooking(input, get(), id)
      if (error) return failure(error)
      return commit(
        {
          bookings: get().bookings.map((item) =>
            item.id === id
              ? {
                  ...input,
                  customerName: input.customerName.trim(),
                  customerPhone: input.customerPhone.trim(),
                  status: 'confirmed',
                  id,
                }
              : item,
          ),
        },
        id,
      )
    },
    cancelBooking: (id) => {
      const booking = get().bookings.find((item) => item.id === id)
      if (!booking) return failure('Booking không còn tồn tại.')
      if (booking.status === 'cancelled') return failure('Booking này đã được hủy.')
      return commit(
        {
          bookings: get().bookings.map((item) =>
            item.id === id ? { ...item, status: 'cancelled' } : item,
          ),
        },
        id,
      )
    },
  }
}
