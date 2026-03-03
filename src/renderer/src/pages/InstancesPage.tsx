import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, AlertCircle } from 'lucide-react'
import InstanceCard from '../components/InstanceCard'
import type { Instance } from '../types'

export default function InstancesPage() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState<Instance[]>([])
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const list = await window.launcher.instances.list()
      setInstances(list)
      // Verificar cuáles están corriendo
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

  async function handleDelete(instance: Instance) {
    if (!confirm(`¿Eliminar la instancia "${instance.name}"? Esta acción es irreversible.`)) return
    await window.launcher.instances.delete(instance.id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Instancias</h1>
          <p className="text-gray-500 text-sm">{instances.length} instancia{instances.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/instances/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nueva instancia
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {instances.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
            <Plus size={28} className="text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No hay instancias</p>
          <p className="text-gray-600 text-sm mt-1">Crea tu primera instancia o instala un modpack del catálogo</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => navigate('/instances/new')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm transition-colors"
            >
              Crear instancia
            </button>
            <button
              onClick={() => navigate('/catalog')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors"
            >
              Ver catálogo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              isRunning={runningIds.has(inst.id)}
              onPlay={() => handlePlay(inst)}
              onStop={() => handleStop(inst)}
              onDelete={() => handleDelete(inst)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
