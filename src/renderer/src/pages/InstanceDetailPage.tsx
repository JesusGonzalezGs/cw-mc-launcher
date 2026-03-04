import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Play, Square, Package, Terminal, Settings2, Trash2,
  Save, CheckCircle, Download, Loader2, Plus, RefreshCw,
  Search, AlertCircle, X, HelpCircle,
} from 'lucide-react'
import type { Instance } from '../types'
import { LOADER_NAMES } from '../constants'
import ModCatalogModal from '../components/ModCatalogModal'

type Tab = 'mods' | 'console' | 'settings'

interface ModMeta {
  modId: number
  fileId: number
  name: string
  slug: string
  logo?: string
  summary?: string
  gameVersions: string[]
  recognized?: boolean
}

const LOADER_BADGE_COLORS: Record<string, string> = {
  vanilla:  'bg-green-500/15 text-green-300 border-green-500/25',
  fabric:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  neoforge: 'bg-red-500/15 text-red-300 border-red-500/25',
}

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [instance, setInstance] = useState<Instance | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [tab, setTab] = useState<Tab>('mods')
  const [mods, setMods] = useState<string[]>([])
  const [modsMeta, setModsMeta] = useState<Record<string, ModMeta>>({})
  const [logs, setLogs] = useState<string[]>([])
  const [jvmArgs, setJvmArgs] = useState('')
  const [javaInfo, setJavaInfo] = useState<{ version: number; ready: boolean; status: string; progress: number; error: string } | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [modSearch, setModSearch] = useState('')
  const [jvmSaved, setJvmSaved] = useState(false)
  const [identifyingMods, setIdentifyingMods] = useState(false)
  const [modToDelete, setModToDelete] = useState<string | null>(null)
  const [togglingMod, setTogglingMod] = useState<string | null>(null)
  const logsRef = useRef<HTMLDivElement>(null)
  const identifiedRef = useRef(false)

  const refreshMods = useCallback(async () => {
    if (!id) return null
    const [files, meta] = await Promise.all([
      window.launcher.instances.getMods(id) as Promise<string[]>,
      window.launcher.instances.getModsMeta(id) as Promise<{ mods: Record<string, ModMeta> }>,
    ])
    setMods(files)
    const metaMods = (meta as any).mods ?? {} as Record<string, ModMeta>
    setModsMeta(metaMods)
    return { files, metaMods }
  }, [id])

  useEffect(() => {
    if (!id) return
    window.launcher.instances.get(id).then((inst) => {
      if (!inst) { navigate('/instances'); return }
      setInstance(inst)
      setJvmArgs(inst.jvmArgs ?? '')
      window.launcher.java.getForMcVersion(inst.mcVersion).then(setJavaInfo)
    })
    refreshMods().then(result => {
      if (!result || identifiedRef.current) return
      const { files, metaMods } = result
      if (files.length === 0) { identifiedRef.current = true; return }
      const needsId = files.some(f => {
        const clean = f.replace('.jar.disabled', '.jar')
        return (metaMods[clean] ?? metaMods[f])?.recognized === undefined
      })
      if (needsId) {
        identifiedRef.current = true
        setIdentifyingMods(true)
        window.launcher.instances.identifyMods(id)
          .then(() => refreshMods())
          .catch(() => {})
          .finally(() => setIdentifyingMods(false))
      } else {
        identifiedRef.current = true
      }
    })
    window.launcher.instances.isRunning(id).then(setIsRunning)
  }, [id])

  useEffect(() => {
    const handleLog = ({ instanceId, line }: any) => {
      if (instanceId !== id) return
      setLogs((prev) => [...prev.slice(-500), line])
    }
    const handleStopped = ({ instanceId }: any) => {
      if (instanceId === id) setIsRunning(false)
    }
    window.launcher.on('game:log', handleLog)
    window.launcher.on('game:stopped', handleStopped)
    return () => {
      window.launcher.off('game:log', handleLog)
      window.launcher.off('game:stopped', handleStopped)
    }
  }, [id])

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!javaInfo || javaInfo.status !== 'downloading' || !instance) return
    const timer = setInterval(async () => {
      const info = await window.launcher.java.getForMcVersion(instance.mcVersion)
      setJavaInfo(info)
      if (info.status !== 'downloading') clearInterval(timer)
    }, 800)
    return () => clearInterval(timer)
  }, [javaInfo?.status])

  async function handlePlay() {
    if (!instance) return
    setIsRunning(true)
    setLogs([])
    setTab('console')
    try {
      await window.launcher.instances.launch(instance)
    } catch (e: any) {
      setLogs((prev) => [...prev, `[ERROR] ${e.message}`])
      setIsRunning(false)
    }
  }

  async function handleToggleMod(filename: string) {
    if (!id || togglingMod) return
    setTogglingMod(filename)
    try {
      await window.launcher.instances.toggleMod(id, filename)
      await refreshMods()
    } finally {
      setTogglingMod(null)
    }
  }

  async function handleRemoveMod(filename: string) {
    if (!id) return
    await window.launcher.instances.removeMod(id, filename)
    setModToDelete(null)
    await refreshMods()
  }

  async function handleInstallJava() {
    if (!javaInfo || !instance) return
    await window.launcher.java.download(javaInfo.version)
    const info = await window.launcher.java.getForMcVersion(instance.mcVersion)
    setJavaInfo(info)
  }

  async function handleSaveJvm() {
    if (!instance) return
    const updated = { ...instance, jvmArgs }
    await window.launcher.instances.create(updated)
    setInstance(updated)
    setJvmSaved(true)
    setTimeout(() => setJvmSaved(false), 2000)
  }

  const installedModIds = useMemo(
    () => new Set(Object.values(modsMeta).map(m => m.modId).filter(id => id > 0)),
    [modsMeta]
  )

  if (!instance) return null

  const loaderName = LOADER_NAMES[instance.modLoader] ?? instance.modLoader
  const loaderBadge = LOADER_BADGE_COLORS[instance.modLoader] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25'
  const logo = instance.cfMeta?.logoUrl

  const filteredMods = modSearch
    ? mods.filter((f) => {
        const meta = modsMeta[f.replace('.jar.disabled', '.jar')] ?? modsMeta[f]
        const name = meta?.name ?? f.replace('.jar.disabled', '').replace('.jar', '')
        return name.toLowerCase().includes(modSearch.toLowerCase())
      })
    : mods

  const TABS: [Tab, React.ElementType, string][] = [
    ['mods',     Package,   `Mods${mods.length > 0 ? ` (${mods.length})` : ''}`],
    ['console',  Terminal,  'Consola'],
    ['settings', Settings2, 'Ajustes'],
  ]

  return (
    <div className="flex flex-col h-full relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 overflow-hidden">
        {/* Banner */}
        {logo && (
          <>
            <img src={logo} alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-[0.08] blur-2xl scale-125 pointer-events-none select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0f1a] pointer-events-none" />
          </>
        )}

        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate('/instances')}
                className="shrink-0 mt-0.5 p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/8 hover:border-white/20 transition-all"
              >
                <ArrowLeft size={15} />
              </button>
              <div className="flex items-start gap-3 min-w-0">
                {logo && (
                  <img src={logo} alt="" className="shrink-0 w-12 h-12 rounded-2xl object-cover shadow-lg border border-white/10" />
                )}
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-1.5 bg-purple-500/10 border-purple-500/25 text-purple-300">
                    <Package size={10} />
                    Instancia
                  </div>
                  <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent truncate leading-tight">
                    {instance.name}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                      {instance.mcVersion}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${loaderBadge}`}>
                      {loaderName}
                    </span>
                    {instance.modLoaderVersion && (
                      <span className="text-gray-600 text-xs font-mono">{instance.modLoaderVersion}</span>
                    )}
                    {isRunning && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/25 text-green-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        En juego
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isRunning ? (
              <button
                onClick={() => window.launcher.instances.stop(instance.id)}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 hover:border-red-400/40 text-red-400 rounded-xl text-sm font-medium transition-all"
              >
                <Square size={13} fill="currentColor" />
                Detener
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.03] active:scale-95"
              >
                <Play size={13} fill="currentColor" />
                Jugar
              </button>
            )}
          </div>
        </div>

       
      </div>
       {/* Tabs */}
        <div className="max-w-7xl mx-auto w-full px-5 mb-4 mt-2 pt-3">
        <div className="flex gap-1 p-1 rounded-2xl border bg-gray-800/60 border-gray-700/60" role="tablist">
          {TABS.map(([t, Icon, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative z-10 max-w-4xl w-full mx-auto">

        {/* ── Mods ── */}
        {tab === 'mods' && (
          <div className="flex flex-col h-full p-3">
            <div className="flex-1 overflow-hidden rounded-2xl border bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25 flex flex-col">

              {/* Card header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                    <Package size={14} className="text-purple-400" />
                  </div>
                  <span className="text-sm font-semibold text-white">Gestor de mods</span>
                  {mods.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400">
                      {mods.filter(f => !f.endsWith('.jar.disabled')).length}/{mods.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowCatalog(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 transition-colors"
                >
                  <Plus size={12} />
                  Catálogo
                </button>
              </div>

              {/* Search */}
              <div className="px-4 pb-3 shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={modSearch}
                    onChange={(e) => setModSearch(e.target.value)}
                    placeholder="Buscar mod..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl text-sm border bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                  {modSearch && (
                    <button onClick={() => setModSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Identifying banner */}
              {identifyingMods && (
                <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-purple-500/10 border border-purple-500/20 text-purple-300 shrink-0">
                  <RefreshCw size={11} className="animate-spin shrink-0" />
                  Identificando mods con CurseForge…
                </div>
              )}

              {/* Mod list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              {filteredMods.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
                  {mods.length === 0 ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-800/60">
                        <Package size={24} className="text-gray-600" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm font-medium">Sin mods instalados</p>
                        <p className="text-gray-600 text-xs mt-1">Añade mods desde el catálogo de CurseForge</p>
                      </div>
                      <button
                        onClick={() => setShowCatalog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 rounded-xl text-sm font-medium transition-colors"
                      >
                        <Plus size={14} />
                        Explorar mods
                      </button>
                    </>
                  ) : (
                    <>
                      <Search size={20} className="text-gray-600" />
                      <p className="text-gray-500 text-sm">Sin resultados para "{modSearch}"</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredMods.map((filename) => {
                    const enabled = !filename.endsWith('.jar.disabled')
                    const cleanName = filename.replace('.jar.disabled', '.jar')
                    const meta = modsMeta[cleanName] ?? modsMeta[filename]
                    const displayName = meta?.name ?? cleanName.replace('.jar', '')
                    const isToggling = togglingMod === filename

                    return (
                      <div
                        key={filename}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all ${!enabled ? 'opacity-55 border-gray-700/30' : 'border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/20'}`}
                      >
                        {/* Logo / icon */}
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${
                          meta?.logo ? '' : meta?.recognized === false ? 'bg-gray-700/70' : 'bg-purple-500/15'
                        }`}>
                          {meta?.logo ? (
                            <img
                              src={meta.logo}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : meta?.recognized === false ? (
                            <HelpCircle size={15} className="text-gray-500" />
                          ) : (
                            <Package size={15} className="text-purple-400 opacity-70" />
                          )}
                        </div>

                        {/* Name + status */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-gray-200">{displayName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="text-[10px] font-mono truncate text-gray-600">
                              {cleanName.replace('.jar', '')}
                            </span>
                            {meta?.recognized === false && (
                              <span className="text-[10px] text-gray-600 shrink-0">· no reconocido</span>
                            )}
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <button
                          onClick={() => handleToggleMod(filename)}
                          disabled={!!togglingMod}
                          aria-label={enabled ? `Desactivar ${displayName}` : `Activar ${displayName}`}
                          className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200 disabled:cursor-wait ${
                            enabled ? 'bg-green-500 hover:bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${enabled ? 'left-5' : 'left-0.5'} ${isToggling ? 'opacity-60' : ''}`} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setModToDelete(filename)}
                          disabled={!!togglingMod}
                          className="shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:cursor-wait"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* ── Console ── */}
        {tab === 'console' && (
          <div className="h-full p-3 flex flex-col">
            <div className="flex-1 overflow-hidden rounded-2xl border border-gray-700/60 flex flex-col">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gray-800 border-gray-700/60 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                <div className="flex items-center gap-1.5 ml-1 text-gray-400">
                  <Terminal size={12} />
                  <span className="text-xs font-medium font-mono">{instance.name} — logs</span>
                </div>
              </div>
              {/* Log output */}
              <div
                ref={logsRef}
                aria-live="polite"
                className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed bg-gray-950 custom-scrollbar"
              >
                {logs.length === 0 ? (
                  <span className="text-gray-600">// Esperando logs...</span>
                ) : (
                  logs.map((line, i) => (
                    <div
                      key={i}
                      className={
                        /\[ERROR\]|ERROR|Exception/.test(line) ? 'text-red-400' :
                        /WARN|warning/.test(line) ? 'text-yellow-400' :
                        /\[INFO\]/.test(line) ? 'text-gray-400' :
                        'text-green-400'
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Settings ── */}
        {tab === 'settings' && (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-md mx-auto px-5 py-5 space-y-4">

              {/* Java */}
              {javaInfo && (
                <div className="bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/25 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">Java</p>
                      <p className="text-xs text-gray-500 mt-0.5">Recomendado para MC {instance.mcVersion}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-bold">
                      Java {javaInfo.version}
                    </span>
                  </div>

                  {javaInfo.ready ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                      <CheckCircle size={13} className="text-green-400 shrink-0" />
                      <span className="text-sm text-green-300">Instalado y listo</span>
                    </div>
                  ) : javaInfo.status === 'downloading' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Loader2 size={11} className="animate-spin" />
                          Instalando Java {javaInfo.version}...
                        </span>
                        <span className="font-mono">{javaInfo.progress}%</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-gray-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${javaInfo.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleInstallJava}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-300 hover:text-indigo-200 text-sm font-medium transition-colors"
                    >
                      <Download size={13} />
                      Instalar Java {javaInfo.version}
                    </button>
                  )}

                  {javaInfo.error && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircle size={13} className="text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">{javaInfo.error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* JVM Args */}
              <div className="bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/25 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">Argumentos JVM</label>
                  <input
                    type="text"
                    value={jvmArgs}
                    onChange={(e) => setJvmArgs(e.target.value)}
                    placeholder="-Xmx4G -XX:+UseG1GC"
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                  />
                  <p className="text-xs text-gray-600 mt-1.5">Deja vacío para usar los argumentos globales</p>
                </div>
                <button
                  onClick={handleSaveJvm}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-sm ${
                    jvmSaved
                      ? 'bg-green-500/20 border border-green-500/25 text-green-300'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                  }`}
                >
                  {jvmSaved ? <><CheckCircle size={13} /> Guardado</> : <><Save size={13} /> Guardar</>}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Mod catalog modal */}
      {showCatalog && (
        <ModCatalogModal
          instance={instance}
          onClose={() => setShowCatalog(false)}
          onModInstalled={refreshMods}
          installedModIds={installedModIds}
        />
      )}

      {/* Delete mod confirmation */}
      {modToDelete && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setModToDelete(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className="w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto bg-gradient-to-br from-gray-800 to-gray-900 border-red-500/30"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/15">
                    <Trash2 size={14} className="text-red-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-white">Eliminar mod</h3>
                </div>
                <button onClick={() => setModToDelete(null)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors">
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-300">
                  ¿Eliminar <span className="font-semibold text-red-400">
                    {(modsMeta[modToDelete.replace('.jar.disabled', '.jar')] ?? modsMeta[modToDelete])?.name ?? modToDelete.replace('.jar.disabled', '').replace('.jar', '')}
                  </span>?
                </p>
                <p className="text-xs mt-1.5 text-gray-500">El archivo se borrará permanentemente.</p>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-700/60">
                <button
                  onClick={() => setModToDelete(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleRemoveMod(modToDelete)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
