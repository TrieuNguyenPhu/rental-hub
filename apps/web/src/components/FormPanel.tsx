import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { ActionResult } from '../../../../packages/domain/models.ts'
import { Modal } from './Modal'

export function FormPanel({
  title,
  children,
  onClose,
  onSubmit,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  onSubmit: (data: FormData) => ActionResult | Promise<ActionResult>
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    // FormData chỉ đọc các trường khi lưu; không cần state cho từng ô nhập.
    try {
      const result = await onSubmit(new FormData(event.currentTarget))
      if (!result.ok) setError(result.error)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể lưu dữ liệu.')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit}>
        <div className="form-body">
          <p className="form-hint">
            Các trường có dấu <span aria-hidden="true">*</span> là bắt buộc.
          </p>
          <div className="form-grid">{children}</div>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Đóng
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            Lưu thay đổi
          </button>
        </div>
      </form>
    </Modal>
  )
}
