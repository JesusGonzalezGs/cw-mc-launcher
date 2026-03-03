import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Square, Package, Terminal, Settings2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Instance } from '../types'
import { LOADER_NAMES } from '../constants'

type Tab = 'mods' | 'console' | 'settings'

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/instances')}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{instance.name}</h1>
            <p className="text-gray-500 text-sm">
              Minecraft {instance.mcVersion} · {LOADER_NAMES[instance.modLoader] ?? instance.modLoader}
              {instance.modLoaderVersion && ` ${instance.modLoaderVersion}`}
            </p>
          </div>
        </div>
        {isRunning ? (
          <button
            onClick={() => window.launcher.instances.stop(instance.id)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-sm transition-colors"
          >
            <Square size={14} />
            Detener
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Play size={14} />
            Jugar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 mx-5 mt-4 bg-gray-800/50 rounded-xl w-fit">
        {([['mods', Package, 'Mods'], ['console', Terminal, 'Consola'], ['settings', Settings2, 'Ajustes']] as [Tab, any, string][]).map(([t, Icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors
              ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Icon size={14} />
            {label}
            {t === 'mods' && mods.length > 0 && (
              <span className="bg-gray-600 text-gray-300 text-xs px-1.5 rounded-full">{mods.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-5">
        {tab === 'mods' && (
          <div className="space-y-2 overflow-y-auto h-full custom-scrollbar">
            {mods.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No hay mods instalados</p>
            ) : (
              mods.map((filename) => {
                const disabled = filename.endsWith('.jar.disabled')
                const displayName = filename.replace('.jar.disabled', '').replace('.jar', '')
                return (
                  <div key={filename} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5">
                    <span className={`text-sm truncate flex-1 mr-3 ${disabled ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                      {displayName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleMod(filename)}
                        className={`transition-colors ${disabled ? 'text-gray-600 hover:text-gray-400' : 'text-purple-400 hover:text-purple-300'}`}
                        title={disabled ? 'Activar' : 'Desactivar'}
                      >
                        {disabled ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
                      </button>
                      <button
                        onClick={() => handleRemoveMod(filename)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
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

        {tab === 'console' && (
          <div
            ref={logsRef}
            aria-live="polite"
            className="h-full bg-gray-950 border border-gray-800 rounded-xl p-4 overflow-y-auto custom-scrollbar font-mono text-xs leading-5"
          >
            {logs.length === 0 ? (
              <p className="text-gray-700">Los logs del juego aparecerán aquí...</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={`${line.includes('[ERROR]') || line.includes('ERROR') ? 'text-red-400' : line.includes('WARN') ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {line}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Argumentos JVM</label>
              <input
                type="text"
                value={jvmArgs}
                onChange={(e) => setJvmArgs(e.target.value)}
                placeholder="-Xmx4G -XX:+UseG1GC"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              <p className="text-xs text-gray-600 mt-1">Deja en blanco para usar los args globales</p>
            </div>
            <button
              onClick={async () => {
                const updated = { ...instance, jvmArgs }
                await window.launcher.instances.create(updated)
                setInstance(updated)
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm transition-colors"
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
