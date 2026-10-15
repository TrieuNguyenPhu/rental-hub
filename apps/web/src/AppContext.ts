import { createContext, useContext } from 'react'
import type { AdminSession, UploadImage } from './domain/contracts.ts'
import type { createEstateStore, EstateState } from './store.ts'

export interface AppServices {
  estateStore: ReturnType<typeof createEstateStore>
  admin: AdminSession
  uploadImage: UploadImage
}

const ServicesContext = createContext<AppServices | null>(null)

export const ServicesProvider = ServicesContext.Provider

export function useServices() {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Application services are missing')
  return services
}

export function useEstateStore<T>(selector: (state: EstateState) => T): T {
  return useServices().estateStore(selector)
}
