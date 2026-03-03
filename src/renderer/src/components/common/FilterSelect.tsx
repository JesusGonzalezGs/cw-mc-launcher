import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ElementType } from 'react'

export interface FilterOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  placeholder?: string
  icon?: ElementType
  fullWidth?: boolean
  disabled?: boolean
}

export default function FilterSelect({ value, onChange, options, placeholder = 'Seleccionar', icon: Icon, fullWidth, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listboxId = useRef(`listbox-${Math.random().toString(36).slice(2)}`).current

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)
  const isDefault = !value

  return (
    <div ref={ref} className={`relative${fullWidth ? ' w-full' : ''}`} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all whitespace-nowrap select-none bg-gray-800/80 border-gray-700/80 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'
        } ${open ? 'border-purple-500/50 ring-1 ring-purple-500/20' : ''} ${
          isDefault ? 'text-gray-500' : 'text-gray-200'
        }${fullWidth ? ' w-full justify-between' : ''}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && (
            <Icon
              size={13}
              aria-hidden="true"
              className={`shrink-0 ${isDefault ? 'text-gray-600' : 'text-purple-400'}`}
            />
          )}
          <span className={`truncate${fullWidth ? '' : ' max-w-[130px]'}`}>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`shrink-0 ml-0.5 transition-transform duration-200 text-gray-600 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          className="absolute top-full mt-2 z-50 min-w-full w-max max-w-[240px] max-h-64 overflow-y-auto rounded-xl border list-none p-0 m-0 bg-gray-800 border-gray-700/60 shadow-2xl shadow-black/50"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onChange(opt.value)
                  setOpen(false)
                }
              }}
              tabIndex={0}
              className={`px-3 py-2 text-sm transition-colors cursor-pointer ${
                opt.value === value
                  ? 'bg-purple-600/20 text-purple-300 font-medium'
                  : opt.value === ''
                    ? 'text-gray-500 hover:bg-gray-700/40'
                    : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
