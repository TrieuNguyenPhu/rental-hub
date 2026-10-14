import type { UploadImage } from '../domain/contracts.ts'
import { validImages } from '../domain/validation.ts'

export const uploadHttpImage: UploadImage = async (file, entityType, entityId, signal) => {
  const response = await fetch(`/api/images?${new URLSearchParams({ entityType, entityId })}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file, signal })
  const asset = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof asset?.message === 'string' ? asset.message : `Không thể tải ảnh (HTTP ${response.status}). Vui lòng thử lại.`)
  if (!validImages([asset])) throw new Error('Phản hồi ảnh không hợp lệ. Vui lòng thử lại.')
  return asset
}
