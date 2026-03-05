import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertCircle, Plus } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import FilterSelect from '../components/common/FilterSelect'
import type { ModLoader, McVersion } from '../types'
import { LOADER_NAMES } from '../constants'
import { useInstall } from '../context/InstallContext'

type Tab = 'vanilla' | 'modded'
type VersionFilter = 'release' | 'snapshot' | 'all'

interface DownloadProgress {
  stage: string
  percent: number
}

const INPUT_CLASS = 'w-full bg-gray-800/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all disabled:opacity-50'

export default function NewInstancePage() {
  const navigate = useNavigate()
  const { startInstall, finishInstall, installing: globalInstalling } = useInstall()
  const [tab, setTab] = useState<Tab>('vanilla')

  const [mcVersions, setMcVersions] = useState<McVersion[]>([])
  const [versionFilter, setVersionFilter] = useState<VersionFilter>('release')
  const [loadingMcVersions, setLoadingMcVersions] = useState(true)

  const [name, setName] = useState('')
  const [mcVersion, setMcVersion] = useState('')
  const [loader, setLoader] = useState<ModLoader>('fabric')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [loaderVersions, setLoaderVersions] = useState<{ id: string; stable: boolean }[]>([])
  const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false)

  const [creating, setCreating] = useState(false)
  const isGloballyInstalling = globalInstalling.length > 0 && !creating
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [installLog, setInstallLog] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.launcher.mc.getVersionManifest()
      .then((manifest: any) => {
        const versions: McVersion[] = manifest?.versions ?? []
        setMcVersions(versions)
        const latestRelease = versions.find((v) => v.type === 'release')
        setMcVersion(latestRelease?.id ?? versions[0]?.id ?? '')
      })
      .catch((e: any) => setError(`Error cargando versiones: ${e.message}`))
      .finally(() => setLoadingMcVersions(false))
  }, [])

  const filteredVersions = mcVersions.filter((v) => {
    if (versionFilter === 'release') return v.type === 'release'
    if (versionFilter === 'snapshot') return v.type === 'snapshot'
    return true
  })

  useEffect(() => {
    if (!filteredVersions.find((v) => v.id === mcVersion)) {
      setMcVersion(filteredVersions[0]?.id ?? '')
    }
  }, [versionFilter])

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

  useEffect(() => {
    const handler = (data: any) => {
      setProgress({ stage: data.stage, percent: data.percent })
    }
    window.launcher.on('mc:downloadProgress', handler)
    return () => window.launcher.off('mc:downloadProgress', handler)
  }, [])

  useEffect(() => {
    const handler = (data: any) => {
      setProgress({ stage: data.msg, percent: data.percent ?? 0 })
      setInstallLog((prev) => [...prev.slice(-199), data.msg])
    }
    window.launcher.on('loaders:progress', handler)
    return () => window.launcher.off('loaders:progress', handler)
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [installLog])

  async function handleCreate() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!mcVersion) { setError('Selecciona una versión de Minecraft'); return }
    if (tab === 'modded' && !loaderVersion) { setError('Selecciona una versión del loader'); return }

    try {
      const existing = await window.launcher.instances.list()
      if (existing.some((i: any) => i.name.toLowerCase() === name.trim().toLowerCase())) {
        setError('Ya existe una instancia con ese nombre')
        return
      }
    } catch { /* continue if list fails */ }

    setCreating(true)
    setError('')
    setInstallLog([])
    setProgress({ stage: 'Descargando Minecraft...', percent: 0 })

    const installId = `manual-${Date.now()}`
    startInstall(installId, name.trim())

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
      finishInstall(installId)
    } catch (e: any) {
      setError(e.message ?? 'Error al crear la instancia')
      setCreating(false)
      finishInstall(installId)
      setProgress(null)
    }
  }

  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* Back button */}
        <button
          onClick={() => navigate('/instances')}
          className="flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all hover:scale-[1.02] active:scale-95"
        >
          <ArrowLeft size={15} />
          Volver a instancias
        </button>

        {/* Header */}
        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 bg-purple-500/10 border-purple-500/25 text-purple-300">
            <Plus size={11} />
            Nueva instancia
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Crear instancia
          </h1>
        </div>

        {/* Form card */}
        <div className="bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border border-purple-500/30 rounded-2xl p-6 space-y-5">

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-2xl border bg-gray-800/60 border-gray-700/60" role="tablist">
            {(['vanilla', 'modded'] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t)
                  if (t === 'vanilla') setLoaderVersions([])
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }`}
              >
                {t === 'vanilla' ? 'Vanilla' : 'Con mods'}
              </button>
            ))}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nombre de la instancia</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi instancia"
              disabled={creating}
              className={INPUT_CLASS}
            />
          </div>

          {/* Versión MC */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-gray-400">Versión de Minecraft</label>
              <div className="flex gap-1">
                {(['release', 'snapshot', 'all'] as VersionFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setVersionFilter(f)}
                    className={`px-2 py-0.5 text-xs rounded-lg transition-all ${
                      versionFilter === f
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    {f === 'release' ? 'Releases' : f === 'snapshot' ? 'Snapshots' : 'Todas'}
                  </button>
                ))}
              </div>
            </div>

            {loadingMcVersions ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                <Loader2 size={14} className="animate-spin text-purple-400" />
                Cargando versiones de Mojang...
              </div>
            ) : (
              <FilterSelect
                fullWidth
                disabled={creating}
                value={mcVersion}
                onChange={setMcVersion}
                options={filteredVersions.map((v) => ({
                  value: v.id,
                  label: `${v.id}${v.type !== 'release' ? ` (${v.type})` : ''}`,
                }))}
              />
            )}
          </div>

          {/* Mod loader */}
          {tab === 'modded' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Mod loader</label>
                <FilterSelect
                  fullWidth
                  disabled={creating}
                  value={loader}
                  onChange={(v) => setLoader(v as ModLoader)}
                  options={(['fabric', 'quilt', 'forge', 'neoforge'] as ModLoader[]).map((l) => ({
                    value: l,
                    label: LOADER_NAMES[l],
                  }))}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Versión de {LOADER_NAMES[loader]}
                </label>
                {loadingLoaderVersions ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-1">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    Cargando versiones...
                  </div>
                ) : loaderVersions.length === 0 ? (
                  <p className="text-yellow-500/80 text-sm py-1">
                    No hay versiones de {LOADER_NAMES[loader]} para Minecraft {mcVersion}
                  </p>
                ) : (
                  <FilterSelect
                    fullWidth
                    disabled={creating}
                    value={loaderVersion}
                    onChange={setLoaderVersion}
                    options={loaderVersions.map((v) => ({
                      value: v.id,
                      label: `${v.id}${!v.stable ? ' (unstable)' : ''}`,
                    }))}
                  />
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

          {/* Progress */}
          {creating && progress && (
            <div className="space-y-2">
              <ProgressBar percent={progress.percent} label={progress.stage} />
              {installLog.length > 0 && (
                <div
                  ref={logRef}
                  className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 h-36 overflow-y-auto"
                >
                  {installLog.map((line, i) => (
                    <p key={i} className="font-mono text-xs text-gray-400 leading-5 break-all">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create button */}
          {isGloballyInstalling && (
            <p className="text-xs text-center text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
              Hay una instalación en progreso. Espera a que termine para crear una nueva instancia.
            </p>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || isGloballyInstalling || !name.trim() || !mcVersion || loadingMcVersions}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all hover:scale-[1.01] active:scale-95 shadow-md shadow-purple-900/25"
          >
            {creating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus size={15} />
                Crear instancia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
