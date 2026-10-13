import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import type { ActionResult, BookingInput, BuildingInput, EstateData, RoomInput } from '../types/index.ts'
import { createDemoData } from '../data/demo.ts'
import { validateBooking, validateBuilding, validateRoom } from '../utils/validation.ts'

interface EstateStore extends EstateData {
  addBuilding: (input: BuildingInput) => ActionResult
  updateBuilding: (id: string, input: BuildingInput) => ActionResult
  deleteBuilding: (id: string) => ActionResult
  addRoom: (input: RoomInput) => ActionResult
  updateRoom: (id: string, input: RoomInput) => ActionResult
  deleteRoom: (id: string) => ActionResult
  addBooking: (input: BookingInput) => ActionResult
  updateBooking: (id: string, input: BookingInput) => ActionResult
  cancelBooking: (id: string) => ActionResult
  resetDemoData: () => ActionResult
}

const failure = (error: string): ActionResult => ({ ok: false, error })
let storageWarning = ''
export const getStorageWarning = () => storageWarning
const browserStorage: StateStorage = {
  getItem: name => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: name => localStorage.removeItem(name),
}

export function createEstateStore(storage: StateStorage = browserStorage) {
  const store = create<EstateStore>()(persist((set, get) => {
    const commit = (patch: Partial<EstateData>, id: string): ActionResult => {
      const previous = get()
      try {
        set(patch)
        return { ok: true, id }
      } catch {
        // Restore memory too, so a failed storage write cannot look successful.
        try { set(previous) } catch { /* Storage is still unavailable; memory has been restored. */ }
        return failure('Không thể lưu dữ liệu. localStorage bị chặn hoặc đã đầy. Vui lòng kiểm tra cài đặt trình duyệt.')
      }
    }
    return {
      ...createDemoData(),
      addBuilding: input => {
        const error = validateBuilding(input, get())
        if (error) return failure(error)
        const id = crypto.randomUUID()
        return commit({ buildings: [...get().buildings, { ...input, images: input.images ?? [], name: input.name.trim(), address: input.address.trim(), city: input.city.trim(), id }] }, id)
      },
      updateBuilding: (id, input) => {
        if (!get().buildings.some(item => item.id === id)) return failure('Tòa nhà không còn tồn tại.')
        const error = validateBuilding(input, get(), id)
        if (error) return failure(error)
        return commit({ buildings: get().buildings.map(item => item.id === id ? { ...input, images: input.images ?? item.images, name: input.name.trim(), address: input.address.trim(), city: input.city.trim(), id } : item) }, id)
      },
      deleteBuilding: id => {
        if (!get().buildings.some(item => item.id === id)) return failure('Tòa nhà không còn tồn tại.')
        if (get().rooms.some(room => room.buildingId === id)) return failure('Không thể xóa tòa nhà đang có phòng liên kết. Hãy xử lý các phòng trước.')
        return commit({ buildings: get().buildings.filter(item => item.id !== id) }, id)
      },
      addRoom: input => {
        const error = validateRoom(input, get())
        if (error) return failure(error)
        const id = crypto.randomUUID()
        return commit({ rooms: [...get().rooms, { ...input, images: input.images ?? [], roomNumber: input.roomNumber.trim(), id }] }, id)
      },
      updateRoom: (id, input) => {
        if (!get().rooms.some(item => item.id === id)) return failure('Phòng không còn tồn tại.')
        const error = validateRoom(input, get(), id)
        if (error) return failure(error)
        return commit({ rooms: get().rooms.map(item => item.id === id ? { ...input, images: input.images ?? item.images, roomNumber: input.roomNumber.trim(), id } : item) }, id)
      },
      deleteRoom: id => {
        if (!get().rooms.some(item => item.id === id)) return failure('Phòng không còn tồn tại.')
        if (get().bookings.some(booking => booking.roomId === id)) return failure('Không thể xóa phòng có booking liên kết, kể cả booking đã hủy, để giữ nguyên lịch sử.')
        return commit({ rooms: get().rooms.filter(item => item.id !== id) }, id)
      },
      addBooking: input => {
        const error = validateBooking(input, get())
        if (error) return failure(error)
        const id = crypto.randomUUID()
        return commit({ bookings: [...get().bookings, { ...input, customerName: input.customerName.trim(), customerPhone: input.customerPhone.trim(), status: 'confirmed', id }] }, id)
      },
      updateBooking: (id, input) => {
        const booking = get().bookings.find(item => item.id === id)
        if (!booking) return failure('Booking không còn tồn tại.')
        if (booking.status === 'cancelled') return failure('Booking đã hủy không thể chỉnh sửa hoặc kích hoạt lại.')
        const error = validateBooking(input, get(), id)
        if (error) return failure(error)
        return commit({ bookings: get().bookings.map(item => item.id === id ? { ...input, customerName: input.customerName.trim(), customerPhone: input.customerPhone.trim(), status: 'confirmed', id } : item) }, id)
      },
      cancelBooking: id => {
        const booking = get().bookings.find(item => item.id === id)
        if (!booking) return failure('Booking không còn tồn tại.')
        if (booking.status === 'cancelled') return failure('Booking này đã được hủy.')
        return commit({ bookings: get().bookings.map(item => item.id === id ? { ...item, status: 'cancelled' } : item) }, id)
      },
      resetDemoData: () => commit(createDemoData(), 'demo'),
    }
  }, {
    name: 'room-finder-estate-v1',
    storage: createJSONStorage(() => storage),
    partialize: ({ buildings, rooms, bookings }) => ({ buildings, rooms, bookings }),
    onRehydrateStorage: () => (_state, error) => {
      if (error) storageWarning = 'Không thể đọc dữ liệu đã lưu. Đang hiển thị dữ liệu demo; kiểm tra localStorage trước khi lưu thay đổi.'
    },
  }))
  try {
    if (storage.getItem('room-finder-estate-v1') === null) {
      const { buildings, rooms, bookings } = store.getState()
      store.setState({ buildings, rooms, bookings })
    }
  } catch {
    storageWarning = 'Không thể đọc hoặc ghi localStorage. Các thay đổi sẽ không được lưu cho đến khi bộ nhớ trình duyệt hoạt động.'
  }
  return store
}

export const useEstateStore = createEstateStore()
