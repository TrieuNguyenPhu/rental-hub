import { create } from 'zustand'
import type { StateStorage } from 'zustand/middleware'
import type { ActionResult, BookingInput, BuildingInput, EstateData, RoomInput } from '../types/index.ts'
import { createDemoData } from '../data/demo.ts'
import { readEstateData, validImages, validateBooking, validateBuilding, validateRoom } from '../utils/validation.ts'

interface EstateStore extends EstateData {
  storageWarning: string | null
  exportData: () => string
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
const browserStorage: StateStorage = {
  getItem: name => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: name => localStorage.removeItem(name),
}

export function createEstateStore(storage: StateStorage = browserStorage) {
  const storageKey = 'room-finder-estate-v1'
  let raw: string | null = null
  let blocked = false
  let exported = false
  let storageWarning: string | null = null
  let initialData: EstateData = { buildings: [], rooms: [], bookings: [] }
  try {
    const stored = storage.getItem(storageKey)
    if (stored !== null && typeof stored !== 'string') throw new Error('Storage must be synchronous')
    raw = stored
    initialData = raw === null ? createDemoData() : readEstateData(JSON.parse(raw))
  } catch {
    blocked = true
    storageWarning = 'Không thể đọc dữ liệu đã lưu. Dữ liệu gốc được giữ nguyên; hãy xuất dữ liệu trước khi khôi phục demo.'
  }
  const serialize = (data: EstateData) => JSON.stringify({ state: { buildings: data.buildings, rooms: data.rooms, bookings: data.bookings }, version: 1 })
  const store = create<EstateStore>()((set, get) => {
    const commit = (patch: Partial<EstateData>, id: string): ActionResult => {
      exported = false
      set(patch)
      return { ok: true, id }
    }
    return {
      ...initialData, storageWarning,
      exportData: () => { exported = true; return blocked && raw !== null ? raw : serialize(get()) },
      addBuilding: input => {
        if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
        const error = validateBuilding(input, get())
        if (error) return failure(error)
        const id = crypto.randomUUID()
        return commit({ buildings: [...get().buildings, { ...input, images: input.images ?? [], name: input.name.trim(), address: input.address.trim(), city: input.city.trim(), id }] }, id)
      },
      updateBuilding: (id, input) => {
        if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
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
        if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
        const error = validateRoom(input, get())
        if (error) return failure(error)
        const id = crypto.randomUUID()
        return commit({ rooms: [...get().rooms, { ...input, images: input.images ?? [], roomNumber: input.roomNumber.trim(), id }] }, id)
      },
      updateRoom: (id, input) => {
        if (!validImages(input.images ?? [])) return failure('Ảnh không hợp lệ.')
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
      resetDemoData: () => {
        if (!exported) return failure('Hãy xuất dữ liệu trước khi khôi phục demo.')
        blocked = false
        exported = false
        return commit(createDemoData(), 'demo')
      },
    }
  })
  const persistData = () => {
    if (blocked) return
    try {
      storage.setItem(storageKey, serialize(store.getState()))
      if (store.getState().storageWarning) store.setState({ storageWarning: null })
    } catch {
      store.setState({ storageWarning: 'Không thể ghi localStorage. Thay đổi chỉ còn trong bộ nhớ và sẽ mất khi tải lại trang.' })
    }
  }
  store.subscribe((state, previous) => {
    if (state.buildings !== previous.buildings || state.rooms !== previous.rooms || state.bookings !== previous.bookings) persistData()
  })
  if (raw === null) persistData()
  return store
}

export const useEstateStore = createEstateStore()
export const getStorageWarning = () => useEstateStore.getState().storageWarning
