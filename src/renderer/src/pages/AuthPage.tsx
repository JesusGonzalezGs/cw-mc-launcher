import React, { useState } from 'react'
import { AlertCircle, Gamepad2, Shield, Zap, Box } from 'lucide-react'
import type { LauncherUser } from '../types'

interface Props {
  onLogin: (user: LauncherUser) => void
}

export default function AuthPage({ onLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const user = await window.launcher.launcherUser.login()
      onLogin(user)
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión con Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">

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

          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Bienvenido</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Inicia sesión con tu cuenta de Google para continuar
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-white hover:bg-gray-100 text-gray-800 shadow-lg shadow-black/30"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-t-transparent border-gray-500 animate-spin shrink-0" />
            ) : (
              /* Google "G" logo */
              <svg viewBox="0 0 24 24" width="20" height="20" className="shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="flex-1 text-left">
              {loading ? 'Abriendo ventana de login...' : 'Continuar con Google'}
            </span>
          </button>

          {/* Divider + info */}
          <p className="text-center text-[11px] text-gray-600 mt-4 leading-relaxed">
            Tu cuenta Google identifica el launcher. Después podrás configurar<br />
            tus perfiles de Minecraft (cuenta Microsoft u offline).
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
          {[
            { icon: Shield,   text: 'Autenticación segura' },
            { icon: Zap,      text: 'Gestión de mods' },
            { icon: Box,      text: 'Multi-perfil' },
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
