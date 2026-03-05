import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Search, Download, RefreshCw, ChevronLeft, ChevronRight,
  Tag, ArrowUpDown, Image, Sparkles, Database,
} from 'lucide-react'
import ImageViewer from './ImageViewer'
import FilterSelect from './common/FilterSelect'
import type { Instance } from '../types'

// ── CurseForge class / category IDs ──────────────────────────────────────────
export const FILE_CLASS: Record<string, { classId?: number; categoryId?: number; label: string; folder: string; icon: React.ElementType; mrProjectType: string }> = {
  resourcepacks: { classId: 12,   label: 'Resource Packs', folder: 'resourcepacks', icon: Image,    mrProjectType: 'resourcepack' },
  shaderpacks:   { classId: 6552, label: 'Shaders',        folder: 'shaderpacks',   icon: Sparkles, mrProjectType: 'shader' },
  datapacks:     { classId: 6945, label: 'Data Packs',     folder: 'datapacks',     icon: Database, mrProjectType: 'datapack' },
}

const CF_SORT_OPTIONS = [
  { value: '2', label: 'Popularidad' },
  { value: '6', label: 'Descargas' },
  { value: '3', label: 'Actualización' },
  { value: '4', label: 'Nombre' },
]

const MR_SORT_OPTIONS = [
  { value: 'downloads', label: 'Más descargados' },
  { value: 'follows',   label: 'Más seguidos' },
  { value: 'newest',    label: 'Más nuevos' },
  { value: 'updated',   label: 'Actualizados' },
  { value: 'relevance', label: 'Relevancia' },
]

const PAGE_SIZE = 20
const FILES_PER_PAGE = 15

type Source = 'cf' | 'mr'

function formatDownloads(n: number): string {
  if (!n) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toString()
}

function formatFileDate(isoDate: string): string | null {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Norm types & adapters ──────────────────────────────────────────────────────
interface NormFileVersion { id: string; name: string; gameVersions: string[]; date: string | null }

function cfFileToNorm(file: any): NormFileVersion {
  return {
    id: String(file.id),
    name: file.displayName || file.fileName,
    gameVersions: (file.gameVersions || []).filter((v: string) => /^\d+\.\d+/.test(v)),
    date: formatFileDate(file.fileDate),
  }
}

function mrVerToNorm(ver: any): NormFileVersion {
  return {
    id: ver.id,
    name: ver.name,
    gameVersions: (ver.game_versions as string[]).filter(v => /^\d+\.\d+/.test(v)),
    date: formatFileDate(ver.date_published),
  }
}

function pickBestFileVersion(versions: NormFileVersion[], mcVersion: string): NormFileVersion | null {
  if (versions.length === 0) return null
  return versions.find(v => !mcVersion || v.gameVersions.includes(mcVersion)) ?? versions[0]
}


// ── FileCard ──────────────────────────────────────────────────────────────────
function FileCard({ mod, source, installing, installed, error, onInstall, onDetail, Icon }: {
  mod: any; source: Source; installing: boolean; installed: boolean; error?: string
  onInstall: () => void; onDetail: () => void; Icon: React.ElementType
}) {
  const isCf = source === 'cf'
  const name = isCf ? mod.name : mod.title
  const summary = isCf ? mod.summary : mod.description
  const iconUrl = isCf ? mod.logo?.thumbnailUrl : mod.icon_url
  const downloads = isCf ? mod.downloadCount : (mod.downloads ?? 0)
  const author = isCf
    ? (mod.authors?.length > 0 ? mod.authors.map((a: any) => a.name).join(', ') : null)
    : (mod.author ?? null)

  return (
    <div onClick={onDetail} className="rounded-2xl border flex flex-col transition-all cursor-pointer bg-gradient-to-br from-[#1e1a2e] to-[#161320] border-purple-500/35 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/30 hover:-translate-y-0.5">
      <div className="p-3 flex items-start gap-3 flex-1">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
            <Icon size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight text-gray-100">{name}</p>
          <p className="text-xs mt-1 line-clamp-2 leading-relaxed text-gray-500">{summary}</p>
          {author && <p className="text-[10px] mt-1 text-gray-600 truncate">por {author}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-700/50" onClick={e => e.stopPropagation()}>
        <span className="text-xs flex items-center gap-1 text-gray-500"><Download size={10} />{formatDownloads(downloads)}</span>
        {error ? (
          <span className="text-[11px] text-red-400 truncate max-w-[130px]" title={error}>{error}</span>
        ) : installed ? (
          <span className="text-xs text-green-400 font-medium">✓ Instalado</span>
        ) : (
          <button onClick={onInstall} disabled={installing}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              installing ? 'bg-purple-600/60 text-white/70 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}>
            {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={11} />}
            {installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── FileDetailView ────────────────────────────────────────────────────────────
interface FileDetailViewProps {
  mod: any; source: Source; version: string
  installing: boolean; installed: boolean; installError?: string
  Icon: React.ElementType; onInstall: (id: string) => void; onBack: () => void
}

function FileDetailView({ mod, source, version, installing, installed, installError, Icon, onInstall, onBack }: FileDetailViewProps) {
  const isCf = source === 'cf'
  const [detailTab, setDetailTab] = useState<'desc' | 'versions' | 'screenshots'>('desc')
  const [description, setDescription] = useState('')
  const [loadingDesc, setLoadingDesc] = useState(false)
  const [normVersions, setNormVersions] = useState<NormFileVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [versionFilter, setVersionFilter] = useState('')
  const [versionsPage, setVersionsPage] = useState(0)

  const name = isCf ? mod.name : mod.title
  const summary = isCf ? mod.summary : mod.description
  const iconUrl = isCf ? (mod.logo?.url || mod.logo?.thumbnailUrl) : mod.icon_url
  const downloads = isCf ? mod.downloadCount : (mod.downloads ?? 0)
  const authors = isCf
    ? (mod.authors?.length > 0 ? mod.authors.map((a: any) => a.name).join(', ') : null)
    : (mod.author ?? null)
  const screenshots: { key: string; url: string; thumbUrl: string }[] = isCf
    ? (mod.screenshots ?? []).map((s: any) => ({ key: String(s.id), url: s.url || s.thumbnailUrl, thumbUrl: s.thumbnailUrl || s.url }))
    : (mod.gallery ?? []).map((g: any, i: number) => ({ key: String(i), url: g.url, thumbUrl: g.url }))

  const bestVersion = useMemo(() => pickBestFileVersion(normVersions, version), [normVersions, version])
  const compatible = bestVersion !== null

  const filteredVersions = useMemo(() =>
    normVersions.filter(v => !versionFilter || v.gameVersions.includes(versionFilter)),
    [normVersions, versionFilter]
  )
  const totalPages = Math.ceil(filteredVersions.length / FILES_PER_PAGE)
  const pagedVersions = filteredVersions.slice(versionsPage * FILES_PER_PAGE, (versionsPage + 1) * FILES_PER_PAGE)

  useEffect(() => { setVersionsPage(0) }, [versionFilter])

  const versionOptions = useMemo(() => {
    const vs = [...new Set(normVersions.flatMap(v => v.gameVersions))].sort((a, b) => {
      const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
      return 0
    })
    return [{ value: '', label: 'Todas las versiones' }, ...vs.map(v => ({ value: v, label: v }))]
  }, [normVersions])

  const uid = isCf ? mod.id : mod.project_id

  useEffect(() => {
    setLoadingDesc(true)
    const descP: Promise<string> = isCf
      ? (window.launcher.cf.getModDescription(mod.id) as Promise<string>)
      : window.launcher.mr.getProject(mod.project_id).then((p: any) => p.body ?? '')
    descP.then(setDescription).catch(() => {}).finally(() => setLoadingDesc(false))

    setLoadingVersions(true)
    const versP: Promise<NormFileVersion[]> = isCf
      ? (window.launcher.cf.getModFiles(mod.id) as Promise<any>).then(r => (r?.data ?? []).map(cfFileToNorm))
      : window.launcher.mr.getProjectVersions(mod.project_id, version ? [version] : undefined).then((vs: any[]) => vs.map(mrVerToNorm))
    versP.then(nv => {
      setNormVersions(nv)
      const hasVersion = nv.some(v => v.gameVersions.includes(version))
      setVersionFilter(version && hasVersion ? version : '')
    }).catch(() => {}).finally(() => setLoadingVersions(false))
  }, [uid])

  return (
    <>
      {lightboxIndex !== null && (
        <ImageViewer
          images={screenshots.map(ss => ({ url: ss.url, thumbUrl: ss.thumbUrl }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700/60 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
          <ChevronLeft size={16} />Volver al catálogo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative px-5 py-5 border-b border-purple-500/25 bg-[#1a1628]">
          <div className="flex items-start gap-4">
            {iconUrl ? (
              <img src={iconUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
                <Icon size={28} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight text-white">{name}</h2>
              {authors && <p className="text-xs mt-0.5 text-gray-500">por {authors}</p>}
              <p className="text-sm mt-2 leading-relaxed text-gray-400 line-clamp-3">{summary}</p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-gray-500">
                <Download size={11} />{formatDownloads(downloads)} descargas
              </span>
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
          {detailTab === 'desc' && (
            loadingDesc ? <div className="h-32 rounded-xl animate-pulse bg-gray-700/50" /> :
            description ? (
              isCf ? (
                <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40 text-gray-300 text-sm leading-relaxed [&_a]:text-purple-400 [&_a:hover]:text-purple-300 [&_img]:rounded-lg [&_img]:max-w-full [&_h1]:text-white [&_h1]:font-bold [&_h1]:text-base [&_h2]:text-white [&_h2]:font-semibold [&_h3]:text-gray-200 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_p]:mt-2 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: description }} />
              ) : (
                <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40 text-gray-300 text-sm leading-relaxed overflow-hidden whitespace-pre-wrap">{description}</div>
              )
            ) : <p className="text-sm text-gray-600">Sin descripción disponible.</p>
          )}
          {detailTab === 'versions' && (
            <>
              <div className="-mx-5 -mt-5 mb-4 px-4 py-3 border-b border-gray-700/60 flex flex-wrap gap-2">
                <FilterSelect value={versionFilter} onChange={v => { setVersionFilter(v); setVersionsPage(0) }} options={versionOptions} placeholder="Versión" icon={Tag} />
              </div>
              {loadingVersions ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-gray-700/50" />)}</div>
              ) : filteredVersions.length === 0 ? <p className="text-sm text-gray-600">No hay versiones para estos filtros.</p> : (
                <div className="space-y-2">
                  {pagedVersions.map(ver => (
                    <div key={ver.id} className="flex items-center justify-between px-4 py-3 rounded-xl border gap-3 bg-gray-800/50 border-purple-500/15 hover:border-purple-500/30 hover:bg-purple-950/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-200">{ver.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {ver.gameVersions.slice(0, 4).map(v => (
                            <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-gray-700/60 text-gray-400">{v}</span>
                          ))}
                          {ver.date && <span className="text-[10px] text-gray-600">{ver.date}</span>}
                        </div>
                      </div>
                      <button onClick={() => onInstall(ver.id)} disabled={installing}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                          installing ? 'bg-purple-600/60 text-white/70 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                        }`}>
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
                  <button key={ss.key} onClick={() => setLightboxIndex(i)}
                    className="aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group border-purple-500/20 hover:border-purple-400/50">
                    <img src={ss.thumbUrl || ss.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props {
  instance: Instance
  type: keyof typeof FILE_CLASS
  installedFiles: string[]
  defaultSource?: Source
  onClose: () => void
  onInstalled: (filename: string) => void
}

export default function FileCatalogModal({ instance, type, installedFiles: _installedFiles, defaultSource, onClose, onInstalled }: Props) {
  const { classId, categoryId, label, folder, icon: Icon, mrProjectType } = FILE_CLASS[type]

  const [source, setSource] = useState<Source>(defaultSource ?? 'cf')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [version, setVersion] = useState(instance.mcVersion)
  const [page, setPage] = useState(0)
  const [mods, setMods] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({})
  const [installedIds, setInstalledIds] = useState(new Set<string>())
  const [selectedMod, setSelectedMod] = useState<any>(null)
  const [mcVersions, setMcVersions] = useState<string[]>([])
  const [cfSortField, setCfSortField] = useState('2')
  const [mrSortBy, setMrSortBy] = useState('downloads')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (defaultSource) return
    window.launcher.settings.get().then((s: any) => {
      if (s?.modSource) setSource(s.modSource)
    }).catch(() => {})
  }, [defaultSource])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { setPage(0) }, [version, cfSortField, mrSortBy, source])

  useEffect(() => {
    window.launcher.mc.getVersionManifest()
      .then((manifest: any) => {
        const releases: string[] = (manifest?.versions ?? [])
          .filter((v: any) => v.type === 'release').map((v: any) => v.id as string)
        setMcVersions(releases)
      }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedMod) return
    setLoading(true)
    const doFetch = source === 'cf'
      ? (window.launcher.cf.searchFiles({
          ...(classId !== undefined ? { classId } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          searchFilter: debouncedSearch || undefined,
          gameVersion: version || undefined,
          sortField: Number(cfSortField),
          sortOrder: 'desc',
          pageSize: PAGE_SIZE,
          index: page * PAGE_SIZE,
        }) as Promise<any>).then(r => { setMods(r?.data ?? []); setTotalCount(r?.pagination?.totalCount ?? 0) })
      : (window.launcher.mr.search({
          query: debouncedSearch || undefined,
          projectType: mrProjectType,
          gameVersions: version ? [version] : undefined,
          sortBy: mrSortBy,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }) as Promise<any>).then(r => { setMods(r?.hits ?? []); setTotalCount(r?.total_hits ?? 0) })

    doFetch.catch(() => {}).finally(() => setLoading(false))
  }, [debouncedSearch, version, cfSortField, mrSortBy, page, classId, categoryId, selectedMod, source, mrProjectType])

  useEffect(() => {
    if (!selectedMod) inputRef.current?.focus()
  }, [selectedMod])

  async function handleCfInstall(mod: any, fileId: string) {
    const key = String(mod.id)
    setInstalling(key)
    setInstallErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    try {
      const result = await (window.launcher.instances.installFile(instance.id, folder, mod.id, Number(fileId)) as Promise<any>)
      setInstalledIds(prev => new Set([...prev, key]))
      onInstalled(result.filename)
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [key]: err.message ?? 'Error' }))
    } finally {
      setInstalling(null)
    }
  }

  async function handleMrInstall(mod: any, versionId: string) {
    const key = mod.project_id
    setInstalling(key)
    setInstallErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    try {
      const result = await (window.launcher.mr.installVersion(instance.id, versionId, folder) as Promise<any>)
      setInstalledIds(prev => new Set([...prev, key]))
      onInstalled(result.filename)
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [key]: err.message ?? 'Error' }))
    } finally {
      setInstalling(null)
    }
  }

  async function handleCfInstallDirect(mod: any) {
    const fileId = mod.mainFileId ?? mod.latestFilesIndexes?.[0]?.fileId
    if (fileId) await handleCfInstall(mod, String(fileId))
  }

  async function handleMrInstallDirect(mod: any) {
    const vid = mod.latest_version
    if (vid) await handleMrInstall(mod, vid)
  }

  function isInstalled(id: string) { return installedIds.has(id) }

  const isCf = source === 'cf'
  const totalPages = Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE)
  const versionOptions = [{ value: '', label: 'Todas las versiones' }, ...mcVersions.map(v => ({ value: v, label: v }))]

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-3 md:p-6">
        <div
          className="w-full max-w-4xl h-full max-h-[88vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col bg-[#13111f] border-purple-500/40"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                <Icon size={14} className="text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm text-white">
                {label} — <span className="text-purple-400">{instance.name}</span>
              </h3>
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium border-purple-500/25 text-purple-400">
                {isCf ? 'CurseForge' : 'Modrinth'}
              </span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-700/30 text-gray-400 hover:text-gray-200">
              <X size={15} />
            </button>
          </div>

          {/* Detail or catalog */}
          {selectedMod ? (
            <FileDetailView
              mod={selectedMod}
              source={source}
              version={version}
              Icon={Icon}
              installing={installing === (isCf ? String(selectedMod.id) : selectedMod.project_id)}
              installed={isInstalled(isCf ? String(selectedMod.id) : selectedMod.project_id)}
              installError={installErrors[isCf ? String(selectedMod.id) : selectedMod.project_id]}
              onInstall={id => isCf ? handleCfInstall(selectedMod, id) : handleMrInstall(selectedMod, id)}
              onBack={() => setSelectedMod(null)}
            />
          ) : (
            <>
              {/* Filters */}
              <div className="px-4 py-3 border-b border-gray-700/60 flex-shrink-0 flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                  <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Buscar ${label.toLowerCase()}...`}
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-sm border bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:ring-offset-0"
                  />
                </div>
                <FilterSelect value={version} onChange={v => { setVersion(v); setPage(0) }} options={versionOptions} placeholder="Versión" icon={Tag} />
                <FilterSelect
                  value={isCf ? cfSortField : mrSortBy}
                  onChange={v => { isCf ? setCfSortField(v) : setMrSortBy(v); setPage(0) }}
                  options={isCf ? CF_SORT_OPTIONS : MR_SORT_OPTIONS}
                  placeholder="Ordenar"
                  icon={ArrowUpDown}
                />
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(9)].map((_, i) => <div key={i} className="h-36 rounded-2xl animate-pulse bg-gray-700/50" />)}
                  </div>
                ) : mods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
                    <Icon size={40} className="opacity-25" />
                    <p className="text-sm">No se encontraron {label.toLowerCase()}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mods.map(mod => {
                      const modKey = isCf ? String(mod.id) : mod.project_id
                      return (
                        <FileCard
                          key={modKey}
                          mod={mod}
                          source={source}
                          Icon={Icon}
                          installing={installing === modKey}
                          installed={isInstalled(modKey)}
                          error={installErrors[modKey]}
                          onInstall={() => isCf ? handleCfInstallDirect(mod) : handleMrInstallDirect(mod)}
                          onDetail={() => setSelectedMod(mod)}
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
                  {totalCount > 0 ? `${totalCount.toLocaleString()} resultados` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs font-medium min-w-[60px] text-center text-gray-400">
                    {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200">
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
