import { createContext, useContext } from 'react'
import type { UploadImage } from './domain/contracts.ts'
import type { createEstateStore, EstateState } from './store.ts'

export interface AppServices {
  estateStore: ReturnType<typeof createEstateStore>
  uploadImage: UploadImage | null
}

const ServicesContext = createContext<AppServices | null>(null)

export const ServicesProvider = ServicesContext.Provider

export function useServices() {
  // Custom Hook lấy dependency dùng chung từ provider gần nhất.
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Application services are missing')
  return services
}

export function useEstateStore<T>(selector: (state: EstateState) => T): T {
  // Selector chỉ đăng ký phần dữ liệu mà component thực sự đọc.
  return useServices().estateStore(selector)
}
