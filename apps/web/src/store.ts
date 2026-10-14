import { create } from 'zustand'
import type { ActionResult, EstateData } from '../../../packages/domain/models.ts'
import { createEstateActions, type EstateActions } from './domain/estateActions.ts'
import { createDemoData } from './domain/demoData.ts'
import type { EstatePersistence } from './domain/contracts.ts'

export interface EstateState extends EstateData, EstateActions {
  storageWarning: string | null
}

export function createEstateStore(persistence: EstatePersistence) {
  const store = create<EstateState>()((set, get) => {
    const commit = (patch: Partial<EstateData>, id: string): ActionResult => {
      set(patch)
      return { ok: true, id }
    }
    return {
      ...(persistence.initialData ?? createDemoData()), storageWarning: persistence.storageWarning,
      ...createEstateActions(get, commit, persistence),
    }
  })
  const persistData = () => {
    const warning = persistence.save(store.getState())
    if (store.getState().storageWarning !== warning) store.setState({ storageWarning: warning })
  }
  store.subscribe((state, previous) => {
    if (state.buildings !== previous.buildings || state.rooms !== previous.rooms || state.bookings !== previous.bookings) persistData()
  })
  if (persistence.fresh) persistData()
  return store
}
