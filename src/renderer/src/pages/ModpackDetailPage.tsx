import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, AlertCircle, Check } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import Modal from '../components/common/Modal'
import type { CfMod, CfFile, InstallProgress } from '../types'
import { useInstall } from '../context/InstallContext'

// ── Constants ────────────────────────────────────────────────────────────────

const LOADER_NAMES: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }
const LOADER_COLORS: Record<number, string> = {
  1: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  4: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  5: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}
const CARD_CLASS = 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/30'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function formatDate(s?: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-2xl border bg-gradient-to-br from-gray-800/90 to-gray-900 border-purple-500/25">
      <span className="text-xs uppercase tracking-widest font-semibold mb-1 text-gray-500">{label}</span>
      <span className="font-bold text-sm text-white">{value}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'descripcion' | 'screenshots' | 'versiones'

export default function ModpackDetailPage() {
  const { modpackId } = useParams<{ modpackId: string }>()
  const navigate = useNavigate()
  const { startInstall, finishInstall, installing: activeInstalls } = useInstall()
  const isAnyInstalling = activeInstalls.length > 0
  const [mod, setMod] = useState<CfMod | null>(null)
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<CfFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('descripcion')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [installedFileIds, setInstalledFileIds] = useState<Set<number>>(new Set())
  const [installModal, setInstallModal] = useState<{ fileId: number } | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalNameError, setModalNameError] = useState('')

  useEffect(() => {
    window.launcher.instances.list().then((list: any[]) => {
      setInstalledFileIds(new Set(list.filter((i) => i.cfMeta?.fileId).map((i) => i.cfMeta.fileId as number)))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!modpackId) return
    const id = parseInt(modpackId)
    Promise.all([
      window.launcher.cf.getMod(id),
      window.launcher.cf.getModDescription(id),
      window.launcher.cf.getModFiles(id),
    ]).then(([modResp, desc, filesResp]) => {
      setMod(modResp?.data ?? null)
      setDescription(desc ?? '')
      const fileList: CfFile[] = filesResp?.data ?? []
      setFiles(fileList)
      if (fileList.length > 0) setSelectedFileId(fileList[0].id)
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [modpackId])

  useEffect(() => {
    const handleProgress = (p: InstallProgress) => setProgress(p)
    window.launcher.on('cf:installProgress', handleProgress)
    return () => window.launcher.off('cf:installProgress', handleProgress)
  }, [])

  function openInstallModal(fileId: number) {
    if (isAnyInstalling || installedFileIds.has(fileId)) return
    const defaultName = files.find((f) => f.id === fileId)?.displayName ?? mod?.name ?? ''
    setModalName(defaultName)
    setModalNameError('')
    setInstallModal({ fileId })
  }

  async function confirmInstall() {
    if (!installModal || !modalName.trim() || !mod) return
    try {
      const allInstances = await window.launcher.instances.list()
      if (allInstances.some((i: any) => i.name.toLowerCase() === modalName.trim().toLowerCase())) {
        setModalNameError('Ya existe una instancia con ese nombre')
        return
      }
    } catch { /* ignore */ }
    const { fileId } = installModal
    setInstallModal(null)
    await handleInstall(fileId, modalName.trim())
  }

  async function handleInstall(fileId: number, customName: string) {
    if (!mod) return
    if (installedFileIds.has(fileId)) return
    const installId = `cf-${mod.id}`
    setInstalling(true)
    setError('')
    setDone(false)
    startInstall(installId, customName)
    try {
      const fileVersion = files.find((f) => f.id === fileId)?.displayName ?? undefined
      await window.launcher.cf.installModpack(mod.id, fileId, customName, mod.logo?.url, fileVersion)
      setDone(true)
      finishInstall(installId)
      setTimeout(() => navigate('/instances'), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Error al instalar el modpack')
      setInstalling(false)
      finishInstall(installId)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]">
        <Loader2 size={24} className="text-purple-400 animate-spin" />
      </div>
    )
  }

  if (!mod) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all"
        >
          <ArrowLeft size={15} /> Volver al catálogo
        </button>
        <p className="text-gray-500">Modpack no encontrado</p>
      </div>
    )
  }

  // ── Derived data from full CF API response ────────────────────────────────

  const modAny = mod as any
  const screenshots: { id: number; title?: string; url: string; thumbnailUrl: string }[] = modAny.screenshots ?? []
  const authors: { id: number; name: string; url: string }[] = modAny.authors ?? []
  const dateReleased: string | undefined = modAny.dateReleased
  const popularityRank: number = modAny.gamePopularityRank ?? 0

  const loaderNums = [...new Set(
    (mod.latestFilesIndexes ?? []).map((f) => f.modLoader).filter((l): l is number => !!l)
  )]
  const mcVersions = [...new Set(
    (mod.latestFilesIndexes ?? []).map((f) => f.gameVersion).filter((v) => !!v && /^\d+\.\d+/.test(v))
  )]

  const isSelectedInstalled = selectedFileId !== null && installedFileIds.has(selectedFileId)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'descripcion', label: 'Descripción' },
    { id: 'screenshots', label: `Screenshots${screenshots.length ? ` (${screenshots.length})` : ''}` },
    { id: 'versiones',   label: `Versiones${files.length ? ` (${files.length})` : ''}` },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-6 pb-16">

        {/* Back button */}
        <button
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all hover:scale-[1.02] active:scale-95"
        >
          <ArrowLeft size={15} />
          Volver al catálogo
        </button>

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border overflow-hidden mb-5 ${CARD_CLASS}`}>

          {/* Banner */}
          <div className="h-20 sm:h-24 relative overflow-hidden">
            {mod.logo?.url && (
              <img src={mod.logo.url} alt="" aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-25" />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
          </div>

          {/* Logo + info */}
          <div className="px-5 pb-5 -mt-4 sm:-mt-5 flex flex-col sm:flex-row gap-4 sm:gap-5 relative z-10">

            {/* Logo */}
            <div className="flex-shrink-0">
              {mod.logo?.url ? (
                <img
                  src={mod.logo.url}
                  alt={mod.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-gray-900 shadow-xl"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-gray-900 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-xl">
                  📦
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5 leading-tight bg-gradient-to-r from-purple-300 via-pink-300 to-purple-200 bg-clip-text text-transparent">
                {mod.name}
              </h1>

              {mod.summary && (
                <p className="text-sm mb-3 leading-relaxed text-gray-400">{mod.summary}</p>
              )}

              {authors.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">Por</span>
                  {authors.map((author) => (
                    <span key={author.id} className="text-xs px-2.5 py-1 rounded-full border bg-purple-500/10 text-purple-300 border-purple-500/25 font-medium">
                      {author.name}
                    </span>
                  ))}
                </div>
              )}

              {(loaderNums.length > 0 || mcVersions.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {loaderNums.map((l) => LOADER_NAMES[l] && (
                    <span key={l} className={`px-2 py-0.5 rounded-full text-xs border font-medium ${LOADER_COLORS[l] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                      {LOADER_NAMES[l]}
                    </span>
                  ))}
                  {mcVersions.slice(0, 4).map((v) => (
                    <span key={v} className="px-2 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                      {v}
                    </span>
                  ))}
                  {mcVersions.length > 4 && (
                    <span className="text-xs self-center text-gray-600">+{mcVersions.length - 4} más</span>
                  )}
                </div>
              )}

              {/* Install action */}
              <div className="flex flex-col gap-2">
                {!installing && !done && !isAnyInstalling && !isSelectedInstalled && (
                  <button
                    onClick={() => selectedFileId && openInstallModal(selectedFileId)}
                    disabled={!selectedFileId}
                    className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-900/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <Download size={15} />
                    Instalar modpack
                  </button>
                )}

                {!installing && !done && isSelectedInstalled && (
                  <div className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
                    <Check size={15} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">Esta versión ya está instalada</span>
                  </div>
                )}

                {!installing && !done && isAnyInstalling && !isSelectedInstalled && (
                  <div className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
                    <Loader2 size={15} className="text-yellow-400 animate-spin shrink-0" />
                    <span className="text-yellow-300 text-sm font-medium">Instalación en progreso, espera...</span>
                  </div>
                )}

                {installing && progress && !done && (
                  <div className="max-w-xs">
                    <ProgressBar percent={progress.percent} label={progress.stage} />
                  </div>
                )}

                {done && (
                  <div className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
                    <Check size={15} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">¡Instalado! Redirigiendo...</span>
                  </div>
                )}

                {error && (
                  <div className="self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25">
                    <AlertCircle size={15} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatBadge label="Descargas"   value={formatDownloads(mod.downloadCount)} />
          <StatBadge label="Publicado"   value={formatDate(dateReleased)} />
          <StatBadge label="Actualizado" value={formatDate(mod.dateModified)} />
          <StatBadge label="Popularidad" value={popularityRank > 0 ? `#${popularityRank.toLocaleString()}` : '—'} />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-2xl border mb-4 bg-gray-800/60 border-gray-700/60" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <section className={`rounded-2xl border p-5 sm:p-6 ${CARD_CLASS}`}>

          {/* Descripción */}
          {tab === 'descripcion' && (
            description ? (
              <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40">
                <div
                  className="prose prose-invert prose-sm max-w-none text-gray-300 [&_img]:max-w-full [&_a]:text-purple-400 [&_a]:no-underline [&_a:hover]:underline"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin descripción disponible.</p>
            )
          )}

          {/* Screenshots */}
          {tab === 'screenshots' && (
            screenshots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {screenshots.map((ss) => (
                  <button
                    key={ss.id}
                    onClick={() => setLightbox(ss.url || ss.thumbnailUrl)}
                    className="aspect-video overflow-hidden rounded-xl border border-purple-500/20 hover:border-purple-400/50 transition-all hover:-translate-y-0.5 hover:shadow-xl group"
                    aria-label={ss.title || 'Ver screenshot en grande'}
                  >
                    <img
                      src={ss.thumbnailUrl}
                      alt={ss.title || `Screenshot ${ss.id}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No hay screenshots disponibles.</p>
            )
          )}

          {/* Versiones */}
          {tab === 'versiones' && (
            files.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest border-b text-gray-500 border-gray-700/60">
                      <th className="pb-3 text-left font-semibold">Nombre</th>
                      <th className="pb-3 text-left font-semibold">Versión MC</th>
                      <th className="pb-3 text-left font-semibold">Fecha</th>
                      <th className="pb-3 text-right font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/40">
                    {files.map((file) => (
                      <tr key={file.id} className="transition-colors hover:bg-purple-500/5">
                        <td className="py-3 pr-4">
                          <span className="line-clamp-1 text-xs font-medium text-gray-200">
                            {file.displayName || file.fileName}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {(file.gameVersions ?? [])
                              .filter((v) => /^\d+\.\d+/.test(v))
                              .slice(0, 3)
                              .map((v) => (
                                <span key={v} className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                  {v}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-xs text-gray-500">
                          {formatDate(file.fileDate)}
                        </td>
                        <td className="py-3 text-right">
                          {installedFileIds.has(file.id) ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-500/10 border border-green-500/25 text-green-400">
                              <Check size={11} />
                              Instalado
                            </span>
                          ) : (
                            <button
                              onClick={() => openInstallModal(file.id)}
                              disabled={installing || isAnyInstalling}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
                            >
                              {isAnyInstalling ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                              Instalar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No hay versiones disponibles.</p>
            )
          )}

        </section>
      </div>

      {/* Install name modal */}
      <Modal
        open={!!installModal}
        onClose={() => setInstallModal(null)}
        title="Nombre de la instancia"
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-gray-400 mb-3">
          Elige un nombre para esta instancia. Puedes editarlo para distinguir versiones.
        </p>
        <input
          type="text"
          value={modalName}
          onChange={(e) => { setModalName(e.target.value); setModalNameError('') }}
          onKeyDown={(e) => e.key === 'Enter' && confirmInstall()}
          placeholder="Nombre de la instancia"
          autoFocus
          className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all mb-1"
        />
        {modalNameError && (
          <p className="text-red-400 text-xs mb-3 flex items-center gap-1">
            <AlertCircle size={12} />
            {modalNameError}
          </p>
        )}
        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={() => setInstallModal(null)}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmInstall}
            disabled={!modalName.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Instalar
          </button>
        </div>
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Screenshot"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
