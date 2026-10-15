import { useState } from 'react'
import type { ActionResult } from '../../../../packages/domain/models.ts'
import { Modal } from './Modal'
import { TriangleAlert } from 'lucide-react'

export function ConfirmDialog({
  title,
  description,
  label = 'Xóa',
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  label?: string
  onConfirm: () => ActionResult
  onClose: () => void
}) {
  const [error, setError] = useState('')
  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-body">
        <div className="confirm-symbol">
          <TriangleAlert size={24} />
        </div>
        <p className="confirm-description">{description}</p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Quay lại
        </button>
        <button
          className="button danger"
          onClick={() => {
            const result = onConfirm()
            if (!result.ok) setError(result.error)
          }}
        >
          {label}
        </button>
      </div>
    </Modal>
  )
}
