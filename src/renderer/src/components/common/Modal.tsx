import React, { useEffect, type ElementType } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
  icon?: ElementType
  iconColor?: string
  iconBg?: string
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  icon: Icon,
  iconColor = 'text-purple-400',
  iconBg = 'bg-purple-500/15',
}: ModalProps) {
  const containerRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" aria-hidden={!open}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidth} rounded-2xl shadow-2xl border bg-[#13111f] border-purple-500/40`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
                <Icon size={14} className={iconColor} aria-hidden="true" />
              </div>
            )}
            <h2 id="modal-title" className="font-semibold text-sm text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg transition-colors hover:bg-purple-500/15 text-gray-400 hover:text-white"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
