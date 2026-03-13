import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'ready'; version: string }

export default function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onAvailable = (info: { version: string }) => {
      setDismissed(false)
      setUpdate({ status: 'available', version: info.version })
    }
    const onProgress = (info: { percent: number }) => {
      setUpdate({ status: 'downloading', percent: info.percent })
    }
    const onReady = (info: { version: string }) => {
      setUpdate({ status: 'ready', version: info.version })
    }

    window.launcher.on('update:available', onAvailable)
    window.launcher.on('update:progress', onProgress)
    window.launcher.on('update:ready', onReady)
    return () => {
      window.launcher.off('update:available', onAvailable)
      window.launcher.off('update:progress', onProgress)
      window.launcher.off('update:ready', onReady)
    }
  }, [])

  if (update.status === 'idle' || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-[#13111f] border border-purple-500/30 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

      {/* Progress bar (solo durante descarga) */}
      {update.status === 'downloading' && (
        <div className="h-0.5 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
            style={{ width: `${update.percent}%` }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Icono */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              update.status === 'ready' ? 'bg-green-500/15' : 'bg-purple-500/15'
            }`}>
              {update.status === 'downloading' ? (
                <Download size={15} className="text-purple-400 animate-bounce" />
              ) : update.status === 'ready' ? (
                <RefreshCw size={15} className="text-green-400" />
              ) : (
                <Download size={15} className="text-purple-400" />
              )}
            </div>

            {/* Texto */}
            <div>
              {update.status === 'available' && (
                <>
                  <p className="text-white text-sm font-semibold">Nueva versión disponible</p>
                  <p className="text-gray-500 text-xs mt-0.5">v{update.version} · Descargando...</p>
                </>
              )}
              {update.status === 'downloading' && (
                <>
                  <p className="text-white text-sm font-semibold">Descargando actualización</p>
                  <p className="text-gray-500 text-xs mt-0.5">{update.percent}% completado</p>
                </>
              )}
              {update.status === 'ready' && (
                <>
                  <p className="text-white text-sm font-semibold">Listo para actualizar</p>
                  <p className="text-gray-500 text-xs mt-0.5">v{update.version} descargada</p>
                </>
              )}
            </div>
          </div>

          {/* Cerrar (solo si no está descargando) */}
          {update.status !== 'downloading' && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-gray-600 hover:text-gray-400 transition-colors rounded shrink-0"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Botón instalar (solo cuando está lista) */}
        {update.status === 'ready' && (
          <button
            onClick={() => window.launcher.updater.install()}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all hover:scale-[1.02] active:scale-95"
          >
            <RefreshCw size={13} />
            Reiniciar e instalar
          </button>
        )}
      </div>
    </div>
  )
}
