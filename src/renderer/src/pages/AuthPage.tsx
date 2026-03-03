import React, { useState } from 'react'
import { User, LogIn, AlertCircle } from 'lucide-react'

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
    <div className="flex-1 flex items-center justify-center relative bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-900/50">
            <span className="text-4xl font-black text-white">C</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-300 via-pink-300 to-purple-200 bg-clip-text text-transparent">
            CW-MC Launcher
          </h1>
          <p className="text-gray-500 text-sm mt-1.5">Inicia sesión para comenzar</p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/30 rounded-2xl p-6 space-y-3 shadow-xl">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {mode === 'choose' && (
            <>
              <button
                onClick={handleMsa}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                <LogIn size={18} />
                {loading ? 'Abriendo ventana de login...' : 'Iniciar sesión con Microsoft'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700/60" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gray-800/90 px-3 text-xs text-gray-500">o</span>
                </div>
              </div>

              <button
                onClick={() => setMode('offline')}
                className="w-full flex items-center justify-center gap-3 py-3 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50 rounded-xl font-medium transition-all"
              >
                <User size={18} />
                Modo offline (sin cuenta)
              </button>
            </>
          )}

          {mode === 'offline' && (
            <>
              <button
                onClick={() => setMode('choose')}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                ← Volver
              </button>
              <div>
                <label htmlFor="username" className="block text-sm text-gray-400 mb-2">
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
                  className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-1">Solo puede entrar a servidores en modo offline</p>
              </div>
              <button
                onClick={handleOffline}
                disabled={loading || !username.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-purple-900/25"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                    Entrando...
                  </>
                ) : 'Entrar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
