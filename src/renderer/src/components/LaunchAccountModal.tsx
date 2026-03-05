import React, { useState } from 'react'
import { Play, Loader2, Monitor } from 'lucide-react'
import Modal from './common/Modal'
import type { Instance } from '../types'

interface Props {
  open: boolean
  instance: Instance | null
  activeAccount: any | null
  onClose: () => void
  onContinue: () => void
  onMsaLogin: (acc: any) => void
  onOfficialLauncher: () => void
}

export default function LaunchAccountModal({
  open,
  instance,
  activeAccount,
  onClose,
  onContinue,
  onMsaLogin,
  onOfficialLauncher,
}: Props) {
  const [msaLoading, setMsaLoading] = useState(false)
  const [officialLoading, setOfficialLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMsaLogin() {
    setError(null)
    setMsaLoading(true)
    try {
      const acc = await window.launcher.auth.loginMsa()
      onMsaLogin(acc)
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión con Microsoft')
    } finally {
      setMsaLoading(false)
    }
  }

  async function handleOfficialLauncher() {
    if (!instance) return
    setError(null)
    setOfficialLoading(true)
    try {
      await window.launcher.instances.launchWithOfficial(instance.id)
      onOfficialLauncher()
    } catch (e: any) {
      setError(e.message ?? 'Error al abrir el launcher oficial')
    } finally {
      setOfficialLoading(false)
    }
  }

  const isBusy = msaLoading || officialLoading

  return (
    <Modal open={open} onClose={onClose} title="¿Cómo quieres jugar?" maxWidth="max-w-sm" icon={Play} iconColor="text-purple-400" iconBg="bg-purple-500/15">
      <div className="px-5 pb-5 space-y-3">
        {instance && (
          <p className="text-xs text-gray-500 -mt-1 truncate">
            Instancia: <span className="text-gray-400">{instance.name}</span>
          </p>
        )}

        {/* Option A: Continue with current account */}
        {activeAccount && (
          <button
            onClick={onContinue}
            disabled={isBusy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400/60 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <Play size={14} className="text-purple-400" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">Continuar como {activeAccount.username}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeAccount.type === 'msa' ? 'Cuenta Microsoft' : 'Cuenta de invitado'}
              </p>
            </div>
          </button>
        )}

        {/* Option B: Sign in with Microsoft */}
        <button
          onClick={handleMsaLogin}
          disabled={isBusy}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/8 hover:bg-blue-500/15 hover:border-blue-400/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
            {msaLoading ? (
              <Loader2 size={14} className="text-blue-400 animate-spin" />
            ) : (
              <svg viewBox="0 0 21 21" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">
              {msaLoading ? 'Esperando inicio de sesión...' : 'Iniciar sesión con Microsoft'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Cuenta premium de Minecraft</p>
          </div>
        </button>

        {/* Option C: Official Minecraft Launcher */}
        <button
          onClick={handleOfficialLauncher}
          disabled={isBusy}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-600/40 bg-gray-700/20 hover:bg-gray-700/40 hover:border-gray-500/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-600/30 flex items-center justify-center shrink-0">
            {officialLoading ? (
              <Loader2 size={14} className="text-gray-400 animate-spin" />
            ) : (
              <Monitor size={14} className="text-gray-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">
              {officialLoading ? 'Abriendo launcher...' : 'Usar launcher oficial'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Abre Minecraft Launcher con este perfil</p>
          </div>
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
