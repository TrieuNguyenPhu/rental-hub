import { useEffect, useId, useRef, useState } from 'react'
import type { EntityType, ImageAsset } from '../../types'
import { validImages } from '../../utils/validation'

export function ImageUploader({ entityType, entityId, images, onChange }: { entityType: EntityType; entityId: string; images: ImageAsset[]; onChange: (images: ImageAsset[]) => void }) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [failedImages, setFailedImages] = useState<string[]>([])
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  return <section className="image-uploader full-width" aria-label="Ảnh bất động sản" aria-busy={busy}>
    <div className="image-upload-heading"><strong>Ảnh {entityType === 'building' ? 'tòa nhà' : 'phòng'}</strong><span>{images.length} / 5 ảnh</span></div>
    <label htmlFor={inputId}>Chọn ảnh</label>
    <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || images.length >= 5} aria-describedby={`${inputId}-hint ${inputId}-error`} onChange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (!file || busy || images.length >= 5) return
      setError('')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Chọn ảnh JPEG, PNG hoặc WebP tĩnh.'); return }
      if (file.size > 10 * 1024 * 1024) { setError('Ảnh phải nhỏ hơn hoặc bằng 10 MiB.'); return }
      setBusy(true)
      const upload = new AbortController()
      controller.current = upload
      try {
        const response = await fetch(`/api/images?${new URLSearchParams({ entityType, entityId })}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file, signal: upload.signal })
        const asset = await response.json().catch(() => null)
        if (upload.signal.aborted) return
        if (!response.ok) throw new Error(typeof asset?.message === 'string' ? asset.message : `Không thể tải ảnh (HTTP ${response.status}). Vui lòng thử lại.`)
        const uploaded = [asset]
        if (!validImages(uploaded)) throw new Error('Phản hồi ảnh không hợp lệ. Vui lòng thử lại.')
        onChange([...images, ...uploaded])
      } catch (failure) {
        if (upload.signal.aborted) return
        setError(failure instanceof TypeError ? 'Không thể tải ảnh. Kiểm tra kết nối và thử lại.' : failure instanceof Error ? failure.message : 'Không thể tải ảnh. Vui lòng thử lại.')
      } finally { setBusy(false) }
    }} />
    <p id={`${inputId}-hint`} className="field-hint">JPEG, PNG, WebP tĩnh · tối đa 10 MiB, 20 MP · rộng từ 1200px. Bản 1200px cao tối đa 16383px. Ảnh được lưu ngay; bỏ ảnh chỉ gỡ liên kết.</p>
    {busy && <p role="status" className="field-hint">Đang tải và xử lý ảnh… Đóng hộp thoại sẽ hủy ảnh đang tải.</p>}
    <div id={`${inputId}-error`}>{error && <p role="alert" className="notice error">{error}</p>}</div>
    <div className="image-gallery">{images.map((image, index) => <div className="image-tile" key={image.id}>
      <a href={image.url1200} target="_blank" rel="noreferrer" aria-label={`Xem ảnh ${index + 1} · 1200px`}>
        {failedImages.includes(image.id) ? <p className="field-hint">Không tải được ảnh.</p> : <img src={image.url600} width={image.width600} height={image.height600} alt={`Ảnh ${entityType === 'building' ? 'tòa nhà' : 'phòng'} ${index + 1}`} onError={() => setFailedImages(previous => [...previous, image.id])} />}
        <span>Xem 1200px</span>
      </a>
      <button type="button" className="button secondary" disabled={busy} aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => {
        try { onChange(images.filter(item => item.id !== image.id)); setError('') }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể bỏ ảnh.') }
      }}>Bỏ ảnh</button>
    </div>)}</div>
  </section>
}
