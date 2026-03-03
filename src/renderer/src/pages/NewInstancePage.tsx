import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import type { ModLoader, McVersion } from '../types'
import { LOADER_NAMES } from '../constants'

type Tab = 'vanilla' | 'modded'
type VersionFilter = 'release' | 'snapshot' | 'all'

interface DownloadProgress {
  stage: string
  percent: number
}

export default function NewInstancePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('vanilla')

  // Versiones de MC (Mojang)
  const [mcVersions, setMcVersions] = useState<McVersion[]>([])
  const [versionFilter, setVersionFilter] = useState<VersionFilter>('release')
  const [loadingMcVersions, setLoadingMcVersions] = useState(true)

  // Campos del formulario
  const [name, setName] = useState('')
  const [mcVersion, setMcVersion] = useState('')
  const [loader, setLoader] = useState<ModLoader>('fabric')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [loaderVersions, setLoaderVersions] = useState<{ id: string; stable: boolean }[]>([])
  const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false)

  // Estado de creación
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [installLog, setInstallLog] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Limpiar el timeout de navegación si el componente se desmonta antes de que dispare
  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current)
    }
  }, [])

  // Cargar versiones de Mojang al montar
  useEffect(() => {
    window.launcher.mc.getVersionManifest()
      .then((manifest: any) => {
        const versions: McVersion[] = manifest?.versions ?? []
        setMcVersions(versions)
        // Seleccionar la última release por defecto
        const latestRelease = versions.find((v) => v.type === 'release')
        setMcVersion(latestRelease?.id ?? versions[0]?.id ?? '')
      })
      .catch((e: any) => setError(`Error cargando versiones: ${e.message}`))
      .finally(() => setLoadingMcVersions(false))
  }, [])

  // Filtrar versiones según el filtro seleccionado
  const filteredVersions = mcVersions.filter((v) => {
    if (versionFilter === 'release') return v.type === 'release'
    if (versionFilter === 'snapshot') return v.type === 'snapshot'
    return true
  })

  // Cuando cambia el filtro, reajustar la versión seleccionada si ya no está visible
  useEffect(() => {
    if (!filteredVersions.find((v) => v.id === mcVersion)) {
      setMcVersion(filteredVersions[0]?.id ?? '')
    }
  }, [versionFilter])

  // Cargar versiones del loader cuando cambia loader o mcVersion
  useEffect(() => {
    if (tab === 'vanilla' || !mcVersion) { setLoaderVersions([]); setLoaderVersion(''); return }
    setLoadingLoaderVersions(true)
    setError('')
    const fetch = async () => {
      try {
        let versions: { id: string; stable: boolean }[] = []
        if (loader === 'fabric') {
          versions = await window.launcher.loaders.fabricVersions()
        } else if (loader === 'quilt') {
          versions = await window.launcher.loaders.quiltVersions()
        } else if (loader === 'forge') {
          const v = await window.launcher.loaders.forgeVersions(mcVersion)
          versions = v.map((id: string) => ({ id, stable: true }))
        } else if (loader === 'neoforge') {
          const v = await window.launcher.loaders.neoforgeVersions(mcVersion)
          versions = v.map((id: string) => ({ id, stable: true }))
        }
        setLoaderVersions(versions)
        setLoaderVersion(versions[0]?.id ?? '')
      } catch (e: any) {
        setError(`Error cargando versiones del loader: ${e.message}`)
      } finally {
        setLoadingLoaderVersions(false)
      }
    }
    fetch()
  }, [loader, mcVersion, tab])

  // Escuchar progreso de descarga de Minecraft
  useEffect(() => {
    const handler = (data: any) => {
      setProgress({ stage: data.stage, percent: data.percent })
    }
    window.launcher.on('mc:downloadProgress', handler)
    return () => window.launcher.off('mc:downloadProgress', handler)
  }, [])

  // Escuchar progreso del instalador de Forge/NeoForge
  useEffect(() => {
    const handler = (data: any) => {
      setProgress({ stage: data.msg, percent: data.percent ?? 0 })
      setInstallLog((prev) => [...prev.slice(-199), data.msg])
    }
    window.launcher.on('loaders:progress', handler)
    return () => window.launcher.off('loaders:progress', handler)
  }, [])

  // Auto-scroll del log al añadir nuevas líneas
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [installLog])

  async function handleCreate() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!mcVersion) { setError('Selecciona una versión de Minecraft'); return }
    if (tab === 'modded' && !loaderVersion) { setError('Selecciona una versión del loader'); return }

    setCreating(true)
    setError('')
    setInstallLog([])
    setProgress({ stage: 'Descargando Minecraft...', percent: 0 })

    try {
      await window.launcher.mc.downloadVersion(mcVersion)

      let resolvedVersionId = mcVersion

      if (tab === 'modded') {
        if (loader === 'fabric') {
          setProgress({ stage: 'Instalando Fabric...', percent: 0 })
          const r = await window.launcher.loaders.installFabric(mcVersion, loaderVersion)
          resolvedVersionId = r.versionId
        } else if (loader === 'quilt') {
          setProgress({ stage: 'Instalando Quilt...', percent: 0 })
          const r = await window.launcher.loaders.installQuilt(mcVersion, loaderVersion)
          resolvedVersionId = r.versionId
        } else if (loader === 'forge') {
          setProgress({ stage: 'Instalando Forge...', percent: 0 })
          const r = await window.launcher.loaders.installForge(mcVersion, loaderVersion)
          resolvedVersionId = r.versionId
        } else if (loader === 'neoforge') {
          setProgress({ stage: 'Instalando NeoForge...', percent: 0 })
          const r = await window.launcher.loaders.installNeoForge(mcVersion, loaderVersion)
          resolvedVersionId = r.versionId
        }
      }

      setProgress({ stage: 'Creando instancia...', percent: 95 })
      await window.launcher.instances.create({
        name: name.trim(),
        mcVersion,
        modLoader: tab === 'vanilla' ? 'vanilla' : loader,
        modLoaderVersion: tab === 'modded' ? loaderVersion : '',
        resolvedVersionId,
        source: 'manual',
      })

      setProgress({ stage: '¡Listo!', percent: 100 })
      setCreating(false)
      navTimeoutRef.current = setTimeout(() => navigate('/instances'), 400)
    } catch (e: any) {
      setError(e.message ?? 'Error al crear la instancia')
      setCreating(false)
      setProgress(null)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button
        onClick={() => navigate('/instances')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      <h1 className="text-xl font-bold text-white mb-6">Nueva instancia</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-800 rounded-xl mb-6">
        {(['vanilla', 'modded'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t === 'vanilla') setLoaderVersions([])
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t === 'vanilla' ? 'Vanilla' : 'Con mods'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Nombre */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Nombre de la instancia</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mi instancia"
            disabled={creating}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Versión MC */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-400">Versión de Minecraft</label>
            {/* Filtro de tipo */}
            <div className="flex gap-1">
              {(['release', 'snapshot', 'all'] as VersionFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setVersionFilter(f)}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                    versionFilter === f
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {f === 'release' ? 'Releases' : f === 'snapshot' ? 'Snapshots' : 'Todas'}
                </button>
              ))}
            </div>
          </div>

          {loadingMcVersions ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
              <Loader2 size={14} className="animate-spin" />
              Cargando versiones de Mojang...
            </div>
          ) : (
            <div className="relative">
              <select
                value={mcVersion}
                onChange={(e) => setMcVersion(e.target.value)}
                disabled={creating}
                className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
              >
                {filteredVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id}
                    {v.type !== 'release' ? ` (${v.type})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Mod loader */}
        {tab === 'modded' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Mod loader</label>
              <div className="relative">
                <select
                  value={loader}
                  onChange={(e) => setLoader(e.target.value as ModLoader)}
                  disabled={creating}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                >
                  {(['fabric', 'quilt', 'forge', 'neoforge'] as ModLoader[]).map((l) => (
                    <option key={l} value={l}>{LOADER_NAMES[l]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Versión de {LOADER_NAMES[loader]}
              </label>
              {loadingLoaderVersions ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-1">
                  <Loader2 size={14} className="animate-spin" />
                  Cargando versiones...
                </div>
              ) : loaderVersions.length === 0 ? (
                <p className="text-yellow-500 text-sm py-1">
                  No hay versiones disponibles de {LOADER_NAMES[loader]} para Minecraft {mcVersion}
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={loaderVersion}
                    onChange={(e) => setLoaderVersion(e.target.value)}
                    disabled={creating}
                    className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  >
                    {loaderVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}{!v.stable ? ' (unstable)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              )}
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Progreso de instalación */}
        {creating && progress && (
          <div className="space-y-2">
            <ProgressBar percent={progress.percent} label={progress.stage} />
            {installLog.length > 0 && (
              <div
                ref={logRef}
                className="bg-gray-950 border border-gray-800 rounded-lg p-3 h-36 overflow-y-auto"
              >
                {installLog.map((line, i) => (
                  <p key={i} className="font-mono text-xs text-gray-400 leading-5 break-all">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || !mcVersion || loadingMcVersions}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
        >
          {creating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              Creando...
            </span>
          ) : (
            'Crear instancia'
          )}
        </button>
      </div>
    </div>
  )
}
