import React, { useEffect, useState } from 'react'
import { LogOut, Download, Check, User, Key } from 'lucide-react'
import type { AppSettings, Account, JavaStatus } from '../types'
import ProgressBar from '../components/ProgressBar'

interface Props {
  onAccountChange: (acc: any) => void
}

export default function SettingsPage({ onAccountChange }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [javaStatuses, setJavaStatuses] = useState<JavaStatus[]>([])
  const [saved, setSaved] = useState(false)

  const load = async () => {
    const [s, accs, javaS] = await Promise.all([
      window.launcher.settings.get(),
      window.launcher.auth.listAccounts(),
      window.launcher.java.getStatus(),
    ])
    setSettings(s)
    setAccounts(accs)
    setJavaStatuses(javaS)
  }

  useEffect(() => {
    load()
    // Polling de estado de Java
    const interval = setInterval(async () => {
      const s = await window.launcher.java.pollStatus()
      setJavaStatuses(s)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  async function handleSave() {
    if (!settings) return
    await window.launcher.settings.save(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout(id: string) {
    await window.launcher.auth.logout(id)
    const active = await window.launcher.auth.getActive()
    if (!active) onAccountChange(null)
    load()
  }

  async function handleSetActive(id: string) {
    await window.launcher.auth.setActive(id)
    const active = await window.launcher.auth.getActive()
    onAccountChange(active)
    load()
  }

  async function handleDownloadJava(version: number) {
    await window.launcher.java.download(version)
  }

  if (!settings) return null

  return (
    <div className="p-6 max-w-xl space-y-8">
      <h1 className="text-xl font-bold text-white">Ajustes</h1>

      {/* Cuentas */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">Cuentas</h2>
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acc.type === 'msa' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                  <User size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{acc.username}</p>
                  <p className="text-gray-500 text-xs">{acc.type === 'msa' ? 'Cuenta Microsoft' : 'Offline'}</p>
                </div>
                {acc.id === settings.activeAccountId && (
                  <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">Activa</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {acc.id !== settings.activeAccountId && (
                  <button
                    onClick={() => handleSetActive(acc.id)}
                    className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    Activar
                  </button>
                )}
                <button
                  onClick={() => handleLogout(acc.id)}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Java */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">Versiones de Java</h2>
        <div className="space-y-2">
          {javaStatuses.map((j) => (
            <div key={j.version} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Java {j.version}</p>
                  <p className="text-gray-500 text-xs">
                    {j.ready ? 'Instalado' : j.status === 'downloading' ? 'Descargando...' : 'No instalado'}
                  </p>
                </div>
                {j.ready ? (
                  <div className="flex items-center gap-1 text-green-400">
                    <Check size={14} />
                    <span className="text-xs">Listo</span>
                  </div>
                ) : j.status !== 'downloading' && (
                  <button
                    onClick={() => handleDownloadJava(j.version)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg text-xs transition-colors"
                  >
                    <Download size={12} />
                    Descargar
                  </button>
                )}
              </div>
              {j.status === 'downloading' && (
                <div className="mt-2">
                  <ProgressBar percent={j.progress} />
                </div>
              )}
              {j.error && <p className="text-red-400 text-xs mt-1">{j.error}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* JVM args globales */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">Configuración de JVM</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Argumentos JVM globales</label>
            <input
              type="text"
              value={settings.jvmArgs}
              onChange={(e) => setSettings({ ...settings, jvmArgs: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* CurseForge API */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">CurseForge API</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
          <div className="relative">
            <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="password"
              value={settings.cfApiToken}
              onChange={(e) => setSettings({ ...settings, cfApiToken: e.target.value })}
              placeholder="$2a$10$..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Necesaria para buscar mods y modpacks en CurseForge</p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Guardar ajustes
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-400 text-sm">
            <Check size={15} />
            Guardado
          </div>
        )}
      </div>
    </div>
  )
}
