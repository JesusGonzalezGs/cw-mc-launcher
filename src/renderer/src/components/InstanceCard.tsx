import React from 'react'
import { Play, Square, Trash2, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Instance } from '../types'
import { LOADER_NAMES, LOADER_COLORS } from '../constants'

interface Props {
  instance: Instance
  isRunning: boolean
  onPlay: () => void
  onStop: () => void
  onDelete: () => void
}

export default function InstanceCard({ instance, isRunning, onPlay, onStop, onDelete }: Props) {
  const navigate = useNavigate()
  const loaderColor = LOADER_COLORS[instance.modLoader] ?? 'text-gray-400'
  const loaderName = LOADER_NAMES[instance.modLoader] ?? instance.modLoader
  const logo = instance.cfMeta?.logoUrl

  return (
    <div className="bg-gray-800 border border-gray-700 hover:border-purple-500/40 rounded-2xl overflow-hidden transition-all group">
      {/* Banner / Logo */}
      <div className="h-28 bg-gradient-to-br from-gray-700 to-gray-800 relative overflow-hidden">
        {logo && (
          <img
            src={logo}
            alt=""
            className="w-full h-full object-cover opacity-40"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3">
          <p className="text-white font-semibold text-sm truncate">{instance.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gray-400 text-xs">{instance.mcVersion}</span>
            <span className={`text-xs font-medium ${loaderColor}`}>{loaderName}</span>
          </div>
        </div>
        {isRunning && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 border border-green-500/30 rounded-full px-2 py-0.5">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs">Ejecutando</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-sm transition-colors"
          >
            <Square size={14} />
            Detener
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Play size={14} />
            Jugar
          </button>
        )}
        <button
          onClick={() => navigate(`/instances/${instance.id}`)}
          className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-xl transition-colors"
          title="Configurar"
        >
          <Settings size={15} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          title="Eliminar"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
