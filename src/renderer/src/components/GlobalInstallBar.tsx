import React, { useState } from 'react'
import { Loader2, PackageOpen, X, AlertTriangle } from 'lucide-react'
import { useInstall } from '../context/InstallContext'

export default function GlobalInstallBar() {
  const { installing, progress } = useInstall()
  const [confirming, setConfirming] = useState(false)

  if (installing.length === 0) return null

  const current = installing[0]
  const percent = progress?.percent ?? 0
  const stage = progress?.stage ?? 'Preparando instalación...'
  const isDone = percent >= 100

  const handleConfirmCancel = () => {
    if (current.source === 'mr') {
      window.launcher.mr.cancelInstall()
    } else {
      window.launcher.cf.cancelInstall()
    }
    setConfirming(false)
  }

  return (
    <>
      {/* Modal de confirmación */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-80 shadow-2xl shadow-black/50 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-100">¿Cancelar instalación?</p>
                <p className="text-xs text-gray-500 mt-0.5">Se eliminarán los archivos descargados hasta ahora.</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-gray-800/60 rounded-xl px-3 py-2 truncate">
              {current.name}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Seguir instalando
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      <div className={`shrink-0 border-t bg-gray-900/90 backdrop-blur px-4 py-2 flex items-center gap-3 ${current.source === 'mr' ? 'border-green-500/20' : 'border-purple-500/20'}`}>
        {isDone ? (
          <PackageOpen size={14} className="text-green-400 shrink-0" />
        ) : (
          <Loader2 size={14} className={`animate-spin shrink-0 ${current.source === 'mr' ? 'text-green-400' : 'text-purple-400'}`} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-300 truncate font-medium">{current.name}</span>
            <span className="text-xs text-gray-500 ml-2 shrink-0">{stage}</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-green-500' : current.source === 'mr' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>

        <span className="text-xs text-gray-500 shrink-0 w-8 text-right">{percent}%</span>

        {!isDone && (
          <button
            onClick={() => setConfirming(true)}
            title="Cancelar instalación"
            className="shrink-0 p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </>
  )
}
