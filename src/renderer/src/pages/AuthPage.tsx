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
    <div className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">CW-MC Launcher</h1>
          <p className="text-gray-400 text-sm mt-1">Inicia sesión para comenzar</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-3">
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
                  <div className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gray-800 px-3 text-xs text-gray-500">o</span>
                </div>
              </div>

              <button
                onClick={() => setMode('offline')}
                className="w-full flex items-center justify-center gap-3 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors"
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
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
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
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-1">Solo puede entrar a servidores en modo offline</p>
              </div>
              <button
                onClick={handleOffline}
                disabled={loading || !username.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
