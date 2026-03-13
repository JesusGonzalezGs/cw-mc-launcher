import React, { useEffect, useState } from 'react'
import {
  Plus, User, LogOut, AlertCircle, ArrowLeft,
  Monitor, WifiOff, Check, UserPlus, LogIn,
} from 'lucide-react'
import type { Account, LauncherUser } from '../types'
import Modal from '../components/common/Modal'

interface Props {
  launcherUser: LauncherUser
  onSelect: (account: Account & { id: string }) => void
  onLogoutGoogle: () => void
}

type AddMode = null | 'choose' | 'offline'

export default function ProfileSelectPage({ launcherUser, onSelect, onLogoutGoogle }: Props) {
  const [accounts, setAccounts] = useState<(Account & { id: string })[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [username, setUsername] = useState('')
  const [licenseAccepted, setLicenseAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  async function loadAccounts() {
    const accs = await window.launcher.auth.listAccounts()
    setAccounts(accs)
    // Auto-seleccionar la cuenta activa si existe
    const active = await window.launcher.auth.getActive()
    if (active) setSelected(active.id)
    else if (accs.length === 1) setSelected(accs[0].id)
  }

  useEffect(() => { loadAccounts() }, [])

  async function handleAddMsa() {
    setLoading(true)
    setError('')
    try {
      const account = await window.launcher.auth.loginMsa()
      await loadAccounts()
      setSelected(account.uuid ?? account.id)
      setAddMode(null)
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión con Microsoft')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddOffline() {
    if (!username.trim() || !licenseAccepted) return
    setLoading(true)
    setError('')
    try {
      const account = await window.launcher.auth.loginOffline(username.trim())
      await loadAccounts()
      setSelected(account.uuid ?? account.id)
      setAddMode(null)
      setUsername('')
      setLicenseAccepted(false)
    } catch (e: any) {
      setError(e.message ?? 'Error al crear perfil offline')
    } finally {
      setLoading(false)
    }
  }

  async function handlePlay() {
    if (!selected) return
    await window.launcher.auth.setActive(selected)
    const active = await window.launcher.auth.getActive()
    if (active) onSelect(active)
  }

  async function handleLogoutGoogle() {
    await window.launcher.launcherUser.logout()
    onLogoutGoogle()
  }

  async function handleRemoveProfile(id: string) {
    await window.launcher.auth.logout(id)
    if (selected === id) setSelected(null)
    await loadAccounts()
  }

  const selectedAccount = accounts.find((a) => a.id === selected)

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      {/* Grid overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(90deg, #a855f7 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 w-full max-w-lg px-6 py-8 flex flex-col gap-5">

        {/* Google user header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {launcherUser.picture ? (
              <img
                src={launcherUser.picture}
                alt={launcherUser.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/30"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-white leading-none">{launcherUser.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{launcherUser.email}</p>
            </div>
          </div>
          <button
            onClick={() => setLogoutConfirm(true)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            <LogOut size={12} />
            Salir
          </button>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
            Elige tu perfil de Minecraft
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            {accounts.length === 0
              ? 'Aún no tienes ningún perfil. Añade uno para empezar.'
              : 'Selecciona con qué cuenta quieres jugar.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Profiles list */}
        {accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelected(acc.id)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all group',
                  selected === acc.id
                    ? 'bg-purple-500/15 border-purple-500/50 shadow-sm shadow-purple-900/20'
                    : 'bg-[#0f0d1a]/80 border-gray-700/60 hover:border-purple-500/30 hover:bg-purple-500/5',
                ].join(' ')}
              >
                {/* Avatar */}
                <div className={[
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative',
                  acc.type === 'msa' ? 'bg-blue-600/20' : 'bg-purple-600/20',
                ].join(' ')}>
                  {acc.skinUrl ? (
                    <img
                      src={`https://mc-heads.net/avatar/${acc.uuid}/40`}
                      alt={acc.username}
                      className="w-8 h-8 rounded-lg object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <User size={18} className={acc.type === 'msa' ? 'text-blue-400' : 'text-purple-400'} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{acc.username}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {acc.type === 'msa' ? (
                      <>
                        <Monitor size={10} className="text-blue-400/70 shrink-0" />
                        <span className="text-[11px] text-blue-400/70">Cuenta Microsoft</span>
                      </>
                    ) : (
                      <>
                        <WifiOff size={10} className="text-purple-400/70 shrink-0" />
                        <span className="text-[11px] text-purple-400/70">Offline</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Selected indicator */}
                {selected === acc.id && (
                  <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-white" />
                  </div>
                )}

                {/* Remove btn */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveProfile(acc.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Eliminar perfil"
                >
                  <LogOut size={12} />
                </button>
              </button>
            ))}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            onClick={() => { setAddMode('choose'); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-purple-500/30 text-purple-400/70 hover:text-purple-300 hover:border-purple-500/50 hover:bg-purple-500/5 text-sm transition-all"
          >
            <Plus size={14} />
            Añadir perfil
          </button>

          {accounts.length > 0 && (
            <button
              onClick={handlePlay}
              disabled={!selected}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-900/30"
            >
              {selectedAccount ? <>Jugar como {selectedAccount.username} →</> : <>Selecciona un perfil</>}
            </button>
          )}
        </div>

        {accounts.length === 0 && (
          <p className="text-center text-xs text-gray-600">
            Añade al menos un perfil para poder jugar.
          </p>
        )}
      </div>

      {/* ── Modal: añadir perfil ───────────────────────────────────────────── */}
      <Modal
        open={addMode !== null}
        onClose={() => { setAddMode(null); setError(''); setUsername(''); setLicenseAccepted(false) }}
        title={addMode === 'offline' ? 'Perfil offline' : 'Añadir perfil'}
        maxWidth="max-w-sm"
        icon={UserPlus}
      >
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Paso 1: elegir tipo */}
        {addMode === 'choose' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-4">Elige cómo quieres entrar al launcher</p>

            {/* Microsoft */}
            <button
              onClick={handleAddMsa}
              disabled={loading}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-[#2f6feb] hover:bg-[#388af5] text-white shadow-lg shadow-blue-900/30"
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin shrink-0" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 21 21" fill="none" className="shrink-0">
                  <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                  <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                  <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                  <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                </svg>
              )}
              <span className="flex-1 text-left">
                {loading ? 'Abriendo ventana de login...' : 'Iniciar sesión con Microsoft'}
              </span>
            </button>

            {/* Divider */}
            <div className="relative py-0.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#13111f] px-3 text-[11px] text-gray-600">o continúa sin cuenta</span>
              </div>
            </div>

            {/* Offline */}
            <button
              onClick={() => { setAddMode('offline'); setError('') }}
              disabled={loading}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm border transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] border-gray-700/80 text-gray-300 hover:bg-white/5 hover:border-gray-600 hover:text-white"
            >
              <WifiOff size={15} className="shrink-0 text-gray-500" />
              <span className="flex-1 text-left">Modo offline (sin cuenta)</span>
            </button>
          </div>
        )}

        {/* Paso 2: formulario offline */}
        {addMode === 'offline' && (
          <div className="space-y-4">
            <button
              onClick={() => { setAddMode('choose'); setError(''); setUsername(''); setLicenseAccepted(false) }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft size={13} />
              Volver
            </button>

            <div className="flex items-start gap-2.5 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl">
              <AlertCircle size={14} className="text-yellow-500/80 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-500/70 leading-relaxed">
                El modo offline está pensado únicamente para jugadores que ya poseen una copia legítima de Minecraft. No permite acceso a servidores online.
              </p>
            </div>

            <div>
              <label htmlFor="offline-username" className="block text-xs font-medium text-gray-400 mb-1.5">
                Nombre de usuario
              </label>
              <input
                id="offline-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && licenseAccepted && handleAddOffline()}
                placeholder="Steve"
                maxLength={16}
                autoFocus
                className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
              />
              <p className="text-[11px] text-gray-700 mt-1">Máximo 16 caracteres · solo servidores offline</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <div className="relative mt-0.5 shrink-0">
                <input type="checkbox" checked={licenseAccepted} onChange={(e) => setLicenseAccepted(e.target.checked)} className="sr-only" />
                <div className={`w-4 h-4 rounded border transition-all ${licenseAccepted ? 'bg-purple-600 border-purple-500' : 'bg-gray-900 border-gray-700 group-hover:border-gray-500'}`}>
                  {licenseAccepted && (
                    <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">
                Confirmo que poseo una licencia válida de Minecraft y que usaré el modo offline bajo mi propia responsabilidad.
              </span>
            </label>

            <button
              onClick={handleAddOffline}
              disabled={loading || !username.trim() || !licenseAccepted}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/30"
            >
              {loading ? (
                <><span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" /> Creando...</>
              ) : (
                <><LogIn size={15} /> Entrar</>
              )}
            </button>
          </div>
        )}
      </Modal>

      {/* Logout confirm overlay */}
      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12101e] border border-purple-500/20 rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-white font-semibold mb-2">¿Cerrar sesión?</h3>
            <p className="text-gray-400 text-sm mb-5">
              Volverás a la pantalla de inicio de sesión con Google.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogoutGoogle}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
