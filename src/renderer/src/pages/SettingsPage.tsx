import React, { useEffect, useState } from 'react'
import { LogOut, Check, User, Key, Settings, ExternalLink, Rocket, Monitor, Package, Leaf } from 'lucide-react'
import type { AppSettings, Account } from '../types'
import Modal from '../components/common/Modal'

interface Props {
  onAccountChange: (acc: any) => void
}

const CARD = 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/25'

export default function SettingsPage({ onAccountChange }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saved, setSaved] = useState(false)
  const [pendingLogout, setPendingLogout] = useState<Account | null>(null)

  const load = async () => {
    const [s, accs] = await Promise.all([
      window.launcher.settings.get(),
      window.launcher.auth.listAccounts(),
    ])
    setSettings(s)
    setAccounts(accs)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!settings) return
    await window.launcher.settings.save(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    if (!pendingLogout) return
    await window.launcher.auth.logout(pendingLogout.id)
    setPendingLogout(null)
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

  if (!settings) return null

  return (
    <>
    <div className="relative min-h-full">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 md:px-6 pt-8 pb-16 space-y-8">

        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 bg-purple-500/10 border-purple-500/25 text-purple-300">
            <Settings size={11} />
            Configuración
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Ajustes
          </h1>
        </div>

        {/* ── Cuentas ───────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Cuentas</h2>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className={`flex items-center justify-between ${CARD} rounded-xl px-4 py-3`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acc.type === 'msa' ? 'bg-blue-600' : 'bg-purple-600/40'}`}>
                    <User size={15} className="text-white" />
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
                    onClick={() => setPendingLogout(acc)}
                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                    title="Cerrar sesión"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-gray-600 text-sm py-2">No hay cuentas guardadas.</p>
            )}
          </div>
        </section>

        {/* ── JVM args ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Configuración de JVM</h2>
          <div className={`${CARD} rounded-xl p-4`}>
            <label className="block text-sm text-gray-400 mb-1.5">Argumentos JVM globales</label>
            <input
              type="text"
              value={settings.jvmArgs}
              onChange={(e) => setSettings({ ...settings, jvmArgs: e.target.value })}
              placeholder="-Xmx4G -XX:+UseG1GC"
              className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
            <p className="text-xs text-gray-600 mt-1.5">Se aplica a todas las instancias salvo que se indique lo contrario</p>
          </div>
        </section>

        {/* ── CurseForge API ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">CurseForge API</h2>
          <div className={`${CARD} rounded-xl p-4`}>
            <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={settings.cfApiToken}
                onChange={(e) => setSettings({ ...settings, cfApiToken: e.target.value })}
                placeholder="$2a$10$..."
                className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl pl-9 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
              />
            </div>
            <p className="text-xs text-gray-600 mt-1.5">Necesaria para buscar mods y modpacks en CurseForge</p>
          </div>
          <p className="text-[11px] text-gray-700 mt-2 flex items-center gap-1">
            Contenido proporcionado por
            <button
              onClick={() => window.launcher.openExternal?.('https://www.curseforge.com')}
              className="inline-flex items-center gap-0.5 text-gray-600 hover:text-orange-400 transition-colors"
            >
              CurseForge
              <ExternalLink size={10} />
            </button>
          </p>
        </section>

        {/* ── Fuente de mods ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Fuente de mods</h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'cf' as const, Icon: Package, label: 'CurseForge', desc: 'Catálogo de CurseForge (requiere API Key)' },
              { value: 'mr' as const, Icon: Leaf,    label: 'Modrinth',   desc: 'Catálogo de Modrinth (sin API Key)' },
            ]).map(({ value, Icon, label, desc }) => (
              <button
                key={value}
                onClick={() => setSettings({ ...settings, modSource: value })}
                className={[
                  'flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all',
                  settings.modSource === value
                    ? 'bg-purple-500/15 border-purple-500/50 shadow-sm shadow-purple-900/20'
                    : 'bg-gray-800/40 border-gray-700/60 hover:border-gray-600 hover:bg-gray-800/60',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} className={settings.modSource === value ? 'text-purple-400' : 'text-gray-500'} />
                  <span className={['text-sm font-semibold', settings.modSource === value ? 'text-white' : 'text-gray-400'].join(' ')}>{label}</span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Modo de lanzamiento ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Modo de lanzamiento</h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'cwmc' as const,     Icon: Rocket,  label: 'Launcher CW-MC',  desc: 'Lanzamiento directo con logs y control completo' },
              { value: 'official' as const, Icon: Monitor, label: 'Launcher oficial', desc: 'Abre el launcher de Mojang con el perfil configurado' },
            ]).map(({ value, Icon, label, desc }) => (
              <button
                key={value}
                onClick={() => setSettings({ ...settings, launchMode: value })}
                className={[
                  'flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all',
                  settings.launchMode === value
                    ? 'bg-purple-500/15 border-purple-500/50 shadow-sm shadow-purple-900/20'
                    : 'bg-gray-800/40 border-gray-700/60 hover:border-gray-600 hover:bg-gray-800/60',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} className={settings.launchMode === value ? 'text-purple-400' : 'text-gray-500'} />
                  <span className={['text-sm font-semibold', settings.launchMode === value ? 'text-white' : 'text-gray-400'].join(' ')}>{label}</span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Save ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-purple-900/20"
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
    </div>

    <Modal
      open={!!pendingLogout}
      onClose={() => setPendingLogout(null)}
      title="Cerrar sesión"
      maxWidth="max-w-sm"
      icon={LogOut}
      iconBg="bg-red-500/15"
      iconColor="text-red-400"
    >
      <p className="text-sm text-gray-400">
        ¿Cerrar sesión de <span className="font-semibold text-white">{pendingLogout?.username}</span>?
      </p>
      <div className="flex justify-end gap-2 -mx-5 px-5 pt-4 mt-4 border-t border-gray-700/60">
        <button
          onClick={() => setPendingLogout(null)}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </Modal>
    </>
  )
}
