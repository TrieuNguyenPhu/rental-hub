import { create } from 'zustand'
import type { ActionResult, BookingInput, BuildingInput, EstateData, RoomInput } from '../../../../packages/domain/models.ts'
import type { SharedEstateState } from '../domain/contracts.ts'
import { readEstateData } from './estatePersistence.ts'

type Snapshot = { data: EstateData; version: string | null; message?: string; result?: ActionResult }

export async function createRemoteEstateStore() {
  const initialResponse = await fetch('/api/estate', { cache: 'no-store' })
  if (!initialResponse.ok) throw new Error(`Không tải được dữ liệu chung (HTTP ${initialResponse.status}).`)
  const initial = await initialResponse.json() as Snapshot
  const data = readEstateData({ version: 1, state: initial.data })
  let version = initial.version
  let exported = false
  const store = create<SharedEstateState>()((set, get) => {
    const mutate = async (action: string, id?: string, input?: BuildingInput | RoomInput | BookingInput): Promise<ActionResult> => {
      try {
        const response = await fetch('/api/estate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, id, input, version }),
        })
        const result = await response.json() as Snapshot
        if (result.data) {
          set(readEstateData({ version: 1, state: result.data }))
          version = result.version
        }
        if (!response.ok) return { ok: false, error: result.message ?? `Không thể lưu dữ liệu (HTTP ${response.status}).` }
        exported = false
        return result.result ?? { ok: false, error: 'Phản hồi không hợp lệ.' }
      } catch {
        return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' }
      }
    }
    return {
      ...data, storageWarning: null,
      exportData: () => {
        exported = true
        const { buildings, rooms, bookings } = get()
        return JSON.stringify({ version: 1, state: { buildings, rooms, bookings } })
      },
      resetDemoData: () => exported ? mutate('resetDemoData') : Promise.resolve({ ok: false, error: 'Hãy xuất dữ liệu trước khi khôi phục demo.' }),
      addBuilding: (input) => mutate('addBuilding', undefined, input),
      updateBuilding: (id, input) => mutate('updateBuilding', id, input),
      deleteBuilding: (id) => mutate('deleteBuilding', id),
      addRoom: (input) => mutate('addRoom', undefined, input),
      updateRoom: (id, input) => mutate('updateRoom', id, input),
      deleteRoom: (id) => mutate('deleteRoom', id),
      addBooking: (input) => mutate('addBooking', undefined, input),
      updateBooking: (id, input) => mutate('updateBooking', id, input),
      cancelBooking: (id) => mutate('cancelBooking', id),
    }
  })
  return store
}
