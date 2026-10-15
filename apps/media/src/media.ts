import type { EntityType, ImageAsset } from '../../../packages/domain/models.ts'

export type MediaConfig = {
  host: '127.0.0.1'; port: number
  imagesRoot: string; tempRoot: string; siteOrigin: string
  releaseId: string; readOnly: boolean; development: boolean
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export type ImageTarget = { entityType: EntityType; entityId: string }

export class MediaError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function validTarget(target: ImageTarget): boolean {
  return ['building', 'room'].includes(target.entityType) && /^[A-Za-z0-9_-]{1,64}$/.test(target.entityId)
}

export interface MediaStorage {
  ready: () => Promise<boolean>
  readImage: (requested: string) => Promise<Buffer>
  processImage: (input: Buffer, declaredType: string, target: ImageTarget) => Promise<ImageAsset>
  close: () => void
}

export type OpenMediaStorage = (config: MediaConfig) => Promise<MediaStorage>
