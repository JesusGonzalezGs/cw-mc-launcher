import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Play, Square, Package, Terminal, Settings2, Trash2,
  Save, CheckCircle, Download, Loader2, Plus, RefreshCw,
  Search, AlertCircle, X, HelpCircle, FolderOpen, ExternalLink, ArrowUpDown,
  Layers, Image, Sparkles, Database, Flame,
} from 'lucide-react'
import type { Instance } from '../types'
import { LOADER_NAMES } from '../constants'
import ModCatalogModal from '../components/ModCatalogModal'
import FileCatalogModal from '../components/FileCatalogModal'
import DatapackLoaderModal from '../components/DatapackLoaderModal'
import knownDatapackLoaders from '../data/datapackLoaders.json'
import FilterSelect from '../components/common/FilterSelect'
import { getInstanceLogs, appendInstanceLog, clearInstanceLogs } from '../lib/logsStore'

type Tab = 'resources' | 'console' | 'settings'
type ResourceTab = 'mods' | 'datapacks' | 'resourcepacks' | 'shaderpacks'

interface ModMeta {
  modId: number
  fileId: number
  name: string
  slug: string
  logo?: string
  summary?: string
  gameVersions: string[]
  recognized?: boolean
  deps?: number[]
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
  const [tab, setTab] = useState<Tab>('resources')
  const [resourceTab, setResourceTab] = useState<ResourceTab>('mods')
  const [resourceFiles, setResourceFiles] = useState<Record<string, { name: string; isDir: boolean }[]>>({ datapacks: [], resourcepacks: [], shaderpacks: [] })
  const [filesMeta, setFilesMeta] = useState<Record<string, Record<string, any>>>({ datapacks: {}, resourcepacks: {}, shaderpacks: {} })
  const [loadingResource, setLoadingResource] = useState(false)
  const [identifyingFiles, setIdentifyingFiles] = useState<string | null>(null)
  const [mods, setMods] = useState<string[]>([])
  const [modsMeta, setModsMeta] = useState<Record<string, ModMeta>>({})
  const [logs, setLogs] = useState<string[]>(() => id ? getInstanceLogs(id) : [])
  const [jvmArgs, setJvmArgs] = useState('')
  const [javaInfo, setJavaInfo] = useState<{ version: number; ready: boolean; status: string; progress: number; error: string } | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [showFileCatalog, setShowFileCatalog] = useState<ResourceTab | null>(null)
  const [showDatapackLoaderModal, setShowDatapackLoaderModal] = useState(false)
  const [togglingFile, setTogglingFile] = useState<string | null>(null)
  const [crashReport, setCrashReport] = useState<string | null>(null)
  const [modSource, setModSource] = useState<'cf' | 'mr'>('cf')
  const [modSort, setModSort] = useState<'default' | 'name' | 'name-desc' | 'enabled' | 'disabled'>('default')
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
      // Derive modSource from instance origin; fall back to global setting for manual instances
      if (inst.source === 'modrinth') {
        setModSource('mr')
      } else if (inst.source === 'curseforge') {
        setModSource('cf')
      } else {
        window.launcher.settings.get().then((s: any) => { if (s?.modSource) setModSource(s.modSource) }).catch(() => {})
      }
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
      appendInstanceLog(id!, line)
      setLogs(getInstanceLogs(id!))
    }
    const handleStopped = ({ instanceId }: any) => {
      if (instanceId !== id) return
      setIsRunning(false)
      const currentLogs = getInstanceLogs(instanceId)
      const hasCrash = currentLogs.some(l => l.includes('---- Minecraft Crash Report ----') || l.includes('Game crashed!') || l.includes('FATAL'))
      if (hasCrash) {
        window.launcher.instances.getCrashReport(instanceId).then(report => {
          if (report) setCrashReport(report)
        }).catch(() => {})
      }
    }
    window.launcher.on('game:log', handleLog)
    window.launcher.on('game:stopped', handleStopped)
    return () => {
      window.launcher.off('game:log', handleLog)
      window.launcher.off('game:stopped', handleStopped)
    }
  }, [id])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [logs])

  useEffect(() => {
    if (tab === 'console' && logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [tab])

  useEffect(() => {
    if (tab !== 'resources' || resourceTab === 'mods' || !id) return
    setLoadingResource(true)
    const folder = resourceTab
    Promise.all([
      window.launcher.instances.listFolder(id, folder),
      window.launcher.instances.getFilesMeta(id, folder),
    ])
      .then(([files, meta]) => {
        setResourceFiles(prev => ({ ...prev, [folder]: files }))
        const metaFiles = (meta as any).files ?? {}
        setFilesMeta(prev => ({ ...prev, [folder]: metaFiles }))

        // Auto-identify: zips without recognized metadata
        const needsId = files.some(f => {
          const clean = f.name.replace('.disabled', '')
          const existing = metaFiles[clean] ?? metaFiles[f.name]
          return existing?.recognized === undefined
        })
        if (needsId && !identifyingFiles) {
          setIdentifyingFiles(folder)
          window.launcher.instances.identifyFiles(id, folder)
            .then(() => window.launcher.instances.getFilesMeta(id, folder))
            .then(meta => setFilesMeta(prev => ({ ...prev, [folder]: (meta as any).files ?? {} })))
            .catch(() => {})
            .finally(() => setIdentifyingFiles(null))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResource(false))
  }, [tab, resourceTab, id])

  useEffect(() => {
    if (!javaInfo || javaInfo.status !== 'downloading' || !instance) return
    const timer = setInterval(async () => {
      const info = await window.launcher.java.getForMcVersion(instance.mcVersion)
      setJavaInfo(info)
      if (info.status !== 'downloading') clearInterval(timer)
    }, 800)
    return () => clearInterval(timer)
  }, [javaInfo?.status])

  const DATAPACK_LOADER_IDS = new Set(knownDatapackLoaders.map(l => l.curseforgeId))
  const DATAPACK_LOADER_SLUGS = new Set(knownDatapackLoaders.map(l => l.slug))
  function openDatapackCatalog() {
    if (!instance || instance.modLoader === 'vanilla') { setShowFileCatalog('datapacks'); return }
    const ignored = localStorage.getItem(`datapackLoaderIgnored_${instance.id}`) === 'true'
    if (ignored) { setShowFileCatalog('datapacks'); return }
    const hasLoader = Object.values(modsMeta).some(m =>
      DATAPACK_LOADER_SLUGS.has(m.slug) || DATAPACK_LOADER_IDS.has(m.modId)
    )
    if (hasLoader) setShowFileCatalog('datapacks')
    else setShowDatapackLoaderModal(true)
  }

  async function handlePlay() {
    if (!instance) return
    clearInstanceLogs(id!)
    setLogs([])
    try {
      const result = await window.launcher.instances.launch(instance)
      if ((result as any)?.method === 'official') {
        setLogs(['[INFO] Launcher oficial de Mojang abierto con el perfil configurado.'])
        setTab('console' as Tab)
      } else {
        setIsRunning(true)
        setTab('console' as Tab)
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `[ERROR] ${e.message}`])
      setIsRunning(false)
    }
  }

  async function handleToggleMod(filename: string) {
    if (!id || togglingMod) return
    setTogglingMod(filename)
    try {
      const isCurrentlyEnabled = !filename.endsWith('.jar.disabled')
      await window.launcher.instances.toggleMod(id, filename)

      // Cascade disable: if we just disabled a mod, also disable any enabled mods
      // that list it as a dependency (BFS for transitive dependents)
      if (isCurrentlyEnabled) {
        const cleanName = filename.replace('.jar.disabled', '.jar')
        const meta = modsMeta[cleanName] ?? modsMeta[filename]
        const disabledModId = meta?.modId

        if (disabledModId && disabledModId > 0) {
          const queue = [disabledModId]
          const visited = new Set<number>([disabledModId])

          while (queue.length > 0) {
            const currentModId = queue.shift()!
            for (const [metaKey, m] of Object.entries(modsMeta)) {
              if (!m.deps?.includes(currentModId)) continue
              if (visited.has(m.modId)) continue
              const enabledFile = mods.find(
                (f) => !f.endsWith('.jar.disabled') &&
                  (f === metaKey || f.replace('.jar.disabled', '.jar') === metaKey)
              )
              if (enabledFile) {
                await window.launcher.instances.toggleMod(id, enabledFile)
                visited.add(m.modId)
                queue.push(m.modId)
              }
            }
          }
        }
      }

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

  const installedMrSlugs = useMemo(
    () => new Set(Object.values(modsMeta).map(m => m.mrSlug).filter(Boolean) as string[]),
    [modsMeta]
  )

  const filteredMods = useMemo(() => {
    let list = modSearch
      ? mods.filter((f) => {
          const meta = modsMeta[f.replace('.jar.disabled', '.jar')] ?? modsMeta[f]
          const name = meta?.name ?? f.replace('.jar.disabled', '').replace('.jar', '')
          return name.toLowerCase().includes(modSearch.toLowerCase())
        })
      : [...mods]

    const getName = (f: string) => {
      const meta = modsMeta[f.replace('.jar.disabled', '.jar')] ?? modsMeta[f]
      return (meta?.name ?? f.replace('.jar.disabled', '').replace('.jar', '')).toLowerCase()
    }
    const isEnabled = (f: string) => !f.endsWith('.jar.disabled')

    if (modSort === 'name') list.sort((a, b) => getName(a).localeCompare(getName(b)))
    else if (modSort === 'name-desc') list.sort((a, b) => getName(b).localeCompare(getName(a)))
    else if (modSort === 'enabled') list.sort((a, b) => Number(isEnabled(b)) - Number(isEnabled(a)))
    else if (modSort === 'disabled') list.sort((a, b) => Number(isEnabled(a)) - Number(isEnabled(b)))

    return list
  }, [mods, modsMeta, modSearch, modSort])

  if (!instance) return null

  const loaderName = LOADER_NAMES[instance.modLoader] ?? instance.modLoader
  const loaderBadge = LOADER_BADGE_COLORS[instance.modLoader] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25'
  const logo = instance.cfMeta?.logoUrl ?? instance.mrMeta?.logoUrl

  const TABS: [Tab, React.ElementType, string][] = [
    ['resources', Layers,   'Recursos'],
    ['console',   Terminal, 'Consola'],
    ['settings',  Settings2,'Ajustes'],
  ]

  const RESOURCE_TABS: [ResourceTab, React.ElementType, string][] = [
    ['mods',         Package,  `Mods${mods.length > 0 ? ` (${mods.length})` : ''}`],
    ['datapacks',    Database, 'Datapacks'],
    ['resourcepacks',Image,    'Resource Packs'],
    ['shaderpacks',  Sparkles, 'Shaders'],
  ]

  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-5 pb-8 space-y-4">

        {/* Back button */}
        <button
          onClick={() => navigate('/instances')}
          className="w-fit flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl border group bg-gray-800/60 hover:bg-gray-800 text-gray-300 border-gray-700/60 hover:border-gray-600 transition-all"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver
        </button>

        {/* Java warning */}
        {javaInfo && !javaInfo.ready && javaInfo.status !== 'downloading' && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={14} className="text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-300 truncate">
                Java {javaInfo.version} no está instalado — el juego probablemente no arrancará sin él.
              </p>
            </div>
            <button
              onClick={() => setTab('settings')}
              className="shrink-0 text-xs font-semibold text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors"
            >
              Instalar en Ajustes →
            </button>
          </div>
        )}

        {/* ── Grid ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-start">

          {/* ── Main column (col-span-2) ────────────────────────────────────── */}
          <div className="md:col-span-2 space-y-3">

            {/* Tabs */}
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

            {/* ── Resources ── */}
            {tab === 'resources' && (
              <div className="rounded-2xl border bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25 flex flex-col">

                {/* Resource sub-tabs */}
                <div className="flex gap-1 px-3 pt-3 pb-0 shrink-0">
                  {RESOURCE_TABS.map(([rt, Icon, label]) => (
                    <button
                      key={rt}
                      onClick={() => setResourceTab(rt)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-medium border-b-2 transition-all ${
                        resourceTab === rt
                          ? 'text-purple-300 border-purple-500 bg-purple-500/10'
                          : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-700/30'
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-700/50 mx-0" />

                {/* ── Mods sub-tab ── */}
                {resourceTab === 'mods' && (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">Mods instalados</span>
                        {mods.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400">
                            {mods.filter(f => !f.endsWith('.jar.disabled')).length}/{mods.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => window.launcher.instances.openSubFolder(id!, 'mods')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700/60 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          <FolderOpen size={12} />
                          Carpeta
                        </button>
                        {instance.modLoader !== 'vanilla' && (
                          <button
                            onClick={() => setShowCatalog(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 transition-colors"
                          >
                            <Plus size={12} />
                            Catálogo
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search + sort */}
                    <div className="mx-4 mb-3 shrink-0 flex flex-wrap gap-2.5 p-3 rounded-2xl border bg-gray-800/40 border-gray-700/50">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          value={modSearch}
                          onChange={(e) => setModSearch(e.target.value)}
                          placeholder="Buscar mod..."
                          className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:ring-offset-0 transition-all"
                        />
                        {modSearch && (
                          <button onClick={() => setModSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <FilterSelect
                        icon={ArrowUpDown}
                        value={modSort}
                        onChange={(v) => setModSort(v as typeof modSort)}
                        options={[
                          { value: 'default',   label: 'Sin ordenar' },
                          { value: 'name',      label: 'Nombre A–Z' },
                          { value: 'name-desc', label: 'Nombre Z–A' },
                          { value: 'enabled',   label: 'Activos primero' },
                          { value: 'disabled',  label: 'Desactivados primero' },
                        ]}
                      />
                    </div>

                    {/* Identifying banner */}
                    {identifyingMods && (
                      <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-purple-500/10 border border-purple-500/20 text-purple-300 shrink-0">
                        <RefreshCw size={11} className="animate-spin shrink-0" />
                        Identificando mods con CurseForge…
                      </div>
                    )}

                    {/* Mod list */}
                    <div className="overflow-y-auto px-4 pb-4 custom-scrollbar max-h-[460px] min-h-[140px]">
                      {filteredMods.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-4 text-center py-14">
                          {mods.length === 0 ? (
                            <>
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-800/60">
                                <Package size={24} className="text-gray-600" />
                              </div>
                              <div>
                                <p className="text-gray-400 text-sm font-medium">Sin mods instalados</p>
                                <p className="text-gray-600 text-xs mt-1">
                                  {instance.modLoader === 'vanilla'
                                    ? 'Vanilla no soporta mods — usa Forge, Fabric u otro loader'
                                    : 'Añade mods desde el catálogo de CurseForge'}
                                </p>
                              </div>
                              {instance.modLoader !== 'vanilla' && (
                                <button
                                  onClick={() => setShowCatalog(true)}
                                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 rounded-xl text-sm font-medium transition-colors"
                                >
                                  <Plus size={14} />
                                  Explorar mods
                                </button>
                              )}
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
                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${meta?.logo ? '' : meta?.recognized === false ? 'bg-gray-700/70' : 'bg-purple-500/15'}`}>
                                  {meta?.logo ? (
                                    <img src={meta.logo} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                  ) : meta?.recognized === false ? (
                                    <HelpCircle size={15} className="text-gray-500" />
                                  ) : (
                                    <Package size={15} className="text-purple-400 opacity-70" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate text-gray-200">{displayName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono truncate text-gray-600">{cleanName.replace('.jar', '')}</span>
                                    {meta?.recognized === false && <span className="text-[10px] text-gray-600 shrink-0">· no reconocido</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleToggleMod(filename)}
                                  disabled={!!togglingMod}
                                  aria-label={enabled ? `Desactivar ${displayName}` : `Activar ${displayName}`}
                                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200 disabled:cursor-wait ${enabled ? 'bg-green-500 hover:bg-green-400' : 'bg-gray-600 hover:bg-gray-500'}`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${enabled ? 'left-5' : 'left-0.5'} ${isToggling ? 'opacity-60' : ''}`} />
                                </button>
                                <button
                                  onClick={() => setModToDelete(filename)}
                                  disabled={!!togglingMod}
                                  className="shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:cursor-wait"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Generic file sub-tabs (datapacks / resourcepacks / shaderpacks) ── */}
                {resourceTab !== 'mods' && (() => {
                  const cfg: Record<string, { icon: React.ElementType; label: string; emptyMsg: string; note?: string }> = {
                    datapacks:    { icon: Database, label: 'Datapacks',     emptyMsg: 'Sin datapacks instalados',     note: 'Los datapacks de mundo están en saves/<mundo>/datapacks' },
                    resourcepacks:{ icon: Image,    label: 'Resource Packs', emptyMsg: 'Sin resource packs instalados', note: undefined },
                    shaderpacks:  { icon: Sparkles, label: 'Shaders',        emptyMsg: 'Sin shaderpacks instalados',    note: 'Requiere OptiFine o Iris instalado' },
                  }
                  const { icon: Icon, label, emptyMsg, note } = cfg[resourceTab]
                  const files = resourceFiles[resourceTab] ?? []

                  async function handleToggleFile(entry: { name: string; isDir: boolean }) {
                    if (!id || togglingFile) return
                    setTogglingFile(entry.name)
                    try {
                      const newName = await window.launcher.instances.toggleFile(id, resourceTab, entry.name)
                      setResourceFiles(prev => ({
                        ...prev,
                        [resourceTab]: prev[resourceTab].map(f => f.name === entry.name ? { name: newName, isDir: entry.isDir } : f),
                      }))
                    } finally {
                      setTogglingFile(null)
                    }
                  }

                  return (
                    <>
                      <div className="flex items-center justify-between px-4 pt-3 pb-3 shrink-0">
                        <span className="text-sm font-semibold text-white">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => window.launcher.instances.openSubFolder(id!, resourceTab)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700/60 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                          >
                            <FolderOpen size={12} />
                            Carpeta
                          </button>
                          <button
                            onClick={() => resourceTab === 'datapacks' ? openDatapackCatalog() : setShowFileCatalog(resourceTab)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 transition-colors"
                          >
                            <Plus size={12} />
                            Catálogo
                          </button>
                        </div>
                      </div>
                      <div className="overflow-y-auto px-4 pb-4 custom-scrollbar max-h-[460px] min-h-[140px]">
                        {/* Identifying banner */}
                      {identifyingFiles === resourceTab && (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-purple-500/10 border border-purple-500/20 text-purple-300 shrink-0">
                          <RefreshCw size={11} className="animate-spin shrink-0" />
                          Identificando archivos con CurseForge…
                        </div>
                      )}

                      {loadingResource ? (
                          <div className="space-y-1.5 py-2">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-xl animate-pulse bg-gray-700/40" />)}
                          </div>
                        ) : files.length === 0 ? (
                          <div className="flex flex-col items-center justify-center gap-3 text-center py-14">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-800/60">
                              <Icon size={22} className="text-gray-600" />
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm font-medium">{emptyMsg}</p>
                              {note && <p className="text-gray-600 text-xs mt-1">{note}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => resourceTab === 'datapacks' ? openDatapackCatalog() : setShowFileCatalog(resourceTab)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 rounded-xl transition-colors"
                              >
                                <Plus size={11} />
                                Catálogo
                              </button>
                              <button
                                onClick={() => window.launcher.instances.listFolder(id!, resourceTab)
                                  .then(entries => setResourceFiles(prev => ({ ...prev, [resourceTab]: entries })))}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 border border-gray-700/60 rounded-xl transition-colors"
                              >
                                <RefreshCw size={11} />
                                Recargar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 py-1">
                            {files.map(entry => {
                              const isDisabled = entry.name.endsWith('.disabled')
                              const rawName = isDisabled ? entry.name.slice(0, -'.disabled'.length) : entry.name
                              const meta = filesMeta[resourceTab]?.[rawName] ?? filesMeta[resourceTab]?.[entry.name]
                              const displayName = meta?.name ?? rawName.replace(/\.zip$/, '')
                              const isToggling = togglingFile === entry.name
                              return (
                                <div
                                  key={entry.name}
                                  className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl border transition-all ${isDisabled ? 'opacity-55 border-gray-700/30' : 'border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/20'}`}
                                >
                                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${meta?.logo ? '' : meta?.recognized === false ? 'bg-gray-700/70' : 'bg-purple-500/15'}`}>
                                    {meta?.logo ? (
                                      <img src={meta.logo} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                    ) : meta?.recognized === false ? (
                                      <HelpCircle size={14} className="text-gray-500" />
                                    ) : (
                                      <Icon size={14} className="text-purple-400 opacity-70" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-gray-200">{displayName}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-mono truncate text-gray-600">{rawName}</span>
                                      {meta?.recognized === false && <span className="text-[10px] text-gray-600 shrink-0">· no reconocido</span>}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleToggleFile(entry)}
                                    disabled={!!togglingFile}
                                    aria-label={isDisabled ? `Activar ${displayName}` : `Desactivar ${displayName}`}
                                    className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200 disabled:cursor-wait ${isDisabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-green-500 hover:bg-green-400'}`}
                                  >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${isDisabled ? 'left-0.5' : 'left-5'} ${isToggling ? 'opacity-60' : ''}`} />
                                  </button>
                                  <button
                                    onClick={() => window.launcher.instances.deleteFile(id!, resourceTab, entry.name)
                                      .then(() => setResourceFiles(prev => ({ ...prev, [resourceTab]: prev[resourceTab].filter(f => f.name !== entry.name) })))}
                                    disabled={!!togglingFile}
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
                    </>
                  )
                })()}

              </div>
            )}

            {/* ── Console ── */}
            {tab === 'console' && (
              <div className="rounded-2xl border border-gray-700/60 flex flex-col h-[520px]">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gray-800 border-gray-700/60 shrink-0 rounded-t-2xl">
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
                  className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed bg-gray-950 rounded-b-2xl custom-scrollbar"
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
            )}

            {/* ── Settings ── */}
            {tab === 'settings' && (
              <div className="space-y-4">

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
                            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
                            style={{ width: `${javaInfo.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleInstallJava}
                        className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 shadow-sm shadow-purple-900/25"
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
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 font-mono text-sm outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:ring-offset-0 transition-all"
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
            )}
          </div>

          {/* ── Sidebar (col-span-1) ────────────────────────────────────────── */}
          <div className="md:col-span-1 flex flex-col gap-4">

            {/* Instance info card */}
            <div className="rounded-2xl border bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25 overflow-hidden">

              {/* Logo banner — only shown when there is a logo */}
              {logo && (
                <div className="relative h-28 overflow-hidden">
                  <img src={logo} alt="" aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-110 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-indigo-900/30 to-pink-900/50" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/70" />
                  <img src={logo} alt={instance.name}
                    className="relative z-10 w-20 h-20 rounded-2xl object-cover shadow-xl border-2 border-white/10 m-4"
                  />
                </div>
              )}

              <div className="p-4">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border mb-1.5 bg-purple-500/10 border-purple-500/25 text-purple-300">
                  <Package size={10} />
                  Instancia
                </div>
                <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight mb-2">
                  {instance.name}
                </h1>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="px-2 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                    {instance.mcVersion}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${loaderBadge}`}>
                    {loaderName}
                  </span>
                  {instance.modLoaderVersion && (
                    <span className="text-gray-600 text-xs font-mono self-center">{instance.modLoaderVersion}</span>
                  )}
                </div>
                {isRunning && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/25 text-green-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      En juego
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-700/40 pt-3">
                  {isRunning ? (
                    <button
                      onClick={() => window.launcher.instances.stop(instance.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 hover:border-red-400/40 text-red-400 rounded-xl text-sm font-medium transition-all"
                    >
                      <Square size={13} fill="currentColor" />
                      Detener
                    </button>
                  ) : (
                    <button
                      onClick={handlePlay}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Play size={13} fill="currentColor" />
                      Jugar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CurseForge panel */}
            {instance.cfMeta && (
              <div className="rounded-2xl border bg-gradient-to-br from-gray-800/90 via-orange-950/5 to-gray-900 border-orange-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500/15">
                    <Flame size={14} className="text-orange-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">CurseForge</h3>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-600 mb-0.5">Modpack</p>
                    <p className="text-sm font-medium text-gray-200 truncate">{instance.cfMeta.name}</p>
                  </div>
                  {instance.cfMeta.fileVersion && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-600 mb-0.5">Versión instalada</p>
                      <span className="inline-block px-2 py-0.5 rounded-lg text-xs border font-mono bg-orange-500/10 text-orange-300 border-orange-500/25">
                        {instance.cfMeta.fileVersion}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/catalog/${instance.cfMeta!.modpackId}`)}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 mt-1 rounded-xl text-sm font-semibold border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 hover:border-orange-400/50 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <ExternalLink size={13} />
                    Ver página del modpack
                  </button>
                </div>
              </div>
            )}

            {/* Modrinth panel */}
            {instance.mrMeta && (
              <div className="rounded-2xl border bg-gradient-to-br from-gray-800/90 via-green-950/5 to-gray-900 border-green-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-500/15">
                    <ExternalLink size={14} className="text-green-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Modrinth</h3>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-600 mb-0.5">Modpack</p>
                    <p className="text-sm font-medium text-gray-200 truncate">{instance.mrMeta.name}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/catalog/mr/${instance.mrMeta!.projectId}`)}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 mt-1 rounded-xl text-sm font-semibold border border-green-500/30 text-green-300 hover:bg-green-500/10 hover:border-green-400/50 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <ExternalLink size={13} />
                    Ver página del modpack
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Mod catalog modal */}
      {showCatalog && (
        <ModCatalogModal
          instance={instance}
          onClose={() => setShowCatalog(false)}
          onModInstalled={refreshMods}
          installedModIds={installedModIds}
          installedMrSlugs={installedMrSlugs}
          defaultSource={modSource}
        />
      )}

      {/* Datapack loader modal */}
      {showDatapackLoaderModal && instance && (
        <DatapackLoaderModal
          instance={instance}
          onClose={(ignore) => {
            if (ignore) localStorage.setItem(`datapackLoaderIgnored_${instance.id}`, 'true')
            setShowDatapackLoaderModal(false)
          }}
          onInstalled={() => { setShowDatapackLoaderModal(false); refreshMods() }}
        />
      )}

      {/* File catalog modal (datapacks / resourcepacks / shaderpacks) */}
      {showFileCatalog && (
        <FileCatalogModal
          instance={instance}
          type={showFileCatalog}
          installedFiles={(resourceFiles[showFileCatalog] ?? []).map(e => e.name)}
          defaultSource={modSource}
          onClose={() => setShowFileCatalog(null)}
          onInstalled={(filename) => {
            setResourceFiles(prev => ({
              ...prev,
              [showFileCatalog]: [...(prev[showFileCatalog] ?? []), { name: filename, isDir: false }],
            }))
          }}
        />
      )}

      {/* Crash report modal */}
      {crashReport && (
        <>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50" onClick={() => setCrashReport(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4 md:p-8">
            <div
              className="w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col bg-[#13111f] border-red-500/40"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/20 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/15">
                    <AlertCircle size={14} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">El juego ha crasheado</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Crash report — {instance.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setCrashReport(null)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-gray-400 hover:text-gray-200"
                >
                  <X size={15} />
                </button>
              </div>
              {/* Content */}
              <pre className="flex-1 overflow-y-auto px-5 py-4 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar">
                {crashReport}
              </pre>
            </div>
          </div>
        </>
      )}

      {/* Delete mod confirmation */}
      {modToDelete && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setModToDelete(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className="w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto bg-[#13111f] border-purple-500/40"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/15">
                    <Trash2 size={14} className="text-red-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-white">Eliminar mod</h3>
                </div>
                <button onClick={() => setModToDelete(null)} className="p-1.5 rounded-lg hover:bg-purple-500/15 text-gray-400 hover:text-gray-200 transition-colors">
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
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-700/60">
                <button
                  onClick={() => setModToDelete(null)}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleRemoveMod(modToDelete)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors"
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
