import type { ActionResult, EntityType, EstateData, ImageAsset } from '../../../../packages/domain/models.ts'
import type { EstateActions } from './estateActions.ts'

export type SharedEstateState = EstateData & { storageWarning: string | null } & {
  [K in keyof EstateActions]: K extends 'exportData' ? EstateActions[K] : (...args: Parameters<EstateActions[K]>) => ActionResult | Promise<ActionResult>
}

export interface EstateStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
}

export interface EstatePersistence {
  initialData: EstateData | null
  storageWarning: string | null
  fresh: boolean
  exportData: (data: EstateData) => string
  save: (data: EstateData) => string | null
  reset: () => void
}

export type UploadImage = (
  file: File,
  entityType: EntityType,
  entityId: string,
  signal: AbortSignal,
) => Promise<ImageAsset>
