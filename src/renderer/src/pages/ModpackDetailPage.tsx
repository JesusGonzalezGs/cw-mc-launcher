import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, AlertCircle, Check, Search, Tag, Layers, ExternalLink } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import Modal from '../components/common/Modal'
import FilterSelect from '../components/common/FilterSelect'
import type { CfMod, CfFile } from '../types'
import { useInstall } from '../context/InstallContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const CF_LOADER_ID_TO_NAME: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }

const LOADER_COLORS: Record<string, string> = {
  Forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  Fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  Quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  NeoForge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}
const DEFAULT_LOADER_COLOR = 'bg-gray-500/15 text-gray-300 border-gray-500/25'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NormalizedLoader { name: string; color: string }

interface NormalizedVersion {
  id: string
  name: string
  mcVersions: string[]
  loaders: NormalizedLoader[]
  fileSize?: number
  datePublished?: string
  versionType?: string
}

interface PageData {
  name: string
  summary: string
  logoUrl?: string
  description: string
  descriptionIsHtml: boolean
  authors: string[]
  categories: { name: string; iconUrl?: string }[]
  loaders: NormalizedLoader[]
  mcVersions: string[]
  downloads: number
  stat2Label: string
  stat2Value: string
  dateCreated?: string
  dateModified?: string
  gallery: { id: string; title?: string; url: string; thumbUrl: string }[]
  externalUrl?: string
  externalLabel: string
  versions: NormalizedVersion[]
  cfInstall?: { modId: number; logoUrl?: string; slug?: string; files: CfFile[] }
  mrInstall?: { projectId: string; iconUrl?: string; rawVersions: any[] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function formatDate(s?: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sanitizeHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<script[^>]*\/?>/gi, '')
}

function getFileMcVersions(file: CfFile): string[] {
  const from = (file.gameVersions ?? []).filter(v => /^\d+\.\d+/.test(v))
  return from.length > 0 ? from : (file.sortableGameVersions ?? []).map(e => e.gameVersionName ?? '').filter(v => /^\d+\.\d+/.test(v))
}

function getFileLoaderNum(file: CfFile): number | null {
  const gv = file.gameVersions ?? []
  if (gv.includes('NeoForge')) return 6
  if (gv.includes('Forge')) return 1
  if (gv.includes('Fabric')) return 4
  if (gv.includes('Quilt')) return 5
  for (const e of file.sortableGameVersions ?? []) {
    const n = (e.gameVersionName ?? '').toLowerCase()
    if (n.includes('neoforge')) return 6
    if (n.includes('forge')) return 1
    if (n.includes('fabric')) return 4
    if (n.includes('quilt')) return 5
  }
  return null
}

function normalizeCfFile(file: CfFile, fallbackMcVersions: string[], fallbackLoader: number | null): NormalizedVersion {
  const loaderNum = getFileLoaderNum(file) ?? fallbackLoader
  const loaderName = loaderNum !== null ? (CF_LOADER_ID_TO_NAME[loaderNum] ?? '') : ''
  const mcVersions = getFileMcVersions(file)
  return {
    id: String(file.id),
    name: file.displayName || file.fileName || '',
    mcVersions: mcVersions.length > 0 ? mcVersions : fallbackMcVersions,
    loaders: loaderName ? [{ name: loaderName, color: LOADER_COLORS[loaderName] ?? DEFAULT_LOADER_COLOR }] : [],
    fileSize: (file as any).fileLength,
    datePublished: file.fileDate,
    versionType: (file as any).releaseType === 2 ? 'beta' : (file as any).releaseType === 3 ? 'alpha' : 'release',
  }
}

function normalizeMrVersion(ver: any): NormalizedVersion {
  const mcVersions = (ver.game_versions ?? []).filter((v: string) => /^\d+\.\d+/.test(v))
  const primaryFile = ver.files?.find((f: any) => f.primary) ?? ver.files?.[0]
  return {
    id: ver.id,
    name: ver.name ?? '',
    mcVersions,
    loaders: (ver.loaders ?? []).map((l: string) => {
      const name = l.charAt(0).toUpperCase() + l.slice(1)
      return { name, color: LOADER_COLORS[name] ?? DEFAULT_LOADER_COLOR }
    }),
    fileSize: primaryFile?.size,
    datePublished: ver.date_published,
    versionType: ver.version_type,
  }
}

function buildCfData(mod: CfMod, description: string, files: CfFile[]): PageData {
  const loaderNums = [...new Set(
    ((mod as any)?.latestFilesIndexes ?? []).map((f: any) => f.modLoader).filter(Boolean) as number[]
  )]
  const fallbackMcVers: string[] = [...new Set<string>(
    ((mod as any)?.latestFilesIndexes ?? []).map((f: any) => f.gameVersion).filter((v: any): v is string => !!v && /^\d+\.\d+/.test(v))
  )]
  return {
    name: mod.name ?? '',
    summary: mod.summary ?? '',
    logoUrl: mod.logo?.url,
    description,
    descriptionIsHtml: true,
    authors: ((mod as any)?.authors ?? []).map((a: any) => a.name),
    categories: ((mod as any)?.categories ?? []).slice(0, 6).map((c: any) => ({ name: c.name, iconUrl: c.iconUrl })),
    loaders: loaderNums
      .map(num => ({ name: CF_LOADER_ID_TO_NAME[num], color: LOADER_COLORS[CF_LOADER_ID_TO_NAME[num]] ?? DEFAULT_LOADER_COLOR }))
      .filter(l => l.name),
    mcVersions: fallbackMcVers,
    downloads: mod.downloadCount ?? 0,
    stat2Label: 'Popularidad',
    stat2Value: (mod as any)?.gamePopularityRank > 0 ? `#${((mod as any).gamePopularityRank).toLocaleString()}` : '—',
    dateCreated: (mod as any)?.dateReleased,
    dateModified: mod.dateModified,
    gallery: ((mod as any)?.screenshots ?? []).map((s: any) => ({ id: String(s.id), title: s.title, url: s.url, thumbUrl: s.thumbnailUrl ?? s.url })),
    externalUrl: (mod as any)?.links?.websiteUrl ?? ((mod as any)?.slug ? `https://www.curseforge.com/minecraft/modpacks/${(mod as any).slug}` : undefined),
    externalLabel: 'CurseForge',
    versions: files.map(f => normalizeCfFile(f, fallbackMcVers, loaderNums.length === 1 ? loaderNums[0] : null)),
    cfInstall: { modId: mod.id, logoUrl: mod.logo?.url, slug: (mod as any).slug, files },
  }
}

function buildMrData(proj: any, vers: any[]): PageData {
  return {
    name: proj.title ?? '',
    summary: proj.description ?? '',
    logoUrl: proj.icon_url,
    description: proj.body ?? '',
    descriptionIsHtml: false,
    authors: proj.team ? [proj.team] : [],
    categories: (proj.categories ?? []).slice(0, 8).map((c: string) => ({ name: c })),
    loaders: (proj.loaders ?? []).map((l: string) => {
      const name = l.charAt(0).toUpperCase() + l.slice(1)
      return { name, color: LOADER_COLORS[name] ?? DEFAULT_LOADER_COLOR }
    }),
    mcVersions: (proj.game_versions ?? []).filter((v: string) => /^\d+\.\d+/.test(v)),
    downloads: proj.downloads ?? 0,
    stat2Label: 'Seguidores',
    stat2Value: formatDownloads(proj.followers ?? 0),
    dateCreated: proj.published,
    dateModified: proj.updated,
    gallery: (proj.gallery ?? []).map((g: any, i: number) => ({ id: String(i), title: g.title, url: g.url, thumbUrl: g.url })),
    externalUrl: proj.slug ? `https://modrinth.com/modpack/${proj.slug}` : undefined,
    externalLabel: 'Modrinth',
    versions: vers.map(normalizeMrVersion),
    mrInstall: { projectId: proj.id, iconUrl: proj.icon_url, rawVersions: vers },
  }
}

function loaderBadge(l: NormalizedLoader) {
  return <span key={l.name} className={`px-1.5 py-0.5 rounded-full text-xs border font-medium ${l.color}`}>{l.name}</span>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value, borderClass = 'border-gray-700/50' }: { label: string; value: string; borderClass?: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-2xl border bg-gradient-to-br from-gray-800/90 to-gray-900 ${borderClass}`}>
      <span className="text-xs uppercase tracking-widest font-semibold mb-1 text-gray-500">{label}</span>
      <span className="font-bold text-sm text-white">{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'descripcion' | 'galeria' | 'versiones' | 'changelog'

export default function ModpackDetailPage({ source }: { source: 'cf' | 'mr' }) {
  const { modpackId, projectId } = useParams<{ modpackId?: string; projectId?: string }>()
  const id = source === 'cf' ? modpackId! : projectId!
  const navigate = useNavigate()

  const theme = source === 'cf' ? {
    blob1: 'bg-orange-600', blob2: 'bg-amber-600',
    card: 'bg-gradient-to-br from-gray-800/90 via-orange-950/5 to-gray-900 border-orange-500/30',
    statBorder: 'border-orange-500/25',
    back: 'border-orange-500/30 text-orange-300 hover:bg-orange-500/10 hover:border-orange-400/50',
    banner: 'from-orange-900/70 via-amber-900/40 to-yellow-900/60',
    logoFallback: 'from-orange-500 to-amber-500',
    title: 'from-orange-300 via-amber-300 to-orange-200',
    authorBadge: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
    installBtn: 'from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-lg shadow-orange-900/25',
    spinner: 'text-orange-400',
    tabs: 'from-orange-600 to-amber-600',
    gallery: 'border-orange-500/20 hover:border-orange-400/50',
    versionInput: 'focus:border-orange-500/50 focus:ring-orange-500/20',
    versionRow: 'hover:bg-orange-500/5',
    versionBtn: 'from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500',
    changelogActive: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    descLink: '[&_a]:text-orange-400 [&_a:hover]:underline',
    modalIcon: 'bg-orange-500/15', modalIconCl: 'text-orange-400',
    modalBtn: 'from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500',
    modalInput: 'focus:border-orange-500/60',
  } : {
    blob1: 'bg-green-600', blob2: 'bg-emerald-600',
    card: 'bg-gradient-to-br from-gray-800/90 via-green-950/10 to-gray-900 border-green-500/30',
    statBorder: 'border-green-500/25',
    back: 'border-green-500/30 text-green-300 hover:bg-green-500/10 hover:border-green-400/50',
    banner: 'from-green-900/70 via-emerald-900/40 to-teal-900/60',
    logoFallback: 'from-green-500 to-emerald-500',
    title: 'from-green-300 via-emerald-300 to-green-200',
    authorBadge: 'bg-green-500/10 text-green-300 border-green-500/25',
    installBtn: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-900/25',
    spinner: 'text-green-400',
    tabs: 'from-green-600 to-emerald-600',
    gallery: 'border-green-500/20 hover:border-green-400/50',
    versionInput: 'focus:border-green-500/50 focus:ring-green-500/20',
    versionRow: 'hover:bg-green-500/5',
    versionBtn: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500',
    changelogActive: 'bg-green-500/20 border-green-500/40 text-green-300',
    descLink: '[&_a]:text-green-400 [&_a:hover]:underline',
    modalIcon: 'bg-green-500/15', modalIconCl: 'text-green-400',
    modalBtn: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500',
    modalInput: 'focus:border-green-500/60',
  }

  const { startInstall, finishInstall, progress } = useInstall()

  // ── State ─────────────────────────────────────────────────────────────────
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('descripcion')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [installError, setInstallError] = useState('')
  const [installModal, setInstallModal] = useState<{ versionId: string } | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalNameError, setModalNameError] = useState('')
  const [versionSearch, setVersionSearch] = useState('')
  const [versionMcFilter, setVersionMcFilter] = useState('')
  const [versionLoaderFilter, setVersionLoaderFilter] = useState('')
  // Changelog
  const [cfChangelog, setCfChangelog] = useState<string | null>(null)
  const [cfChangelogLoading, setCfChangelogLoading] = useState(false)
  const [cfChangelogFileId, setCfChangelogFileId] = useState<number | null>(null)
  const [cfChangelogViewFileId, setCfChangelogViewFileId] = useState<number | null>(null)
  const [mrChangelogVersionId, setMrChangelogVersionId] = useState<string | null>(null)

  const isAnyInstalling = installingVersionId !== null

  // ── Load installed IDs ────────────────────────────────────────────────────
  useEffect(() => {
    window.launcher.instances.list().then((list: any[]) => {
      setInstalledIds(
        source === 'cf'
          ? new Set(list.filter(i => i.cfMeta?.fileId).map(i => String(i.cfMeta.fileId)))
          : new Set(list.filter(i => i.mrMeta?.versionId).map(i => i.mrMeta.versionId as string)),
      )
    }).catch(() => {})
  }, [source])

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setData(null)
    const p = source === 'cf'
      ? Promise.all([
          window.launcher.cf.getMod(parseInt(id)),
          window.launcher.cf.getModDescription(parseInt(id)),
          window.launcher.cf.getModFiles(parseInt(id)),
        ]).then(([modResp, desc, filesResp]) => {
          const files: CfFile[] = filesResp?.data ?? []
          if (files.length > 0) setCfChangelogViewFileId(files[0].id)
          return buildCfData(modResp?.data ?? null, desc ?? '', files)
        })
      : Promise.all([
          window.launcher.mr.getProject(id),
          window.launcher.mr.getProjectVersions(id),
        ]).then(([proj, vers]) => {
          if ((vers ?? []).length > 0) setMrChangelogVersionId(vers[0].id)
          return buildMrData(proj, vers ?? [])
        })
    p.then(setData).catch(e => setError(e?.message ?? 'Error al cargar el modpack')).finally(() => setLoading(false))
  }, [id, source])

  // ── CF changelog loader ───────────────────────────────────────────────────
  useEffect(() => {
    if (source !== 'cf' || tab !== 'changelog' || !data?.cfInstall || !cfChangelogViewFileId) return
    if (cfChangelogFileId === cfChangelogViewFileId) return
    setCfChangelogLoading(true)
    setCfChangelog(null)
    window.launcher.cf.getFileChangelog(data.cfInstall.modId, cfChangelogViewFileId)
      .then(html => { setCfChangelog(html); setCfChangelogFileId(cfChangelogViewFileId) })
      .catch(() => setCfChangelog(''))
      .finally(() => setCfChangelogLoading(false))
  }, [source, tab, cfChangelogViewFileId, data?.cfInstall?.modId])

  // ── Derived ───────────────────────────────────────────────────────────────
  const versions = data?.versions ?? []
  const gallery = data?.gallery ?? []
  const availableMcVersionsFilter = [...new Set(versions.flatMap(v => v.mcVersions))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const availableLoadersFilter = [...new Set(versions.flatMap(v => v.loaders.map(l => l.name)))]
  const filteredVersions = versions.filter(v => {
    if (versionSearch && !v.name.toLowerCase().includes(versionSearch.toLowerCase())) return false
    if (versionMcFilter && !v.mcVersions.includes(versionMcFilter)) return false
    if (versionLoaderFilter && !v.loaders.some(l => l.name === versionLoaderFilter)) return false
    return true
  })
  const hasVersionFilters = !!versionSearch || !!versionMcFilter || !!versionLoaderFilter
  const firstVersion = versions[0]
  const isFirstInstalled = firstVersion ? installedIds.has(firstVersion.id) : false

  const tabs: { id: Tab; label: string }[] = [
    { id: 'descripcion', label: 'Descripción' },
    { id: 'changelog', label: 'Changelog' },
    ...(gallery.length > 0 ? [{ id: 'galeria' as Tab, label: `${source === 'cf' ? 'Screenshots' : 'Galería'} (${gallery.length})` }] : []),
    { id: 'versiones', label: `Versiones (${versions.length})` },
  ]

  // ── Install ───────────────────────────────────────────────────────────────
  function openInstallModal(versionId: string) {
    if (installedIds.has(versionId) || isAnyInstalling) return
    setModalName(versions.find(v => v.id === versionId)?.name ?? (data?.name ?? ''))
    setModalNameError('')
    setInstallModal({ versionId })
  }

  async function confirmInstall() {
    if (!installModal || !modalName.trim()) return
    try {
      const all = await window.launcher.instances.list()
      if (all.some((i: any) => i.name.toLowerCase() === modalName.trim().toLowerCase())) {
        setModalNameError('Ya existe una instancia con ese nombre')
        return
      }
    } catch { /* ignore */ }
    const { versionId } = installModal
    setInstallModal(null)
    await handleInstall(versionId, modalName.trim())
  }

  async function handleInstall(versionId: string, customName: string) {
    const rawId = data?.cfInstall?.modId ?? data?.mrInstall?.projectId
    const installId = `${source}-${rawId}-${versionId}`
    setInstallingVersionId(versionId)
    setInstallError('')
    setDone(false)
    startInstall(installId, customName, source === 'cf' ? parseInt(versionId) : undefined, source)
    try {
      if (source === 'cf') {
        const { modId, logoUrl: cfLogo, slug, files } = data!.cfInstall!
        const fileId = parseInt(versionId)
        await window.launcher.cf.installModpack(modId, fileId, customName, cfLogo, files.find(f => f.id === fileId)?.displayName, slug)
      } else {
        const { projectId: mrId, iconUrl } = data!.mrInstall!
        await window.launcher.mr.installModpack(mrId, versionId, customName, iconUrl)
      }
      setInstalledIds(prev => new Set([...prev, versionId]))
      setDone(true)
      finishInstall(installId)
      setTimeout(() => navigate('/instances'), 2000)
    } catch (e: any) {
      if (!e?.message?.includes('CANCELLED')) setInstallError(e.message ?? 'Error al instalar el modpack')
      finishInstall(installId)
    } finally {
      setInstallingVersionId(null)
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]">
        <Loader2 size={24} className={`${theme.spinner} animate-spin`} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/catalog')} className={`flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border ${theme.back} transition-all`}>
          <ArrowLeft size={15} /> Volver al catálogo
        </button>
        <p className="text-gray-500">{error || 'Modpack no encontrado'}</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 ${theme.blob1}`} />
        <div className={`absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 ${theme.blob2}`} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-6 pb-16">

        {/* Back button */}
        <button
          onClick={() => navigate('/catalog')}
          className={`flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border ${theme.back} transition-all hover:scale-[1.02] active:scale-95`}
        >
          <ArrowLeft size={15} />
          Volver al catálogo
        </button>

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border overflow-hidden mb-5 ${theme.card}`}>

          {/* Banner */}
          <div className="h-20 sm:h-24 relative overflow-hidden">
            {data.logoUrl && (
              <img src={data.logoUrl} alt="" aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-25" />
            )}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.banner}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
          </div>

          {/* Logo + info */}
          <div className="px-5 pb-5 -mt-4 sm:-mt-5 flex flex-col sm:flex-row gap-4 sm:gap-5 relative z-10">

            {/* Logo */}
            <div className="flex-shrink-0">
              {data.logoUrl ? (
                <img src={data.logoUrl} alt={data.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-gray-900 shadow-xl"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-gray-900 bg-gradient-to-br ${theme.logoFallback} flex items-center justify-center text-3xl shadow-xl`}>
                  📦
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-8">
              <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5 leading-tight bg-gradient-to-r ${theme.title} bg-clip-text text-transparent`}>
                {data.name}
              </h1>

              {data.summary && <p className="text-sm mb-3 leading-relaxed text-gray-400">{data.summary}</p>}

              {data.authors.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">Por</span>
                  {data.authors.map((author, i) => (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${theme.authorBadge} font-medium`}>
                      {author}
                    </span>
                  ))}
                </div>
              )}

              {data.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {data.categories.map((cat, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-orange-500/10 text-orange-300 border-orange-500/20 font-medium capitalize">
                      {cat.iconUrl && <img src={cat.iconUrl} alt="" className="w-3 h-3 object-contain opacity-80" />}
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}

              {(data.loaders.length > 0 || data.mcVersions.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {data.loaders.map(l => (
                    <span key={l.name} className={`px-2 py-0.5 rounded-full text-xs border font-medium ${l.color}`}>{l.name}</span>
                  ))}
                  {data.mcVersions.slice(0, 4).map(v => (
                    <span key={v} className="px-2 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">{v}</span>
                  ))}
                  {data.mcVersions.length > 4 && (
                    <span className="text-xs self-center text-gray-600">+{data.mcVersions.length - 4} más</span>
                  )}
                </div>
              )}

              {/* Install action */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">

                  {!isAnyInstalling && !done && firstVersion && !isFirstInstalled && (
                    <button
                      onClick={() => openInstallModal(firstVersion.id)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r ${theme.installBtn} text-white transition-all hover:scale-[1.02] active:scale-95`}
                    >
                      <Download size={15} />
                      Instalar modpack
                    </button>
                  )}

                  {!isAnyInstalling && !done && firstVersion && isFirstInstalled && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
                      <Check size={15} className="text-green-400" />
                      <span className="text-green-400 text-sm font-medium">Última versión instalada</span>
                    </div>
                  )}

                  {isAnyInstalling && installingVersionId === firstVersion?.id && progress && (
                    <div className="max-w-xs">
                      <ProgressBar percent={progress.percent} label={progress.stage} />
                    </div>
                  )}

                  {isAnyInstalling && installingVersionId === firstVersion?.id && !progress && (
                    <div className={`flex items-center gap-2 text-sm ${theme.spinner}`}>
                      <Loader2 size={14} className="animate-spin" />
                      Preparando instalación...
                    </div>
                  )}

                  {isAnyInstalling && (
                    <button
                      onClick={() => source === 'cf' ? window.launcher.cf.cancelInstall() : window.launcher.mr.cancelInstall()}
                      className="text-xs px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}

                  {done && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
                      <Check size={15} className="text-green-400" />
                      <span className="text-green-400 text-sm font-medium">¡Instalado! Redirigiendo...</span>
                    </div>
                  )}

                  {data.externalUrl && (
                    <a href={data.externalUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 hover:border-orange-400/50 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <ExternalLink size={14} />
                      {data.externalLabel}
                    </a>
                  )}
                </div>

                {installError && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25">
                    <AlertCircle size={15} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{installError}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatBadge label="Descargas"      value={formatDownloads(data.downloads)} borderClass={theme.statBorder} />
          <StatBadge label={data.stat2Label} value={data.stat2Value}                borderClass={theme.statBorder} />
          <StatBadge label="Publicado"      value={formatDate(data.dateCreated)}    borderClass={theme.statBorder} />
          <StatBadge label="Actualizado"    value={formatDate(data.dateModified)}   borderClass={theme.statBorder} />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-2xl border mb-4 bg-gray-800/60 border-gray-700/60" role="tablist">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? `bg-gradient-to-r ${theme.tabs} text-white shadow-sm`
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <section className={`rounded-2xl border p-5 sm:p-6 ${theme.card}`}>

          {/* Descripción */}
          {tab === 'descripcion' && (
            data.description ? (
              <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40">
                {data.descriptionIsHtml ? (
                  <div
                    className={`prose prose-invert prose-sm max-w-none text-gray-300 [&_img]:max-w-full ${theme.descLink} [&_a]:no-underline`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.description) }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">{data.description}</pre>
                )}
              </div>
            ) : <p className="text-sm text-gray-500">Sin descripción disponible.</p>
          )}

          {/* Galería */}
          {tab === 'galeria' && (
            gallery.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map(img => (
                  <button
                    key={img.id}
                    onClick={() => setLightbox(img.url)}
                    className={`aspect-video overflow-hidden rounded-xl border ${theme.gallery} transition-all hover:-translate-y-0.5 hover:shadow-xl group`}
                    aria-label={img.title || 'Ver imagen en grande'}
                  >
                    <img src={img.thumbUrl} alt={img.title || 'Imagen'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">No hay imágenes disponibles.</p>
          )}

          {/* Versiones */}
          {tab === 'versiones' && (
            versions.length > 0 ? (
              <div>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={versionSearch}
                      onChange={e => setVersionSearch(e.target.value)}
                      placeholder="Buscar versión..."
                      className={`w-full bg-gray-800/80 border border-gray-700/80 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none ${theme.versionInput} focus:ring-1 transition-all`}
                    />
                  </div>
                  {availableMcVersionsFilter.length > 0 && (
                    <FilterSelect icon={Tag} value={versionMcFilter} onChange={setVersionMcFilter} placeholder="Todas las versiones"
                      options={[{ value: '', label: 'Todas las versiones' }, ...availableMcVersionsFilter.map(v => ({ value: v, label: v }))]} />
                  )}
                  {availableLoadersFilter.length > 1 && (
                    <FilterSelect icon={Layers} value={versionLoaderFilter} onChange={setVersionLoaderFilter} placeholder="Todos los loaders"
                      options={[{ value: '', label: 'Todos los loaders' }, ...availableLoadersFilter.map(l => ({ value: l, label: l }))]} />
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

                {filteredVersions.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No hay versiones que coincidan con los filtros.</p>
                ) : (
                  <div className="overflow-x-auto">
                    {hasVersionFilters && (
                      <p className="text-xs text-gray-500 mb-3">{filteredVersions.length} de {versions.length} versiones</p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-widest border-b text-gray-500 border-gray-700/60">
                          <th className="pb-3 text-left font-semibold">Nombre</th>
                          <th className="pb-3 text-left font-semibold">Versión MC</th>
                          <th className="pb-3 text-left font-semibold">Loader</th>
                          <th className="pb-3 text-left font-semibold">Tamaño</th>
                          <th className="pb-3 text-left font-semibold">Fecha</th>
                          <th className="pb-3 text-right font-semibold">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/40">
                        {filteredVersions.map(ver => {
                          const isInstalled = installedIds.has(ver.id)
                          const isThisInstalling = installingVersionId === ver.id
                          return (
                            <tr key={ver.id} className={`transition-colors ${theme.versionRow}`}>
                              <td className="py-3 pr-4">
                                <div>
                                  <span className="line-clamp-1 text-xs font-medium text-gray-200">{ver.name}</span>
                                  {ver.versionType && ver.versionType !== 'release' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border mt-0.5 inline-block ${
                                      ver.versionType === 'beta'
                                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                        : 'bg-gray-500/15 text-gray-400 border-gray-500/25'
                                    }`}>
                                      {ver.versionType}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex flex-wrap gap-1">
                                  {ver.mcVersions.slice(0, 3).map(v => (
                                    <span key={v} className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/20">{v}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                {ver.loaders.length > 0
                                  ? <div className="flex flex-wrap gap-1">{ver.loaders.map(loaderBadge)}</div>
                                  : <span className="text-xs text-gray-600">—</span>}
                              </td>
                              <td className="py-3 pr-4 whitespace-nowrap text-xs text-gray-500">{formatFileSize(ver.fileSize)}</td>
                              <td className="py-3 pr-4 whitespace-nowrap text-xs text-gray-500">{formatDate(ver.datePublished)}</td>
                              <td className="py-3 text-right">
                                {isInstalled ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-500/10 border border-green-500/25 text-green-400">
                                    <Check size={11} />Instalado
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => openInstallModal(ver.id)}
                                    disabled={isAnyInstalling}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r ${theme.versionBtn} text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm`}
                                  >
                                    {isThisInstalling ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                    {isThisInstalling ? 'Instalando...' : 'Instalar'}
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
            ) : <p className="text-sm text-gray-500">No hay versiones disponibles.</p>
          )}

          {/* Changelog CF */}
          {tab === 'changelog' && source === 'cf' && (() => {
            const cfFiles = data.cfInstall?.files ?? []
            return (
              <div>
                {cfFiles.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50 flex-wrap">
                    <span className="text-xs text-gray-500 shrink-0">Versión:</span>
                    <button
                      onClick={() => { setCfChangelogViewFileId(cfFiles[0].id); setCfChangelogFileId(null); setCfChangelog(null) }}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        cfChangelogViewFileId === cfFiles[0].id ? theme.changelogActive : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      Última versión
                    </button>
                    {cfFiles.length > 1 && (
                      <FilterSelect
                        icon={Layers}
                        value={String(cfChangelogViewFileId ?? '')}
                        onChange={v => { setCfChangelogViewFileId(v ? Number(v) : null); setCfChangelogFileId(null); setCfChangelog(null) }}
                        placeholder="Selecciona una versión"
                        options={[{ value: '', label: 'Selecciona una versión' }, ...cfFiles.map(f => ({ value: String(f.id), label: f.displayName || f.fileName }))]}
                      />
                    )}
                  </div>
                )}
                {cfChangelogLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className={`${theme.spinner} animate-spin`} />
                  </div>
                ) : cfChangelog ? (
                  <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40">
                    <div
                      className={`prose prose-invert prose-sm max-w-none text-gray-300 [&_img]:max-w-full ${theme.descLink} [&_a]:no-underline`}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(cfChangelog) }}
                    />
                  </div>
                ) : cfChangelog === '' ? (
                  <p className="text-sm text-gray-500">Sin changelog disponible para esta versión.</p>
                ) : null}
              </div>
            )
          })()}

          {/* Changelog MR */}
          {tab === 'changelog' && source === 'mr' && (() => {
            const rawVersions = data.mrInstall?.rawVersions ?? []
            const mrChangelog: string = rawVersions.find(v => v.id === mrChangelogVersionId)?.changelog ?? ''
            return (
              <div>
                {rawVersions.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50 flex-wrap">
                    <span className="text-xs text-gray-500 shrink-0">Versión:</span>
                    <button
                      onClick={() => setMrChangelogVersionId(rawVersions[0].id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        mrChangelogVersionId === rawVersions[0].id ? theme.changelogActive : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      Última versión
                    </button>
                    {rawVersions.length > 1 && (
                      <FilterSelect
                        icon={Layers}
                        value={mrChangelogVersionId ?? ''}
                        onChange={v => setMrChangelogVersionId(v || null)}
                        placeholder="Selecciona una versión"
                        options={[{ value: '', label: 'Selecciona una versión' }, ...rawVersions.map((v: any) => ({ value: v.id, label: v.name || v.id }))]}
                      />
                    )}
                  </div>
                )}
                {mrChangelog ? (
                  <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40">
                    <pre className={`prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap font-sans text-sm leading-relaxed ${theme.descLink}`}>
                      {mrChangelog}
                    </pre>
                  </div>
                ) : <p className="text-sm text-gray-500">Sin changelog disponible para esta versión.</p>}
              </div>
            )
          })()}

        </section>
      </div>

      {/* Install name modal */}
      <Modal
        open={!!installModal}
        onClose={() => setInstallModal(null)}
        title="Nombre de la instancia"
        maxWidth="max-w-sm"
        icon={Download}
        iconBg={theme.modalIcon}
        iconColor={theme.modalIconCl}
      >
        <p className="text-sm text-gray-400 mb-3">
          Elige un nombre para esta instancia. Puedes editarlo para distinguir versiones.
        </p>
        <input
          type="text"
          value={modalName}
          onChange={e => { setModalName(e.target.value); setModalNameError('') }}
          onKeyDown={e => e.key === 'Enter' && confirmInstall()}
          placeholder="Nombre de la instancia"
          autoFocus
          className={`w-full px-3 py-2 rounded-xl text-sm border bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none ${theme.modalInput} transition-colors`}
        />
        {modalNameError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">{modalNameError}</p>
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r ${theme.modalBtn} text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
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
            alt="Imagen del modpack"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
