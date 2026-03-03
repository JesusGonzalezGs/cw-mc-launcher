import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Square, Package, Terminal, Settings2, Trash2, ToggleLeft, ToggleRight, Save } from 'lucide-react'
import type { Instance } from '../types'
import { LOADER_NAMES } from '../constants'

type Tab = 'mods' | 'console' | 'settings'

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
  const [logs, setLogs] = useState<string[]>([])
  const [jvmArgs, setJvmArgs] = useState('')
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    window.launcher.instances.get(id).then((inst) => {
      if (!inst) { navigate('/instances'); return }
      setInstance(inst)
      setJvmArgs(inst.jvmArgs ?? '')
    })
    window.launcher.instances.getMods(id).then(setMods)
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
    if (!id) return
    await window.launcher.instances.toggleMod(id, filename)
    const updated = await window.launcher.instances.getMods(id)
    setMods(updated)
  }

  async function handleRemoveMod(filename: string) {
    if (!id || !confirm(`¿Eliminar ${filename}?`)) return
    await window.launcher.instances.removeMod(id, filename)
    setMods((prev) => prev.filter((m) => m !== filename))
  }

  if (!instance) return null

  const loaderName = LOADER_NAMES[instance.modLoader] ?? instance.modLoader
  const loaderBadge = LOADER_BADGE_COLORS[instance.modLoader] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25'
  const logo = instance.cfMeta?.logoUrl

  const TABS: [Tab, any, string][] = [
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
      <div className="relative z-10 px-5 pt-5 pb-4 border-b border-purple-500/20 bg-gray-900/30 backdrop-blur-sm">

        {/* Banner blur */}
        {logo && (
          <img src={logo} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-10 blur-xl scale-110 pointer-events-none"
          />
        )}

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/instances')}
              className="shrink-0 p-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-purple-300 via-pink-300 to-purple-200 bg-clip-text text-transparent truncate">
                {instance.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                  {instance.mcVersion}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs border font-medium ${loaderBadge}`}>
                  {loaderName}
                </span>
                {instance.modLoaderVersion && (
                  <span className="text-gray-600 text-xs">{instance.modLoaderVersion}</span>
                )}
                {isRunning && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Ejecutando
                  </span>
                )}
              </div>
            </div>
          </div>

          {isRunning ? (
            <button
              onClick={() => window.launcher.instances.stop(instance.id)}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-sm transition-colors"
            >
              <Square size={14} />
              Detener
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-95"
            >
              <Play size={14} />
              Jugar
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex gap-1 p-1 mx-5 mt-4 rounded-2xl border bg-gray-800/60 border-gray-700/60 w-fit" role="tablist">
        {TABS.map(([t, Icon, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-all font-medium ${
              tab === t
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-5 relative z-10">

        {/* Mods */}
        {tab === 'mods' && (
          <div className="overflow-y-auto h-full space-y-2 custom-scrollbar">
            {mods.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-800/60 border border-gray-700/60">
                  <Package size={22} className="text-gray-600" />
                </div>
                <p className="text-gray-600 text-sm">No hay mods instalados</p>
              </div>
            ) : (
              mods.map((filename) => {
                const disabled = filename.endsWith('.jar.disabled')
                const displayName = filename.replace('.jar.disabled', '').replace('.jar', '')
                return (
                  <div key={filename} className="flex items-center justify-between bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/20 rounded-xl px-4 py-2.5">
                    <span className={`text-sm truncate flex-1 mr-3 ${disabled ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                      {displayName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleMod(filename)}
                        className={`p-1 rounded-lg transition-colors ${disabled ? 'text-gray-600 hover:text-gray-400 hover:bg-gray-700/50' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'}`}
                        title={disabled ? 'Activar' : 'Desactivar'}
                      >
                        {disabled ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
                      </button>
                      <button
                        onClick={() => handleRemoveMod(filename)}
                        className="p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Console */}
        {tab === 'console' && (
          <div
            ref={logsRef}
            aria-live="polite"
            className="h-full bg-gray-950 border border-gray-800/80 rounded-2xl p-4 overflow-y-auto custom-scrollbar font-mono text-xs leading-5"
          >
            {logs.length === 0 ? (
              <p className="text-gray-700">Los logs del juego aparecerán aquí...</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={
                  line.includes('[ERROR]') || line.includes('ERROR') ? 'text-red-400' :
                  line.includes('WARN') ? 'text-yellow-400' :
                  'text-gray-400'
                }>
                  {line}
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="space-y-4 max-w-sm">
            <div className="bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/25 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Argumentos JVM</label>
                <input
                  type="text"
                  value={jvmArgs}
                  onChange={(e) => setJvmArgs(e.target.value)}
                  placeholder="-Xmx4G -XX:+UseG1GC"
                  className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
                <p className="text-xs text-gray-600 mt-1.5">Deja en blanco para usar los args globales</p>
              </div>
              <button
                onClick={async () => {
                  const updated = { ...instance, jvmArgs }
                  await window.launcher.instances.create(updated)
                  setInstance(updated)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
              >
                <Save size={14} />
                Guardar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
