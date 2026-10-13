import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    dialog?.showModal()
    dialog?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select, textarea')?.focus()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Đóng hộp thoại" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>
}
