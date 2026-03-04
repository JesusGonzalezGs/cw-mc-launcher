import React, { useState } from 'react'
import { User, LogIn, AlertCircle, ArrowLeft, Gamepad2, Shield, Zap } from 'lucide-react'

interface Props {
  onLogin: (account: any) => void
}

export default function AuthPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'choose' | 'offline'>('choose')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleMsa() {
    setLoading(true)
    setError('')
    try {
      const account = await window.launcher.auth.loginMsa()
      onLogin(account)
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión con Microsoft')
    } finally {
      setLoading(false)
    }
  }

  async function handleOffline() {
    if (!username.trim()) return
    setLoading(true)
    setError('')
    try {
      const account = await window.launcher.auth.loginOffline(username.trim())
      onLogin(account)
    } catch (e: any) {
      setError(e.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#1a1035] via-[#0f0b20] to-[#0a0814]">

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-20 bg-purple-600" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-15 bg-pink-600" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-10 bg-indigo-700" />
      </div>

      {/* Grid overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(90deg, #a855f7 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">

        {/* Icon + title */}
        <div className="w-20 h-20 mb-5 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-900/60 rotate-3">
          <Gamepad2 size={36} className="text-white -rotate-3" />
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-300 via-pink-300 to-purple-200 bg-clip-text text-transparent mb-1.5">
          CW-MC Launcher
        </h1>
        <p className="text-gray-500 text-sm mb-8">Tu launcher de Minecraft favorito</p>

        {/* Card */}
        <div className="w-full bg-[#0f0d1a]/90 border border-purple-500/20 rounded-2xl p-6 shadow-2xl shadow-black/60 backdrop-blur-sm">

          {/* Heading */}
          <div className="mb-5">
            <h2 className="text-base font-semibold text-white">
              {mode === 'choose' ? 'Iniciar sesión' : 'Modo offline'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === 'choose'
                ? 'Elige cómo quieres entrar al launcher'
                : 'Introduce tu nombre de usuario para continuar'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {mode === 'choose' && (
            <div className="space-y-3">
              {/* Microsoft */}
              <button
                onClick={handleMsa}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-[#2f6feb] hover:bg-[#388af5] text-white shadow-lg shadow-blue-900/30"
              >
                <svg width="16" height="16" viewBox="0 0 21 21" fill="none" className="shrink-0">
                  <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                  <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                  <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                  <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                </svg>
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
                  <span className="bg-[#0f0d1a] px-3 text-[11px] text-gray-600">o continúa sin cuenta</span>
                </div>
              </div>

              {/* Offline */}
              <button
                onClick={() => setMode('offline')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm border transition-all hover:scale-[1.01] active:scale-[0.99] border-gray-700/80 text-gray-300 hover:bg-white/5 hover:border-gray-600 hover:text-white"
              >
                <User size={15} className="shrink-0 text-gray-500" />
                <span className="flex-1 text-left">Modo offline (sin cuenta)</span>
              </button>
            </div>
          )}

          {mode === 'offline' && (
            <div className="space-y-4">
              <button
                onClick={() => { setMode('choose'); setError('') }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft size={13} />
                Volver
              </button>

              <div>
                <label htmlFor="username" className="block text-xs font-medium text-gray-400 mb-1.5">
                  Nombre de usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOffline()}
                  placeholder="Steve"
                  maxLength={16}
                  className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:ring-offset-0 transition-all"
                  autoFocus
                />
                <p className="text-[11px] text-gray-700 mt-1">Máximo 16 caracteres · solo servidores offline</p>
              </div>

              <button
                onClick={handleOffline}
                disabled={loading || !username.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/30"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    Entrar
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
          {[
            { icon: Shield,   text: 'Autenticación oficial' },
            { icon: Zap,      text: 'Gestión de mods' },
            { icon: Gamepad2, text: 'CurseForge integrado' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Icon size={11} className="text-purple-500/60" />
              {text}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
