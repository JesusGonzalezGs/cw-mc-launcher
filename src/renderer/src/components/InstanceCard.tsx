import React, { useState, useRef, useEffect } from 'react'
import { Play, Square, MoreVertical, Copy, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Instance } from '../types'
import { LOADER_NAMES } from '../constants'

const LOADER_BADGE_COLORS: Record<string, string> = {
  vanilla:  'bg-green-500/15 text-green-300 border-green-500/25',
  fabric:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  neoforge: 'bg-red-500/15 text-red-300 border-red-500/25',
}

interface Props {
  instance: Instance
  isRunning: boolean
  onPlay: () => void
  onStop: () => void
  onDelete: () => void
  onClone: () => void
}

export default function InstanceCard({ instance, isRunning, onPlay, onStop, onDelete, onClone }: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const loaderName = LOADER_NAMES[instance.modLoader] ?? instance.modLoader
  const loaderBadge = LOADER_BADGE_COLORS[instance.modLoader] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25'
  const logo = instance.cfMeta?.logoUrl

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="rounded-2xl border flex flex-col shadow-md hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25 hover:border-purple-400/50 transition-all relative">

      {/* Banner — clickable to open detail */}
      <div
        className="h-28 relative overflow-hidden flex-shrink-0 rounded-t-2xl cursor-pointer"
        onClick={() => navigate(`/instances/${instance.id}`)}
      >
        {logo && (
          <img
            src={logo}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 to-transparent" />

        {/* Running badge */}
        {isRunning && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-medium">Ejecutando</span>
          </div>
        )}

        {/* Name + badges at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
          <p className="text-white font-bold text-sm truncate leading-tight">{instance.name}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
              {instance.mcVersion}
            </span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs border font-medium ${loaderBadge}`}>
              {loaderName}
            </span>
          </div>
        </div>
      </div>

      {/* 3-dot menu — positioned on card, outside banner overflow */}
      <div
        className="absolute top-2 right-2 z-10"
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-gray-300 hover:text-white transition-colors"
          title="Opciones"
        >
          <MoreVertical size={15} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border bg-gray-900/95 border-purple-500/20 shadow-xl shadow-black/30 backdrop-blur-sm overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); onClone() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-purple-500/10 transition-colors"
            >
              <Copy size={13} />
              Clonar
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-2.5">
        {isRunning ? (
          <button
            onClick={onStop}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium transition-colors"
          >
            <Square size={13} />
            Detener
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <Play size={13} />
            Jugar
          </button>
        )}
      </div>
    </div>
  )
}
