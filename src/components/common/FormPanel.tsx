import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ActionResult } from '../../types'
import { Modal } from './Modal'

export function FormPanel({ title, children, onClose, onSubmit }: { title: string; children: ReactNode; onClose: () => void; onSubmit: (data: FormData) => ActionResult }) {
  const [error, setError] = useState('')
  return <Modal title={title} onClose={onClose}>
    <form noValidate onSubmit={event => {
      event.preventDefault()
      const result = onSubmit(new FormData(event.currentTarget))
      if (!result.ok) setError(result.error)
    }}>
      <div className="form-body"><p className="form-hint">Các trường có dấu <span aria-hidden="true">*</span> là bắt buộc.</p><div className="form-grid">{children}</div>{error && <div role="alert" className="notice error">{error}</div>}</div>
      <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>Đóng</button><button type="submit" className="button primary">Lưu thay đổi</button></div>
    </form>
  </Modal>
}

