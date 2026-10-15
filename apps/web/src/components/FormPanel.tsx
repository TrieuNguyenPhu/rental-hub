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
  onSubmit: (data: FormData) => ActionResult
}) {
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // FormData chỉ đọc các trường khi lưu; không cần state cho từng ô nhập.
    const result = onSubmit(new FormData(event.currentTarget))
    if (!result.ok) setError(result.error)
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
          <button type="submit" className="button primary">
            Lưu thay đổi
          </button>
        </div>
      </form>
    </Modal>
  )
}
