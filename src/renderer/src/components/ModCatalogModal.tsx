import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Search, Package, Download, RefreshCw,
  ChevronLeft, ChevronRight, Tag, Layers, ArrowUpDown, Flame, Leaf,
} from 'lucide-react'
import { mrSearch, mrGetProject, mrGetProjectVersions } from '../api/mrApi'
import ImageViewer from './ImageViewer'
import FilterSelect from './common/FilterSelect'
import type { Instance } from '../types'

// ── CF constants ───────────────────────────────────────────────────────────────
const CF_LOADER_NAMES: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }
const KNOWN_LOADER_NAMES = new Set(['Forge', 'Fabric', 'Quilt', 'NeoForge'])
const CF_LOADER_NUM: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }

const CF_LOADER_COLORS: Record<number, string> = {
  1: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  4: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  5: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}
const CF_LOADER_NAME_COLORS: Record<string, string> = {
  Forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  Fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  Quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  NeoForge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

// ── MR constants ───────────────────────────────────────────────────────────────
const MR_LOADER_COLORS: Record<string, string> = {
  forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  neoforge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}
const MR_SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'downloads', label: 'Descargas' },
  { value: 'follows', label: 'Seguidores' },
  { value: 'newest', label: 'Más nuevos' },
  { value: 'updated', label: 'Actualización' },
]

const CF_SORT_OPTIONS = [
  { value: '2', label: 'Popularidad' },
  { value: '6', label: 'Descargas' },
  { value: '3', label: 'Actualización' },
  { value: '4', label: 'Nombre' },
]

const MC_VERSION_OPTIONS = [
  { value: '', label: 'Todas las versiones' },
  ...[
    '1.21.4','1.21.3','1.21.2','1.21.1','1.21',
    '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
    '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
    '1.18.2','1.18.1','1.18',
    '1.17.1','1.17',
    '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
    '1.15.2','1.15.1','1.15',
    '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
    '1.13.2','1.13.1','1.13',
    '1.12.2','1.12.1','1.12',
    '1.11.2','1.11',
    '1.10.2','1.10',
    '1.9.4','1.9',
    '1.8.9','1.8.8','1.8',
    '1.7.10','1.7.2',
    '1.6.4','1.6.2',
    '1.5.2','1.5',
    '1.4.7','1.4.2',
    '1.3.2','1.2.5',
    '1.1','1.0',
  ].map(v => ({ value: v, label: v })),
]

const CF_LOADER_OPTIONS = [
  { value: '', label: 'Todos los loaders' },
  ...Object.entries(CF_LOADER_NAMES).map(([k, v]) => ({ value: k, label: v })),
]

const MR_LOADER_OPTIONS = [
  { value: '', label: 'Todos los loaders' },
  { value: 'forge', label: 'Forge' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'quilt', label: 'Quilt' },
  { value: 'neoforge', label: 'NeoForge' },
]

const PAGE_SIZE = 20

function formatDownloads(n: number): string {
  if (!n) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toString()
}

function formatDate(isoDate: string): string | null {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getFileLoader(file: any): string | null {
  const fromGV = (file.gameVersions || []).find((v: string) => KNOWN_LOADER_NAMES.has(v))
  if (fromGV) return fromGV
  const fromSGV = (file.sortableGameVersions || []).find((sgv: any) => KNOWN_LOADER_NAMES.has(sgv.gameVersionName))
  return fromSGV?.gameVersionName ?? null
}

function pickFileId(mod: any, version: string, loader: string): number | null {
  const indexes = mod.latestFilesIndexes
  if (!indexes?.length) return null
  const loaderNum = loader ? Number(loader) : null
  let match = indexes.find((f: any) =>
    (!version || f.gameVersion === version) &&
    (!loaderNum || f.modLoader === loaderNum)
  )
  if (match) return match.fileId
  if (version) {
    match = indexes.find((f: any) => f.gameVersion === version)
    if (match) return match.fileId
  }
  if (loaderNum) {
    match = indexes.find((f: any) => f.modLoader === loaderNum)
    if (match) return match.fileId
  }
  return indexes[0]?.fileId ?? null
}


// ── Norm types & adapters ──────────────────────────────────────────────────────
interface NormLoader { key: string; label: string; colorClass: string }
interface NormVersion {
  id: string
  name: string
  gameVersions: string[]
  loaders: NormLoader[]
  date: string | null
}

function cfFileToNormVersion(file: any): NormVersion {
  const loaderName = getFileLoader(file)
  return {
    id: String(file.id),
    name: file.displayName || file.fileName,
    gameVersions: (file.gameVersions || []).filter((v: string) => /^\d+\.\d+/.test(v)),
    loaders: loaderName ? [{ key: loaderName, label: loaderName, colorClass: CF_LOADER_NAME_COLORS[loaderName] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400' }] : [],
    date: formatDate(file.fileDate),
  }
}

function mrVerToNormVersion(ver: any): NormVersion {
  return {
    id: ver.id,
    name: ver.name,
    gameVersions: (ver.game_versions as string[]).filter(v => /^\d+\.\d+/.test(v)),
    loaders: (ver.loaders as string[]).filter(l => MR_LOADER_COLORS[l]).map(l => ({
      key: l, label: l.charAt(0).toUpperCase() + l.slice(1), colorClass: MR_LOADER_COLORS[l],
    })),
    date: formatDate(ver.date_published),
  }
}

function pickBestNormVersion(normVersions: NormVersion[], mcVersion: string, loader: string, source: Source): NormVersion | null {
  if (normVersions.length === 0) return null
  const loaderKey = source === 'cf' ? (CF_LOADER_NAMES[Number(loader)] ?? '') : loader
  return normVersions.find(v =>
    (!mcVersion || v.gameVersions.includes(mcVersion)) &&
    (!loaderKey || v.loaders.some(l => l.key === loaderKey))
  ) ?? normVersions.find(v => !mcVersion || v.gameVersions.includes(mcVersion))
    ?? normVersions[0]
}

// ── ModCard ────────────────────────────────────────────────────────────────────
interface ModCardProps {
  mod: any
  source: Source
  installing: boolean
  installed: boolean
  error?: string
  onInstall: () => void
  onDetail: () => void
  version: string
  loader: string
}

function ModCard({ mod, source, installing, installed, error, onInstall, onDetail, version, loader }: ModCardProps) {
  const isCf = source === 'cf'
  const name = isCf ? mod.name : mod.title
  const summary = isCf ? mod.summary : mod.description
  const iconUrl = isCf ? mod.logo?.thumbnailUrl : mod.icon_url
  const downloads = isCf ? mod.downloadCount : mod.downloads
  const loaders: NormLoader[] = isCf
    ? ([...new Set((mod.latestFilesIndexes || []).map((f: any) => f.modLoader as number))].filter(Boolean) as number[])
        .slice(0, 3).filter(l => CF_LOADER_NAMES[l])
        .map(l => ({ key: String(l), label: CF_LOADER_NAMES[l], colorClass: CF_LOADER_COLORS[l] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400' }))
    : ((mod.display_categories?.filter((c: string) => MR_LOADER_COLORS[c]) ?? []) as string[])
        .slice(0, 3)
        .map((l: string) => ({ key: l, label: l.charAt(0).toUpperCase() + l.slice(1), colorClass: MR_LOADER_COLORS[l] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400' }))
  const compatible = isCf
    ? pickFileId(mod, version, loader) !== null
    : (mod.versions?.length ?? 0) > 0

  return (
    <div onClick={onDetail} className="rounded-2xl border flex flex-col transition-all cursor-pointer bg-gradient-to-br from-[#1e1a2e] to-[#161320] border-purple-500/35 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/30 hover:-translate-y-0.5">
      <div className="p-3 flex items-start gap-3 flex-1">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight text-gray-100">{name}</p>
          <p className="text-xs mt-1 line-clamp-2 leading-relaxed text-gray-500">{summary}</p>
          {loaders.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {loaders.map(l => (
                <span key={l.key} className={`text-[10px] px-1.5 py-px rounded-full font-medium border ${l.colorClass}`}>
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-700/50" onClick={e => e.stopPropagation()}>
        <span className="text-xs flex items-center gap-1 text-gray-500"><Download size={10} />{formatDownloads(downloads)}</span>
        {error ? (
          <span className="text-[11px] text-red-400 truncate max-w-[130px]" title={error}>{error}</span>
        ) : installed ? (
          <span className="text-xs text-green-400 font-medium">✓ Instalado</span>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing || !compatible}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              !compatible ? 'border border-gray-700/60 text-gray-600'
              : installing ? 'bg-purple-600/60 text-white/70 cursor-wait'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}
          >
            {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={11} />}
            {!compatible ? 'Sin versión' : installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── DepsNotice type ────────────────────────────────────────────────────────────
interface DepsNotice {
  deps: { filename: string; name: string }[]
  failedDeps: { modId: number; error: string }[]
}

// ── ModDetailView ──────────────────────────────────────────────────────────────
interface ModDetailViewProps {
  mod: any
  source: Source
  installing: boolean
  installed: boolean
  installError?: string
  onInstall: (id: string) => void
  onBack: () => void
  version: string
  loader: string
  depsNotice?: DepsNotice | null
  onClearDeps?: () => void
}

function ModDetailView({ mod, source, installing, installed, installError, onInstall, onBack, version, loader, depsNotice, onClearDeps }: ModDetailViewProps) {
  const isCf = source === 'cf'
  const [detailTab, setDetailTab] = useState<'desc' | 'versions' | 'screenshots'>('desc')
  const [description, setDescription] = useState('')
  const [loadingDesc, setLoadingDesc] = useState(false)
  const [normVersions, setNormVersions] = useState<NormVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [mrGallery, setMrGallery] = useState<any[]>([])
  const [versionFilter, setVersionFilter] = useState('')
  const [loaderFilter, setLoaderFilter] = useState('')
  const [versionsPage, setVersionsPage] = useState(0)
  const FILES_PER_PAGE = 15

  const name = isCf ? mod.name : mod.title
  const summary = isCf ? mod.summary : mod.description
  const iconUrl = isCf ? (mod.logo?.url || mod.logo?.thumbnailUrl) : mod.icon_url
  const downloads = isCf ? mod.downloadCount : mod.downloads
  const authors = isCf
    ? (mod.authors?.length > 0 ? mod.authors.map((a: any) => a.name).join(', ') : null)
    : (mod.author ?? null)
  const headerLoaders: NormLoader[] = isCf
    ? ([...new Set((mod.latestFilesIndexes || []).map((f: any) => f.modLoader as number))].filter(Boolean) as number[])
        .slice(0, 4).filter(l => CF_LOADER_NAMES[l])
        .map(l => ({ key: String(l), label: CF_LOADER_NAMES[l], colorClass: CF_LOADER_COLORS[l] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400' }))
    : ((mod.display_categories ?? mod.categories ?? []).filter((c: string) => MR_LOADER_COLORS[c]) as string[])
        .map((l: string) => ({ key: l, label: l.charAt(0).toUpperCase() + l.slice(1), colorClass: MR_LOADER_COLORS[l] }))
  const screenshots: { key: string; url: string; thumbUrl: string; title?: string }[] = isCf
    ? (mod.screenshots ?? []).map((s: any) => ({ key: String(s.id), url: s.url || s.thumbnailUrl, thumbUrl: s.thumbnailUrl || s.url, title: s.title }))
    : mrGallery.map((g: any, i: number) => ({ key: String(i), url: g.url, thumbUrl: g.url, title: g.title }))

  const bestVersion = useMemo(() => pickBestNormVersion(normVersions, version, loader, source), [normVersions, version, loader, source])
  const compatible = bestVersion !== null

  const filteredVersions = useMemo(() => normVersions.filter(v => {
    if (versionFilter && !v.gameVersions.includes(versionFilter)) return false
    if (loaderFilter && !v.loaders.some(l => l.key === loaderFilter)) return false
    return true
  }), [normVersions, versionFilter, loaderFilter])

  const totalPages = Math.ceil(filteredVersions.length / FILES_PER_PAGE)
  const pagedVersions = filteredVersions.slice(versionsPage * FILES_PER_PAGE, (versionsPage + 1) * FILES_PER_PAGE)

  useEffect(() => { setVersionsPage(0) }, [versionFilter, loaderFilter])

  const versionOptions = useMemo(() => {
    const vs = [...new Set(normVersions.flatMap(v => v.gameVersions))].sort((a, b) => {
      const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
      return 0
    })
    return [{ value: '', label: 'Todas las versiones' }, ...vs.map(v => ({ value: v, label: v }))]
  }, [normVersions])

  const loaderOptions = useMemo(() => {
    const ls = [...new Map(normVersions.flatMap(v => v.loaders).map(l => [l.key, l])).values()]
    return [{ value: '', label: 'Todos los loaders' }, ...ls.map(l => ({ value: l.key, label: l.label }))]
  }, [normVersions])

  const uid = isCf ? mod.id : mod.project_id

  useEffect(() => {
    setLoadingDesc(true)
    const descP: Promise<string> = isCf
      ? (window.launcher.cf.getModDescription(mod.id) as Promise<string>)
      : mrGetProject(mod.project_id).then((p: any) => { setMrGallery(p.gallery ?? []); return p.body ?? '' })
    descP.then(setDescription).catch(() => {}).finally(() => setLoadingDesc(false))

    setLoadingVersions(true)
    const versP: Promise<NormVersion[]> = isCf
      ? (window.launcher.cf.getModFiles(mod.id) as Promise<any>).then(r => (r?.data ?? []).map(cfFileToNormVersion))
      : mrGetProjectVersions(mod.project_id).then((vs: any[]) => vs.map(mrVerToNormVersion))
    versP.then(nv => {
      setNormVersions(nv)
      const hasVersion = nv.some(v => v.gameVersions.includes(version))
      setVersionFilter(version && hasVersion ? version : '')
      const loaderKey = isCf ? (CF_LOADER_NAMES[Number(loader)] ?? '') : loader
      const hasLoader = nv.some(v => v.loaders.some(l => l.key === loaderKey))
      setLoaderFilter(loaderKey && hasLoader ? loaderKey : '')
    }).catch(() => {}).finally(() => setLoadingVersions(false))
  }, [uid])

  return (
    <>
      {lightboxIndex !== null && (
        <ImageViewer
          images={screenshots.map(ss => ({ url: ss.url, thumbUrl: ss.thumbUrl, title: ss.title }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700/60 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
          <ChevronLeft size={16} />Volver al catálogo
        </button>
      </div>
      {depsNotice && (
        <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 border bg-purple-500/10 border-purple-500/25 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {depsNotice.deps.length > 0 && <p className="text-xs font-medium text-purple-300">Dependencias instaladas: {depsNotice.deps.map(d => d.name).join(', ')}</p>}
            {depsNotice.failedDeps.length > 0 && <p className="text-xs mt-0.5 text-red-400">No se pudieron instalar: {depsNotice.failedDeps.map(d => `mod ${d.modId}`).join(', ')}</p>}
          </div>
          <button onClick={onClearDeps} className="p-0.5 rounded flex-shrink-0 text-gray-500 hover:text-gray-300"><X size={13} /></button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative px-5 py-5 border-b border-purple-500/25 bg-[#1a1628]">
          <div className="flex items-start gap-4">
            {iconUrl ? (
              <img src={iconUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0"><Package size={28} className="text-white" /></div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight text-white">{name}</h2>
              {authors && <p className="text-xs mt-0.5 text-gray-500">por {authors}</p>}
              <p className="text-sm mt-2 leading-relaxed text-gray-400">{summary}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="text-xs flex items-center gap-1 text-gray-500"><Download size={11} />{formatDownloads(downloads)} descargas</span>
                {headerLoaders.map(l => (
                  <span key={l.key} className={`text-[10px] px-1.5 py-px rounded-full font-medium border ${l.colorClass}`}>{l.label}</span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {installed ? (
                <span className="text-sm text-green-400 font-medium">✓ Instalado</span>
              ) : (
                <>
                  <button
                    onClick={() => bestVersion && onInstall(bestVersion.id)}
                    disabled={installing || (!compatible && !loadingVersions)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                      !compatible && !loadingVersions ? 'border border-gray-700 text-gray-600'
                      : installing ? 'bg-purple-600/60 text-white/70 cursor-wait'
                      : loadingVersions ? 'bg-gray-700/60 text-gray-500 cursor-wait'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                    }`}
                  >
                    {installing
                      ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                      : loadingVersions
                        ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-gray-400 animate-spin" />
                        : <Download size={14} />}
                    {!compatible && !loadingVersions ? 'Sin versión' : installing ? 'Instalando...' : loadingVersions ? 'Cargando...' : 'Instalar'}
                  </button>
                  {installError && <p className="text-[11px] text-red-400 max-w-[160px] text-right">{installError}</p>}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 px-5 py-2 border-b border-gray-700/60">
          {(['desc', 'versions', 'screenshots'] as const).map(key => {
            const labels = { desc: 'Descripción', versions: 'Versiones', screenshots: 'Capturas' }
            return (
              <button key={key} onClick={() => setDetailTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === key ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/30'}`}>
                {labels[key]}
                {key === 'screenshots' && screenshots.length > 0 && <span className="ml-1 text-[10px] text-gray-600">({screenshots.length})</span>}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {detailTab === 'desc' && (loadingDesc ? <div className="h-32 rounded-xl animate-pulse bg-gray-700/50" /> : description ? (
            isCf ? (
              <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40 text-gray-300 text-sm leading-relaxed [&_a]:text-purple-400 [&_a:hover]:text-purple-300 [&_img]:rounded-lg [&_img]:max-w-full [&_h1]:text-white [&_h1]:font-bold [&_h1]:text-base [&_h2]:text-white [&_h2]:font-semibold [&_h3]:text-gray-200 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_p]:mt-2 overflow-hidden" dangerouslySetInnerHTML={{ __html: description }} />
            ) : (
              <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40 text-gray-300 text-sm leading-relaxed overflow-hidden whitespace-pre-wrap">{description}</div>
            )
          ) : <p className="text-sm text-gray-600">Sin descripción disponible.</p>)}

          {detailTab === 'versions' && (
            <>
              <div className="-mx-5 -mt-5 mb-4 px-4 py-3 border-b border-gray-700/60 flex flex-wrap gap-2">
                <FilterSelect value={versionFilter} onChange={v => { setVersionFilter(v); setVersionsPage(0) }} options={versionOptions} placeholder="Versión" icon={Tag} />
                <FilterSelect value={loaderFilter} onChange={v => { setLoaderFilter(v); setVersionsPage(0) }} options={loaderOptions} placeholder="Loader" icon={Layers} />
              </div>
              {loadingVersions ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-gray-700/50" />)}</div>
              : filteredVersions.length === 0 ? <p className="text-sm text-gray-600">No hay versiones para estos filtros.</p>
              : (
                <div className="space-y-2">
                  {pagedVersions.map(ver => (
                    <div key={ver.id} className="flex items-center justify-between px-4 py-3 rounded-xl border gap-3 bg-gray-800/50 border-purple-500/15 hover:border-purple-500/30 hover:bg-purple-950/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-200">{ver.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {ver.gameVersions.slice(0, 3).map(v => (
                            <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-gray-700/60 text-gray-400">{v}</span>
                          ))}
                          {ver.loaders.map(l => (
                            <span key={l.key} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${l.colorClass}`}>{l.label}</span>
                          ))}
                          {ver.date && <span className="text-[10px] text-gray-600">{ver.date}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => onInstall(ver.id)}
                        disabled={installing}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                          installing ? 'bg-purple-600/60 text-white/70 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                        }`}
                      >
                        {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={10} />}
                        Instalar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700/60">
                  <span className="text-xs text-gray-500">{filteredVersions.length} versiones</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setVersionsPage(p => Math.max(0, p - 1))} disabled={versionsPage === 0} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"><ChevronLeft size={15} /></button>
                    <span className="text-xs font-medium min-w-[60px] text-center text-gray-400">{versionsPage + 1} / {totalPages}</span>
                    <button onClick={() => setVersionsPage(p => Math.min(totalPages - 1, p + 1))} disabled={versionsPage >= totalPages - 1} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"><ChevronRight size={15} /></button>
                  </div>
                </div>
              )}
            </>
          )}

          {detailTab === 'screenshots' && (
            screenshots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {screenshots.map((ss, i) => (
                  <button key={ss.key} onClick={() => setLightboxIndex(i)} className="aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group border-purple-500/20 hover:border-purple-400/50" aria-label={ss.title || 'Ver screenshot'}>
                    <img src={ss.thumbUrl || ss.url} alt={ss.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">No hay capturas disponibles.</p>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main ModCatalogModal ───────────────────────────────────────────────────────
interface Props {
  instance: Instance
  onClose: () => void
  onModInstalled: () => void
  installedModIds?: Set<number>
  installedMrSlugs?: Set<string>
  defaultSource?: Source
}

type Source = 'cf' | 'mr'

export default function ModCatalogModal({ instance, onClose, onModInstalled, installedModIds: parentInstalledIds, installedMrSlugs: parentInstalledMrSlugs, defaultSource = 'cf' }: Props) {
  const [source, setSource] = useState<Source>(defaultSource)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [version, setVersion] = useState(instance.mcVersion)
  const [loader, setLoader] = useState(() => {
    const l = instance.modLoader.toLowerCase()
    if (source === 'mr') return l === 'vanilla' ? '' : l
    const n = CF_LOADER_NUM[l]
    return n ? String(n) : ''
  })
  const [sortField, setSortField] = useState('2')
  const [mrSortField, setMrSortField] = useState('relevance')
  const [page, setPage] = useState(0)
  const [mods, setMods] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<{ id: string | number; versionId?: string } | null>(null)
  const [installErrors, setInstallErrors] = useState<Record<string | number, string>>({})
  const [installedIds, setInstalledIds] = useState(new Set<number>())
  const [installedMrSlugs, setInstalledMrSlugs] = useState(new Set<string>())
  const [selectedMod, setSelectedMod] = useState<any>(null)
  const [depsNotice, setDepsNotice] = useState<DepsNotice | null>(null)
  const [searchError, setSearchError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on source change
  useEffect(() => {
    setPage(0)
    setMods([])
    setSelectedMod(null)
    setSearch('')
    setDebouncedSearch('')
    const l = instance.modLoader.toLowerCase()
    if (source === 'mr') setLoader(l === 'vanilla' ? '' : l)
    else { const n = CF_LOADER_NUM[l]; setLoader(n ? String(n) : '') }
  }, [source])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  // Fetch mods
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSearchError('')
    const fetch = source === 'cf'
      ? (window.launcher.cf.searchMods({
          searchFilter: debouncedSearch,
          gameVersion: version,
          modLoaderType: loader ? Number(loader) : undefined,
          sortField: Number(sortField),
          index: page * PAGE_SIZE,
          pageSize: PAGE_SIZE,
        }) as Promise<any>).then(r => ({ data: r.data ?? [], total: r.pagination?.totalCount ?? 0 }))
      : mrSearch({
          query: debouncedSearch || undefined,
          gameVersions: version ? [version] : undefined,
          loaders: loader ? [loader] : undefined,
          sortBy: mrSortField,
          projectType: 'mod',
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
        }).then(r => ({ data: r.hits ?? [], total: r.total_hits ?? 0 }))

    fetch.then(({ data, total }) => {
      if (!cancelled) { setMods(data); setTotalCount(total) }
    }).catch((e: any) => {
      if (!cancelled) {
        setMods([]); setTotalCount(0)
        setSearchError(e?.message ?? 'Error al buscar')
      }
    }).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [source, debouncedSearch, version, loader, sortField, mrSortField, page, retryCount])

  useEffect(() => {
    if (!selectedMod) inputRef.current?.focus()
  }, [selectedMod])

  const isCfInstalled = (modId: number) => installedIds.has(modId) || (parentInstalledIds?.has(modId) ?? false)
  const isMrInstalled = (slug: string) => installedMrSlugs.has(slug) || (parentInstalledMrSlugs?.has(slug) ?? false)

  // CF install
  const installCfMod = async (mod: any, fileId: number) => {
    if (!fileId) return
    setInstalling({ id: mod.id })
    setInstallErrors(prev => { const n = { ...prev }; delete n[mod.id]; return n })
    setDepsNotice(null)
    try {
      const result = await (window.launcher.instances.installModWithDeps(instance.id, mod.id, fileId) as Promise<any>)
      setInstalledIds(prev => new Set([...prev, mod.id]))
      if ((result.depsInstalled?.length ?? 0) > 0 || (result.depsFailed?.length ?? 0) > 0) {
        setDepsNotice({ deps: result.depsInstalled ?? [], failedDeps: result.depsFailed ?? [] })
      }
      onModInstalled()
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [mod.id]: err.message ?? 'Error desconocido' }))
    } finally {
      setInstalling(null)
    }
  }

  // MR install (from detail view — versionId known)
  const installMrMod = async (mod: any, versionId: string) => {
    setInstalling({ id: mod.project_id, versionId })
    setInstallErrors(prev => { const n = { ...prev }; delete n[mod.project_id]; return n })
    try {
      await window.launcher.mr.installVersion(instance.id, versionId, 'mods', mod.slug)
      setInstalledMrSlugs(prev => new Set([...prev, mod.slug]))
      onModInstalled()
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [mod.project_id]: err.message ?? 'Error desconocido' }))
    } finally {
      setInstalling(null)
    }
  }

  // MR install (from card — pick best version first)
  const installMrModDirect = async (mod: any) => {
    setInstalling({ id: mod.project_id })
    setInstallErrors(prev => { const n = { ...prev }; delete n[mod.project_id]; return n })
    try {
      const vers = await mrGetProjectVersions(mod.project_id) as any[]
      const best = pickBestNormVersion(vers.map(mrVerToNormVersion), version, loader, 'mr')
      if (!best) throw new Error('No hay versión compatible')
      await window.launcher.mr.installVersion(instance.id, best.id, 'mods', mod.slug)
      setInstalledMrSlugs(prev => new Set([...prev, mod.slug]))
      onModInstalled()
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [mod.project_id]: err.message ?? 'Error desconocido' }))
    } finally {
      setInstalling(null)
    }
  }


  const totalPages = Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE)

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-3 md:p-6">
        <div
          className="w-full max-w-5xl h-full max-h-[92vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col bg-[#13111f] border-purple-500/40"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${source === 'cf' ? 'bg-orange-500/15' : 'bg-green-500/15'}`}>
                {source === 'cf'
                  ? <Flame size={14} className="text-orange-400" />
                  : <Leaf size={14} className="text-green-400" />}
              </div>
              <h3 className="font-semibold text-sm text-white">
                Catálogo de Mods — <span className={source === 'cf' ? 'text-orange-400' : 'text-green-400'}>{instance.name}</span>
              </h3>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ml-1 ${source === 'cf' ? 'bg-orange-500/10 border-orange-500/25 text-orange-400' : 'bg-green-500/10 border-green-500/25 text-green-400'}`}>
                {source === 'mr' ? 'Modrinth' : 'CurseForge'}
              </span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-700/40 text-gray-400 hover:text-gray-200">
              <X size={15} />
            </button>
          </div>

          {/* Detail view or catalog */}
          {selectedMod ? (
            <ModDetailView
              mod={selectedMod}
              source={source}
              installing={source === 'cf' ? installing?.id === selectedMod.id : installing?.id === selectedMod.project_id}
              installed={source === 'cf' ? isCfInstalled(selectedMod.id) : isMrInstalled(selectedMod.slug)}
              installError={source === 'cf' ? installErrors[selectedMod.id] : installErrors[selectedMod.project_id]}
              onInstall={id => source === 'cf' ? installCfMod(selectedMod, Number(id)) : installMrMod(selectedMod, id)}
              onBack={() => setSelectedMod(null)}
              version={version}
              loader={loader}
              depsNotice={source === 'cf' ? depsNotice : null}
              onClearDeps={() => setDepsNotice(null)}
            />
          ) : (
            <>
              {/* Filters */}
              <div className="px-4 py-3 border-b border-gray-700/60 flex-shrink-0 flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar mod..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
                  />
                </div>
                <FilterSelect value={version} onChange={v => { setVersion(v); setPage(0) }} options={MC_VERSION_OPTIONS} placeholder="Versión" icon={Tag} />
                <FilterSelect
                  value={loader}
                  onChange={v => { setLoader(v); setPage(0) }}
                  options={source === 'cf' ? CF_LOADER_OPTIONS : MR_LOADER_OPTIONS}
                  placeholder="Loader"
                  icon={Layers}
                />
                <FilterSelect
                  value={source === 'cf' ? sortField : mrSortField}
                  onChange={v => { source === 'cf' ? setSortField(v) : setMrSortField(v); setPage(0) }}
                  options={source === 'cf' ? CF_SORT_OPTIONS : MR_SORT_OPTIONS}
                  placeholder="Ordenar"
                  icon={ArrowUpDown}
                />
              </div>

              {/* Deps notice (CF only) */}
              {source === 'cf' && depsNotice && (
                <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 border bg-purple-500/10 border-purple-500/25 flex-shrink-0">
                  <div className="flex-1 min-w-0">
                    {depsNotice.deps.length > 0 && <p className="text-xs font-medium text-indigo-300">Dependencias instaladas: {depsNotice.deps.map(d => d.name).join(', ')}</p>}
                    {depsNotice.failedDeps.length > 0 && <p className="text-xs mt-0.5 text-red-400">No se pudieron instalar: {depsNotice.failedDeps.map(d => `mod ${d.modId}`).join(', ')}</p>}
                  </div>
                  <button onClick={() => setDepsNotice(null)} className="p-0.5 rounded flex-shrink-0 text-gray-500 hover:text-gray-300"><X size={13} /></button>
                </div>
              )}

              {/* Mod grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(9)].map((_, i) => <div key={i} className="h-36 rounded-2xl animate-pulse bg-gray-700/50" />)}
                  </div>
                ) : searchError ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
                    <Package size={40} className="opacity-25 text-red-500" />
                    <p className="text-sm text-red-400">Error al consultar el repositorio</p>
                    <p className="text-xs text-gray-600 text-center max-w-xs">{searchError}</p>
                    <button onClick={() => setRetryCount(c => c + 1)} className="text-xs px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                      Volver a intentar
                    </button>
                  </div>
                ) : mods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
                    <Package size={40} className="opacity-25" />
                    <p className="text-sm">No se encontraron mods</p>
                    {(version || loader) && (
                      <button onClick={() => { setVersion(''); setLoader('') }} className="text-xs text-purple-400 hover:text-purple-300 underline">
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mods.map(mod => {
                      const uid = source === 'cf' ? mod.id : mod.project_id
                      return (
                        <ModCard
                          key={uid}
                          mod={mod}
                          source={source}
                          installing={installing?.id === uid}
                          installed={source === 'cf' ? isCfInstalled(mod.id) : isMrInstalled(mod.slug)}
                          error={installErrors[uid]}
                          onInstall={() => source === 'cf'
                            ? (() => { const fid = pickFileId(mod, version, loader); if (fid !== null) installCfMod(mod, fid) })()
                            : installMrModDirect(mod)
                          }
                          onDetail={() => setSelectedMod(mod)}
                          version={version}
                          loader={loader}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700/60 flex-shrink-0">
                <span className="text-xs text-gray-500">
                  {loading ? <RefreshCw size={11} className="animate-spin inline mr-1" /> : null}
                  {totalCount > 0 ? `${totalCount.toLocaleString()} mods` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200" aria-label="Página anterior">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs font-medium min-w-[60px] text-center text-gray-400">
                    {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200" aria-label="Página siguiente">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
