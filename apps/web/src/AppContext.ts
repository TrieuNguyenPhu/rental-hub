import { createContext, useContext } from 'react'
import type { UploadImage } from './domain/contracts.ts'
import type { UseBoundStore, StoreApi } from 'zustand'
import type { SharedEstateState } from './domain/contracts.ts'

export interface AppServices {
  estateStore: UseBoundStore<StoreApi<SharedEstateState>>
  uploadImage: UploadImage | null
  maxImageBytes?: number
  sharedData?: boolean
}

const ServicesContext = createContext<AppServices | null>(null)

export const ServicesProvider = ServicesContext.Provider

export function useServices() {
  // Custom Hook lấy dependency dùng chung từ provider gần nhất.
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Application services are missing')
  return services
}

export function useEstateStore<T>(selector: (state: SharedEstateState) => T): T {
  // Selector chỉ đăng ký phần dữ liệu mà component thực sự đọc.
  return useServices().estateStore(selector)
}
