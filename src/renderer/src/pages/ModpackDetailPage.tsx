import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, AlertCircle, Check, Search, Tag, Layers, ExternalLink } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import Modal from '../components/common/Modal'
import FilterSelect from '../components/common/FilterSelect'
import type { CfMod, CfFile } from '../types'
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

function getFileMcVersions(file: CfFile): string[] {
  const fromGV = (file.gameVersions ?? []).filter((v) => /^\d+\.\d+/.test(v))
  if (fromGV.length > 0) return fromGV
  return (file.sortableGameVersions ?? [])
    .map((e) => e.gameVersionName ?? '')
    .filter((v) => /^\d+\.\d+/.test(v))
}

function getFileLoader(file: CfFile): number | null {
  // Newer CF files include the loader name directly in gameVersions
  const gv = file.gameVersions ?? []
  if (gv.includes('NeoForge')) return 6
  if (gv.includes('Forge')) return 1
  if (gv.includes('Fabric')) return 4
  if (gv.includes('Quilt')) return 5

  // Older CF files have the loader only in sortableGameVersions.gameVersionName
  // (e.g. "Forge-14.23.5.2860", "Fabric-0.14.21", etc.)
  for (const entry of file.sortableGameVersions ?? []) {
    const name = (entry.gameVersionName ?? '').toLowerCase()
    if (name.includes('neoforge')) return 6
    if (name.includes('forge')) return 1
    if (name.includes('fabric')) return 4
    if (name.includes('quilt')) return 5
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeHtml(html: string): string {
  let out = html
  // Replace YouTube iframes (with closing tag) with a clickable link
  out = out.replace(/<iframe[^>]*src="([^"]*(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi, (_m, src) =>
    `<a href="${src}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;margin:4px 0;border-radius:10px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-size:12px;font-weight:600;text-decoration:none;">▶ Ver en YouTube</a>`
  )
  // Strip remaining iframes (with closing tag, self-closing, or unclosed)
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  out = out.replace(/<iframe[^>]*\/?>/gi, '')
  // Strip script tags — they can trigger external network requests
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<script[^>]*\/?>/gi, '')
  return out
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

type Tab = 'descripcion' | 'screenshots' | 'versiones' | 'changelog'

export default function ModpackDetailPage() {
  const { modpackId } = useParams<{ modpackId: string }>()
  const navigate = useNavigate()
  const { startInstall, finishInstall, installing: activeInstalls, progress } = useInstall()
  const [mod, setMod] = useState<CfMod | null>(null)
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<CfFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const isAnyInstalling = activeInstalls.length > 0
  const isFileInstalling = (fileId: number) => activeInstalls.some((i) => i.fileId === fileId)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('descripcion')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [installedFileIds, setInstalledFileIds] = useState<Set<number>>(new Set())
  const [installModal, setInstallModal] = useState<{ fileId: number } | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalNameError, setModalNameError] = useState('')
  const [versionSearch, setVersionSearch] = useState('')
  const [versionMcFilter, setVersionMcFilter] = useState('')
  const [versionLoaderFilter, setVersionLoaderFilter] = useState('')
  const [changelog, setChangelog] = useState<string | null>(null)
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [changelogFileId, setChangelogFileId] = useState<number | null>(null)

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
    setChangelogFileId(null)
    setChangelog(null)
  }, [selectedFileId])

  useEffect(() => {
    if (tab !== 'changelog' || !mod || !selectedFileId) return
    if (changelogFileId === selectedFileId) return
    setChangelogLoading(true)
    setChangelog(null)
    window.launcher.cf.getFileChangelog(mod.id, selectedFileId)
      .then((html) => { setChangelog(html); setChangelogFileId(selectedFileId) })
      .catch(() => setChangelog(''))
      .finally(() => setChangelogLoading(false))
  }, [tab, selectedFileId, mod?.id])

  function openInstallModal(fileId: number) {
    if (installedFileIds.has(fileId)) return
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
    const installId = `cf-${mod.id}-${fileId}`
    setError('')
    setDone(false)
    startInstall(installId, customName, fileId)
    try {
      const fileVersion = files.find((f) => f.id === fileId)?.displayName ?? undefined
      await window.launcher.cf.installModpack(mod.id, fileId, customName, mod.logo?.url, fileVersion, (mod as any).slug)
      setDone(true)
      finishInstall(installId)
      setTimeout(() => navigate('/instances'), 2000)
    } catch (e: any) {
      if (!e?.message?.includes('CANCELLED')) setError(e.message ?? 'Se ha parado la instalación del modpack')
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

  // ── Version filters ────────────────────────────────────────────────────────

  const availableMcVersions = [...new Set(
    files.flatMap((f) => (f.gameVersions ?? []).filter((v) => /^\d+\.\d+/.test(v)))
  )].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

  const availableLoaders = [...new Set(
    files.map(getFileLoader).filter((l): l is number => l !== null)
  )]

  const filteredFiles = files.filter((f) => {
    if (versionSearch && !(f.displayName ?? f.fileName).toLowerCase().includes(versionSearch.toLowerCase())) return false
    if (versionMcFilter && !(f.gameVersions ?? []).includes(versionMcFilter)) return false
    if (versionLoaderFilter && getFileLoader(f) !== Number(versionLoaderFilter)) return false
    return true
  })

  const hasVersionFilters = !!versionSearch || !!versionMcFilter || !!versionLoaderFilter

  const tabs: { id: Tab; label: string }[] = [
    { id: 'descripcion', label: 'Descripción' },
    { id: 'changelog',   label: 'Changelog' },
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
                <div className="flex flex-wrap items-center gap-2">
                  {(selectedFileId === null || !isFileInstalling(selectedFileId)) && !done && !isSelectedInstalled && (
                    <button
                      onClick={() => selectedFileId && openInstallModal(selectedFileId)}
                      disabled={!selectedFileId || isAnyInstalling}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-900/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <Download size={15} />
                      {isAnyInstalling ? 'Instalación en curso...' : 'Instalar modpack'}
                    </button>
                  )}

                  {(selectedFileId === null || !isFileInstalling(selectedFileId)) && !done && isSelectedInstalled && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
                      <Check size={15} className="text-green-400" />
                      <span className="text-green-400 text-sm font-medium">Esta versión ya está instalada</span>
                    </div>
                  )}

                  {selectedFileId !== null && isFileInstalling(selectedFileId) && progress && !done && (
                    <div className="max-w-xs">
                      <ProgressBar percent={progress.percent} label={progress.stage} />
                    </div>
                  )}

                  {done && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
                      <Check size={15} className="text-green-400" />
                      <span className="text-green-400 text-sm font-medium">¡Instalado! Redirigiendo...</span>
                    </div>
                  )}

                  {(modAny.slug || modAny.links?.websiteUrl) && (
                    <a
                      href={modAny.links?.websiteUrl ?? `https://www.curseforge.com/minecraft/modpacks/${modAny.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 hover:border-orange-400/50 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <ExternalLink size={14} />
                      CurseForge
                    </a>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25">
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
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
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
              <div>
                {/* Filter bar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={versionSearch}
                      onChange={(e) => setVersionSearch(e.target.value)}
                      placeholder="Buscar versión..."
                      className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    />
                  </div>
                  {availableMcVersions.length > 0 && (
                    <FilterSelect
                      icon={Tag}
                      value={versionMcFilter}
                      onChange={setVersionMcFilter}
                      placeholder="Todas las versiones"
                      options={[
                        { value: '', label: 'Todas las versiones' },
                        ...availableMcVersions.map((v) => ({ value: v, label: v })),
                      ]}
                    />
                  )}
                  {availableLoaders.length > 1 && (
                    <FilterSelect
                      icon={Layers}
                      value={versionLoaderFilter}
                      onChange={setVersionLoaderFilter}
                      placeholder="Todos los loaders"
                      options={[
                        { value: '', label: 'Todos los loaders' },
                        ...availableLoaders.map((l) => ({ value: String(l), label: LOADER_NAMES[l] ?? `Loader ${l}` })),
                      ]}
                    />
                  )}
                  {hasVersionFilters && (
                    <button
                      onClick={() => { setVersionSearch(''); setVersionMcFilter(''); setVersionLoaderFilter('') }}
                      className="px-3 py-2 rounded-xl text-xs border border-gray-700 text-gray-400 hover:bg-gray-700/50 transition-colors whitespace-nowrap"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {filteredFiles.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No hay versiones que coincidan con los filtros.</p>
                ) : (
                  <div className="overflow-x-auto">
                    {hasVersionFilters && (
                      <p className="text-xs text-gray-500 mb-3">{filteredFiles.length} de {files.length} versiones</p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-widest border-b text-gray-500 border-gray-700/60">
                          <th className="pb-3 text-left font-semibold">Nombre</th>
                          <th className="pb-3 text-left font-semibold">Versión MC</th>
                          <th className="pb-3 text-left font-semibold">Loader</th>
                          <th className="pb-3 text-left font-semibold">Fecha</th>
                          <th className="pb-3 text-right font-semibold">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/40">
                        {filteredFiles.map((file) => {
                          const loaderNum = getFileLoader(file) ?? (loaderNums.length === 1 ? loaderNums[0] : null)
                          const fileMcVers = getFileMcVersions(file)
                          const displayMcVers = fileMcVers.length > 0 ? fileMcVers : (mcVersions.length === 1 ? mcVersions : [])
                          return (
                            <tr key={file.id} className="transition-colors hover:bg-purple-500/5">
                              <td className="py-3 pr-4">
                                <span className="line-clamp-1 text-xs font-medium text-gray-200">
                                  {file.displayName || file.fileName}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex flex-wrap gap-1">
                                  {displayMcVers.slice(0, 3).map((v) => (
                                    <span key={v} className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                {loaderNum !== null && LOADER_NAMES[loaderNum] ? (
                                  <span className={`px-1.5 py-0.5 rounded-full text-xs border ${LOADER_COLORS[loaderNum] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
                                    {LOADER_NAMES[loaderNum]}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-600">—</span>
                                )}
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
                                    disabled={isAnyInstalling || isFileInstalling(file.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
                                  >
                                    {isFileInstalling(file.id) ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                    {isFileInstalling(file.id) ? 'Instalando...' : 'Instalar'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No hay versiones disponibles.</p>
            )
          )}

          {/* Changelog */}
          {tab === 'changelog' && (
            <div>
              {selectedFileId && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
                  <span className="text-xs text-gray-500">Versión:</span>
                  <span className="text-xs font-medium text-gray-300 bg-gray-800/60 px-2 py-0.5 rounded-lg border border-gray-700/60">
                    {files.find((f) => f.id === selectedFileId)?.displayName ?? `#${selectedFileId}`}
                  </span>
                </div>
              )}
              {changelogLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="text-purple-400 animate-spin" />
                </div>
              ) : changelog ? (
                <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40">
                  <div
                    className="prose prose-invert prose-sm max-w-none text-gray-300 [&_img]:max-w-full [&_a]:text-purple-400 [&_a]:no-underline [&_a:hover]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(changelog) }}
                  />
                </div>
              ) : changelog === '' ? (
                <p className="text-sm text-gray-500">Sin changelog disponible para esta versión.</p>
              ) : (
                <p className="text-sm text-gray-500">Selecciona una versión en la pestaña Versiones para ver su changelog.</p>
              )}
            </div>
          )}

        </section>
      </div>

      {/* Install name modal */}
      <Modal
        open={!!installModal}
        onClose={() => setInstallModal(null)}
        title="Nombre de la instancia"
        maxWidth="max-w-sm"
        icon={Download}
        iconBg="bg-purple-500/15"
        iconColor="text-purple-400"
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
          className="w-full px-3 py-2 rounded-xl text-sm border bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-colors"
        />
        {modalNameError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">
            {modalNameError}
          </p>
        )}
        <div className="flex justify-end gap-2 -mx-5 px-5 pt-4 mt-4 border-t border-gray-700/60">
          <button
            onClick={() => setInstallModal(null)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmInstall}
            disabled={!modalName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
