import React, { useEffect, useState } from 'react'
import {
  LogOut, Check, User, Key, Settings, ExternalLink, Rocket, Monitor,
  Flame, Leaf, Plus, AlertCircle, ArrowLeft, WifiOff, UserPlus, LogIn, RefreshCw,
} from 'lucide-react'
import type { AppSettings, Account, LauncherUser } from '../types'
import Modal from '../components/common/Modal'

interface Props {
  launcherUser: LauncherUser
  onAccountChange: (acc: any) => void
  onLogoutGoogle: () => void
}

type AddMode = null | 'choose' | 'offline'

const CARD = 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/25'

type CheckState = 'idle' | 'checking' | 'up-to-date' | 'found'

export default function SettingsPage({ launcherUser, onAccountChange, onLogoutGoogle }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [appVersion, setAppVersion] = useState('')
  const [saved, setSaved] = useState(false)
  const [pendingLogout, setPendingLogout] = useState<Account | null>(null)
  const [googleLogoutConfirm, setGoogleLogoutConfirm] = useState(false)

  // Add profile state
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [username, setUsername] = useState('')
  const [licenseAccepted, setLicenseAccepted] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const load = async () => {
    const [s, accs] = await Promise.all([
      window.launcher.settings.get(),
      window.launcher.auth.listAccounts(),
    ])
    setSettings(s)
    setAccounts(accs)
  }

  useEffect(() => {
    load()
    window.launcher.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

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
    onAccountChange(active ?? null)
    load()
  }

  async function handleSetActive(id: string) {
    await window.launcher.auth.setActive(id)
    const active = await window.launcher.auth.getActive()
    onAccountChange(active)
    load()
  }

  async function handleGoogleLogout() {
    await window.launcher.launcherUser.logout()
    onLogoutGoogle()
  }

  async function handleAddMsa() {
    setAddLoading(true)
    setAddError('')
    try {
      await window.launcher.auth.loginMsa()
      setAddMode(null)
      load()
    } catch (e: any) {
      setAddError(e.message ?? 'Error al iniciar sesión con Microsoft')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleAddOffline() {
    if (!username.trim() || !licenseAccepted) return
    setAddLoading(true)
    setAddError('')
    try {
      await window.launcher.auth.loginOffline(username.trim())
      setAddMode(null)
      setUsername('')
      setLicenseAccepted(false)
      load()
    } catch (e: any) {
      setAddError(e.message ?? 'Error al crear perfil offline')
    } finally {
      setAddLoading(false)
    }
  }

  if (!settings) return null

  return (
    <>
    <div className="relative min-h-full">

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

        {/* ── Cuenta del launcher ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Cuenta del launcher</h2>
          <div className={`${CARD} rounded-xl px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {launcherUser.picture ? (
                <img
                  src={launcherUser.picture}
                  alt={launcherUser.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
              )}
              <div>
                <p className="text-white text-sm font-semibold">{launcherUser.name}</p>
                <p className="text-gray-500 text-xs">{launcherUser.email}</p>
              </div>
            </div>
            <button
              onClick={() => setGoogleLogoutConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/10"
            >
              <LogOut size={13} />
              Cerrar sesión
            </button>
          </div>
        </section>

        {/* ── Perfiles de Minecraft ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Perfiles de Minecraft</h2>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className={`flex items-center justify-between ${CARD} rounded-xl px-4 py-3`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${acc.type === 'msa' ? 'bg-blue-600/20' : 'bg-purple-600/20'}`}>
                    {acc.skinUrl ? (
                      <img
                        src={`https://mc-heads.net/avatar/${acc.uuid}/32`}
                        alt={acc.username}
                        className="w-6 h-6 rounded object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <User size={14} className={acc.type === 'msa' ? 'text-blue-400' : 'text-purple-400'} />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{acc.username}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {acc.type === 'msa' ? (
                        <>
                          <Monitor size={9} className="text-blue-400/60" />
                          <span className="text-gray-500 text-xs">Microsoft</span>
                        </>
                      ) : (
                        <>
                          <WifiOff size={9} className="text-purple-400/60" />
                          <span className="text-gray-500 text-xs">Offline</span>
                        </>
                      )}
                    </div>
                  </div>
                  {acc.id === settings.activeAccountId && (
                    <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">Activo</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {acc.id !== settings.activeAccountId && (
                    <button
                      onClick={() => handleSetActive(acc.id)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-300 transition-all"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    onClick={() => setPendingLogout(acc)}
                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                    title="Eliminar perfil"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Botón añadir perfil */}
            <button
              onClick={() => { setAddMode('choose'); setAddError('') }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-purple-500/25 text-purple-400/60 hover:text-purple-300 hover:border-purple-500/40 hover:bg-purple-500/5 text-sm transition-all"
            >
              <Plus size={13} />
              Añadir perfil
            </button>

            {accounts.length === 0 && (
              <p className="text-gray-600 text-sm py-1">No hay perfiles guardados.</p>
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
              { value: 'cf' as const, Icon: Flame, label: 'CurseForge', desc: 'Catálogo de CurseForge (requiere API Key)' },
              { value: 'mr' as const, Icon: Leaf,  label: 'Modrinth',   desc: 'Catálogo de Modrinth (sin API Key)' },
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

        {/* ── Actualizaciones ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Actualizaciones</h2>
          <div className={`${CARD} rounded-xl px-4 py-3 flex items-center justify-between`}>
            <div>
              <p className="text-white text-sm font-medium">Comprobar actualizaciones</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {checkState === 'checking'   && 'Buscando actualizaciones...'}
                {checkState === 'up-to-date' && '✓ Ya tienes la última versión'}
                {checkState === 'found'      && 'Actualización encontrada, descargando...'}
                {checkState === 'idle'       && (appVersion ? `Versión ${appVersion}` : 'Versión actual')}
              </p>
            </div>
            <button
              onClick={async () => {
                setCheckState('checking')
                try {
                  const res = await window.launcher.updater.check()
                  setCheckState(res.hasUpdate ? 'found' : 'up-to-date')
                } catch {
                  setCheckState('idle')
                }
              }}
              disabled={checkState === 'checking'}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw size={14} className={checkState === 'checking' ? 'animate-spin' : ''} />
              {checkState === 'checking' ? 'Comprobando...' : 'Buscar'}
            </button>
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

    {/* Modal: añadir perfil */}
    <Modal
      open={addMode !== null}
      onClose={() => { setAddMode(null); setAddError(''); setUsername(''); setLicenseAccepted(false) }}
      title={addMode === 'offline' ? 'Perfil offline' : 'Añadir perfil'}
      maxWidth="max-w-sm"
      icon={UserPlus}
    >
      {addError && (
        <div className="flex items-start gap-2.5 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-xs">{addError}</p>
        </div>
      )}

      {addMode === 'choose' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-4">Elige cómo quieres entrar al launcher</p>
          <button
            onClick={handleAddMsa}
            disabled={addLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-[#2f6feb] hover:bg-[#388af5] text-white shadow-lg shadow-blue-900/30"
          >
            {addLoading ? (
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
              {addLoading ? 'Abriendo ventana de login...' : 'Iniciar sesión con Microsoft'}
            </span>
          </button>

          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
            <div className="relative flex justify-center">
              <span className="bg-[#13111f] px-3 text-[11px] text-gray-600">o continúa sin cuenta</span>
            </div>
          </div>

          <button
            onClick={() => { setAddMode('offline'); setAddError('') }}
            disabled={addLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm border transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] border-gray-700/80 text-gray-300 hover:bg-white/5 hover:border-gray-600 hover:text-white"
          >
            <WifiOff size={15} className="shrink-0 text-gray-500" />
            <span className="flex-1 text-left">Modo offline (sin cuenta)</span>
          </button>
        </div>
      )}

      {addMode === 'offline' && (
        <div className="space-y-4">
          <button
            onClick={() => { setAddMode('choose'); setAddError(''); setUsername(''); setLicenseAccepted(false) }}
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
            <label htmlFor="settings-offline-username" className="block text-xs font-medium text-gray-400 mb-1.5">
              Nombre de usuario
            </label>
            <input
              id="settings-offline-username"
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
            disabled={addLoading || !username.trim() || !licenseAccepted}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/30"
          >
            {addLoading ? (
              <><span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" /> Creando...</>
            ) : (
              <><LogIn size={15} /> Entrar</>
            )}
          </button>
        </div>
      )}
    </Modal>

    {/* Modal: eliminar perfil Minecraft */}
    <Modal
      open={!!pendingLogout}
      onClose={() => setPendingLogout(null)}
      title="Eliminar perfil"
      maxWidth="max-w-sm"
      icon={LogOut}
      iconBg="bg-red-500/15"
      iconColor="text-red-400"
    >
      <p className="text-sm text-gray-400">
        ¿Eliminar el perfil <span className="font-semibold text-white">{pendingLogout?.username}</span>?
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
          Eliminar
        </button>
      </div>
    </Modal>

    {/* Modal: cerrar sesión Google */}
    <Modal
      open={googleLogoutConfirm}
      onClose={() => setGoogleLogoutConfirm(false)}
      title="Cerrar sesión del launcher"
      maxWidth="max-w-sm"
      icon={LogOut}
      iconBg="bg-red-500/15"
      iconColor="text-red-400"
    >
      <p className="text-sm text-gray-400">
        Volverás a la pantalla de inicio de sesión con Google.<br />
        Tus perfiles de Minecraft se conservarán.
      </p>
      <div className="flex justify-end gap-2 -mx-5 px-5 pt-4 mt-4 border-t border-gray-700/60">
        <button
          onClick={() => setGoogleLogoutConfirm(false)}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleGoogleLogout}
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
