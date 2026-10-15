import type { ReactNode } from 'react'
import { Inbox, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEstateStore } from '../AppContext'
import '../styles/dataWorkflows.css'

export function PageHeading({
  title,
  subtitle,
  addLabel,
  onAdd,
  disabled,
}: {
  title: string
  subtitle: string
  addLabel?: string
  onAdd?: () => void
  disabled?: boolean
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">QUẢN LÝ BẤT ĐỘNG SẢN</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {onAdd && (
        <button className="button primary" disabled={disabled} onClick={onAdd}>
          <Plus size={18} />
          {addLabel}
        </button>
      )}
    </div>
  )
}
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="search-input">
      <Search size={18} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>Không có dữ liệu</h3>
      <p>{children}</p>
    </div>
  )
}
export function RowActions({
  name,
  onEdit,
  onDelete,
  deleteLabel = 'Xóa',
  disabled = false,
}: {
  name: string
  onEdit: () => void
  onDelete: () => void
  deleteLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="row-actions">
      <button
        disabled={disabled}
        className="icon-button"
        aria-label={`Sửa ${name}`}
        title="Sửa"
        onClick={onEdit}
      >
        <Pencil size={16} />
      </button>
      <button
        disabled={disabled}
        className="icon-button destructive"
        aria-label={`${deleteLabel} ${name}`}
        title={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
export function SuccessNotice({ message }: { message: string }) {
  const warning = useEstateStore((state) => state.storageWarning)
  return message && !warning ? (
    <div role="status" className="notice success">
      {message}
    </div>
  ) : null
}
