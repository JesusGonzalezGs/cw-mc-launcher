import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, AlertCircle, Trash2, Gamepad2, Layers, PackageOpen, Loader2 } from 'lucide-react'
import InstanceCard from '../components/InstanceCard'
import Modal from '../components/common/Modal'
import type { Instance } from '../types'
import { useInstall } from '../context/InstallContext'

function InstallingCard({ name }: { name: string }) {
  return (
    <div className="rounded-2xl border border-purple-500/30 overflow-hidden flex flex-col shadow-md bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900">
      <div className="h-28 relative bg-gradient-to-br from-purple-900/50 via-indigo-900/40 to-pink-900/50 flex items-center justify-center">
        <Loader2 size={28} className="text-purple-400 animate-spin opacity-70" />
      </div>
      <div className="p-3 flex-1">
        <p className="text-sm font-semibold text-gray-200 truncate mb-2">{name}</p>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-500/15 border-purple-500/30 text-purple-300">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Instalando...
        </span>
      </div>
    </div>
  )
}

export default function InstancesPage() {
  const navigate = useNavigate()
  const { installing } = useInstall()
  const prevInstallingCount = useRef(installing.length)
  const [instances, setInstances] = useState<Instance[]>([])
  const installingNames = new Set(installing.map((i) => i.name))
  const visibleInstances = instances.filter((inst) => !installingNames.has(inst.name))
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Instance | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await window.launcher.instances.list()
      setInstances(list)
      const runSet = new Set<string>()
      for (const inst of list) {
        if (await window.launcher.instances.isRunning(inst.id)) {
          runSet.add(inst.id)
        }
      }
      setRunningIds(runSet)
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()

    const handleStopped = ({ instanceId }: any) => {
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(instanceId)
        return next
      })
    }

    window.launcher.on('game:stopped', handleStopped)
    return () => window.launcher.off('game:stopped', handleStopped)
  }, [load])

  useEffect(() => {
    if (installing.length < prevInstallingCount.current) {
      load()
    }
    prevInstallingCount.current = installing.length
  }, [installing.length, load])

  async function handlePlay(instance: Instance) {
    setError('')
    try {
      setRunningIds((prev) => new Set(prev).add(instance.id))
      await window.launcher.instances.launch(instance)
    } catch (e: any) {
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(instance.id)
        return next
      })
      setError(e.message)
    }
  }

  async function handleStop(instance: Instance) {
    await window.launcher.instances.stop(instance.id)
    setRunningIds((prev) => {
      const next = new Set(prev)
      next.delete(instance.id)
      return next
    })
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const inst = pendingDelete
    setPendingDelete(null)
    await window.launcher.instances.delete(inst.id)
    load()
  }

  async function handleClone(instance: Instance) {
    setError('')
    try {
      await window.launcher.instances.clone(instance.id)
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      {/* Delete modal */}
      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Eliminar instancia"
        maxWidth="max-w-sm"
      >
        <p className="text-gray-300 text-sm mb-5">
          ¿Eliminar la instancia <span className="font-semibold text-white">"{pendingDelete?.name}"</span>? Esta acción es irreversible.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setPendingDelete(null)}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDelete}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors"
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </Modal>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 bg-purple-500/10 border-purple-500/25 text-purple-300">
              <Gamepad2 size={11} />
              Launcher
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
              Mis Instancias
            </h1>
            <p className="text-sm text-gray-500">Gestiona e inicia tus instancias de Minecraft</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Stats pills */}
            {(visibleInstances.length > 0 || installing.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-gray-800/80 border-gray-700 text-gray-400">
                  <Layers size={11} />
                  {visibleInstances.length} {visibleInstances.length === 1 ? 'instancia' : 'instancias'}
                </span>
                {installing.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-purple-500/10 border-purple-500/25 text-purple-300">
                    <Loader2 size={11} className="animate-spin" />
                    {installing.length} instalando
                  </span>
                )}
                {runningIds.size > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-green-500/10 border-green-500/25 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {runningIds.size} activa{runningIds.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => navigate('/instances/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Plus size={15} />
              Nueva instancia
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {visibleInstances.length === 0 && installing.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-800/60 border border-gray-700/60">
              <PackageOpen size={28} className="text-gray-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-gray-400 mb-1">Sin instancias</p>
              <p className="text-xs text-gray-600">Crea una instancia o instala un modpack desde el catálogo.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/instances/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus size={14} />
                Nueva instancia
              </button>
              <button
                onClick={() => navigate('/catalog')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all hover:scale-[1.02] active:scale-95"
              >
                Ver catálogo
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {installing.map((item) => (
              <InstallingCard key={item.id} name={item.name} />
            ))}
            {visibleInstances.map((inst) => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                isRunning={runningIds.has(inst.id)}
                onPlay={() => handlePlay(inst)}
                onStop={() => handleStop(inst)}
                onDelete={() => setPendingDelete(inst)}
                onClone={() => handleClone(inst)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
