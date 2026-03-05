import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Search, Download, RefreshCw, ChevronLeft, ChevronRight,
  Tag, ArrowUpDown, Image, Sparkles, Database, Leaf,
} from 'lucide-react'
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <img src={src} alt="" className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors">
        <X size={16} />
      </button>
    </div>
  )
}

// ── CF FileCard ───────────────────────────────────────────────────────────────
function CfFileCard({
  mod, installing, installed, error, onInstall, onDetail, Icon,
}: {
  mod: any; installing: boolean; installed: boolean; error?: string
  onInstall: () => void; onDetail: () => void; Icon: React.ElementType
}) {
  return (
    <div
      onClick={onDetail}
      className="rounded-2xl border flex flex-col transition-all cursor-pointer bg-gradient-to-br from-[#1e1a2e] to-[#161320] border-purple-500/35 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/30 hover:-translate-y-0.5"
    >
      <div className="p-3 flex items-start gap-3 flex-1">
        {mod.logo?.thumbnailUrl ? (
          <img src={mod.logo.thumbnailUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
            <Icon size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight text-gray-100">{mod.name}</p>
          <p className="text-xs mt-1 line-clamp-2 leading-relaxed text-gray-500">{mod.summary}</p>
          {mod.authors?.length > 0 && (
            <p className="text-[10px] mt-1 text-gray-600 truncate">por {mod.authors.map((a: any) => a.name).join(', ')}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-700/50" onClick={e => e.stopPropagation()}>
        <span className="text-xs flex items-center gap-1 text-gray-500">
          <Download size={10} />{formatDownloads(mod.downloadCount)}
        </span>
        {error ? (
          <span className="text-[11px] text-red-400 truncate max-w-[130px]" title={error}>{error}</span>
        ) : installed ? (
          <span className="text-xs text-green-400 font-medium">✓ Instalado</span>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              installing ? 'bg-purple-600/60 text-white/70 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}
          >
            {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={11} />}
            {installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── MR FileCard ───────────────────────────────────────────────────────────────
function MrFileCard({
  mod, installing, installed, error, onInstall, onDetail, Icon,
}: {
  mod: any; installing: boolean; installed: boolean; error?: string
  onInstall: () => void; onDetail: () => void; Icon: React.ElementType
}) {
  return (
    <div
      onClick={onDetail}
      className="rounded-2xl border flex flex-col transition-all cursor-pointer bg-gradient-to-br from-[#1e1a2e] to-[#161320] border-purple-500/35 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/30 hover:-translate-y-0.5"
    >
      <div className="p-3 flex items-start gap-3 flex-1">
        {mod.icon_url ? (
          <img src={mod.icon_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
            <Icon size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight text-gray-100">{mod.title}</p>
          <p className="text-xs mt-1 line-clamp-2 leading-relaxed text-gray-500">{mod.description}</p>
          {mod.author && (
            <p className="text-[10px] mt-1 text-gray-600 truncate">por {mod.author}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-700/50" onClick={e => e.stopPropagation()}>
        <span className="text-xs flex items-center gap-1 text-gray-500">
          <Download size={10} />{formatDownloads(mod.downloads ?? 0)}
        </span>
        {error ? (
          <span className="text-[11px] text-red-400 truncate max-w-[130px]" title={error}>{error}</span>
        ) : installed ? (
          <span className="text-xs text-green-400 font-medium">✓ Instalado</span>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              installing ? 'bg-purple-600/60 text-white/70 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}
          >
            {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={11} />}
            {installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── CF FileDetailView ─────────────────────────────────────────────────────────
interface CfFileDetailViewProps {
  mod: any; installing: boolean; installed: boolean; installError?: string
  Icon: React.ElementType; onInstall: (fileId: number) => void; onBack: () => void; version: string
}

function CfFileDetailView({ mod, installing, installed, installError, Icon, onInstall, onBack, version }: CfFileDetailViewProps) {
  const [detailTab, setDetailTab] = useState<'desc' | 'versions' | 'screenshots'>('desc')
  const [description, setDescription] = useState('')
  const [loadingDesc, setLoadingDesc] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [versionFilter, setVersionFilter] = useState('')
  const [filesPage, setFilesPage] = useState(0)

  const mainFileId = mod.mainFileId ?? mod.latestFilesIndexes?.[0]?.fileId ?? null
  const filteredFiles = files.filter(f => !versionFilter || (f.gameVersions || []).includes(versionFilter))
  const filesTotalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE)
  const pagedFiles = filteredFiles.slice(filesPage * FILES_PER_PAGE, (filesPage + 1) * FILES_PER_PAGE)

  useEffect(() => { setFilesPage(0) }, [versionFilter])

  const versionOptions = useMemo(() => {
    const versions = [...new Set(
      files.flatMap(f => (f.gameVersions || []) as string[]).filter(v => /^\d+\.\d+/.test(v))
    )].sort((a, b) => {
      const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
      return 0
    })
    return [{ value: '', label: 'Todas las versiones' }, ...versions.map(v => ({ value: v, label: v }))]
  }, [files])

  useEffect(() => {
    setLoadingDesc(true)
    ;(window.launcher.cf.getModDescription(mod.id) as Promise<string>)
      .then(html => setDescription(html)).catch(() => {}).finally(() => setLoadingDesc(false))
  }, [mod.id])

  useEffect(() => {
    if (detailTab !== 'versions') return
    setLoadingFiles(true)
    ;(window.launcher.cf.getModFiles(mod.id) as Promise<any>)
      .then(result => {
        const all: any[] = result?.data ?? []
        setFiles(all)
        const allGV = new Set(all.flatMap((f: any) => (f.gameVersions || []) as string[]))
        setVersionFilter(version && allGV.has(version) ? version : '')
      })
      .catch(() => {}).finally(() => setLoadingFiles(false))
  }, [mod.id, detailTab])

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700/60 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
          <ChevronLeft size={16} />Volver al catálogo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative px-5 py-5 border-b border-purple-500/25 bg-[#1a1628]">
          <div className="flex items-start gap-4">
            {mod.logo?.url || mod.logo?.thumbnailUrl ? (
              <img src={mod.logo.url || mod.logo.thumbnailUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
                <Icon size={28} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight text-white">{mod.name}</h2>
              {mod.authors?.length > 0 && <p className="text-xs mt-0.5 text-gray-500">por {mod.authors.map((a: any) => a.name).join(', ')}</p>}
              <p className="text-sm mt-2 leading-relaxed text-gray-400">{mod.summary}</p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-gray-500">
                <Download size={11} />{formatDownloads(mod.downloadCount)} descargas
              </span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {installed ? (
                <span className="text-sm text-green-400 font-medium">✓ Instalado</span>
              ) : (
                <>
                  <button
                    onClick={() => mainFileId !== null && onInstall(mainFileId)}
                    disabled={installing || mainFileId === null}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                      mainFileId === null ? 'border border-gray-700 text-gray-600'
                        : installing ? 'bg-purple-600/60 text-white/70 cursor-wait'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                    }`}
                  >
                    {installing ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={14} />}
                    {installing ? 'Instalando...' : 'Instalar'}
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
                {key === 'screenshots' && mod.screenshots?.length > 0 && <span className="ml-1 text-[10px] text-gray-600">({mod.screenshots.length})</span>}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {detailTab === 'desc' && (
            loadingDesc ? <div className="h-32 rounded-xl animate-pulse bg-gray-700/50" /> :
            description ? (
              <div className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40 text-gray-300 text-sm leading-relaxed [&_a]:text-purple-400 [&_a:hover]:text-purple-300 [&_img]:rounded-lg [&_img]:max-w-full [&_h1]:text-white [&_h1]:font-bold [&_h1]:text-base [&_h2]:text-white [&_h2]:font-semibold [&_h3]:text-gray-200 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_p]:mt-2 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: description }} />
            ) : <p className="text-sm text-gray-600">Sin descripción disponible.</p>
          )}
          {detailTab === 'versions' && (
            <>
              <div className="-mx-5 -mt-5 mb-4 px-4 py-3 border-b border-gray-700/60 flex flex-wrap gap-2">
                <FilterSelect value={versionFilter} onChange={setVersionFilter} options={versionOptions} placeholder="Versión" icon={Tag} />
              </div>
              {loadingFiles ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-gray-700/50" />)}</div>
              ) : filteredFiles.length === 0 ? <p className="text-sm text-gray-600">No hay archivos para estos filtros.</p> : (
                <div className="space-y-2">
                  {pagedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between px-4 py-3 rounded-xl border gap-3 bg-gray-800/50 border-purple-500/15 hover:border-purple-500/30 hover:bg-purple-950/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-200">{file.displayName || file.fileName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(file.gameVersions || []).filter((v: string) => /^\d+\.\d+/.test(v)).slice(0, 4).map((v: string) => (
                            <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-gray-700/60 text-gray-400">{v}</span>
                          ))}
                          {formatFileDate(file.fileDate) && <span className="text-[10px] text-gray-600">{formatFileDate(file.fileDate)}</span>}
                        </div>
                      </div>
                      <button onClick={() => onInstall(file.id)} disabled={installing}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${installing ? 'bg-purple-600/60 text-white/70 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'}`}>
                        {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={10} />}
                        Instalar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {filesTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700/60">
                  <span className="text-xs text-gray-500">{filteredFiles.length} archivos</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFilesPage(p => Math.max(0, p - 1))} disabled={filesPage === 0} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"><ChevronLeft size={15} /></button>
                    <span className="text-xs font-medium min-w-[60px] text-center text-gray-400">{filesPage + 1} / {filesTotalPages}</span>
                    <button onClick={() => setFilesPage(p => Math.min(filesTotalPages - 1, p + 1))} disabled={filesPage >= filesTotalPages - 1} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"><ChevronRight size={15} /></button>
                  </div>
                </div>
              )}
            </>
          )}
          {detailTab === 'screenshots' && (
            mod.screenshots?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mod.screenshots.map((ss: any) => (
                  <button key={ss.id} onClick={() => setLightboxSrc(ss.url || ss.thumbnailUrl)}
                    className="aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group border-purple-500/20 hover:border-purple-400/50">
                    <img src={ss.thumbnailUrl || ss.url} alt={ss.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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

// ── MR FileDetailView ─────────────────────────────────────────────────────────
interface MrFileDetailViewProps {
  mod: any; instanceId: string; folder: string; version: string
  installing: boolean; installed: boolean; installError?: string
  Icon: React.ElementType; onInstall: (versionId: string) => void; onBack: () => void
}

function MrFileDetailView({ mod, instanceId: _instanceId, folder: _folder, version, installing, installed, installError, Icon, onInstall, onBack }: MrFileDetailViewProps) {
  const [mrVersions, setMrVersions] = useState<any[]>([])
  const [loadingVers, setLoadingVers] = useState(false)

  useEffect(() => {
    setLoadingVers(true)
    window.launcher.mr.getProjectVersions(mod.project_id, version ? [version] : undefined)
      .then((vers: any[]) => setMrVersions(vers.slice(0, 30)))
      .catch(() => {})
      .finally(() => setLoadingVers(false))
  }, [mod.project_id, version])

  return (
    <>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700/60 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
          <ChevronLeft size={16} />Volver al catálogo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative px-5 py-5 border-b border-purple-500/25 bg-[#1a1628]">
          <div className="flex items-start gap-4">
            {mod.icon_url ? (
              <img src={mod.icon_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
                <Icon size={28} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight text-white">{mod.title}</h2>
              {mod.author && <p className="text-xs mt-0.5 text-gray-500">por {mod.author}</p>}
              <p className="text-sm mt-2 leading-relaxed text-gray-400 line-clamp-3">{mod.description}</p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-gray-500">
                <Download size={11} />{formatDownloads(mod.downloads ?? 0)} descargas
              </span>
            </div>
            {installed && (
              <div className="flex-shrink-0">
                <span className="text-sm text-green-400 font-medium">✓ Instalado</span>
              </div>
            )}
          </div>
          {installError && <p className="mt-3 text-[11px] text-red-400">{installError}</p>}
        </div>
        <div className="p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Versiones disponibles</h3>
          {loadingVers ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-gray-700/50" />)}</div>
          ) : mrVersions.length === 0 ? <p className="text-sm text-gray-600">No hay versiones disponibles.</p> : (
            <div className="space-y-2">
              {mrVersions.map(v => {
                const vMcVersions: string[] = (v.game_versions ?? []).filter((gv: string) => /^\d+\.\d+/.test(gv))
                return (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-xl border gap-3 bg-gray-800/50 border-purple-500/15 hover:border-purple-500/30 hover:bg-purple-950/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-200">{v.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {vMcVersions.slice(0, 4).map((gv: string) => (
                          <span key={gv} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-gray-700/60 text-gray-400">{gv}</span>
                        ))}
                        {v.date_published && <span className="text-[10px] text-gray-600">{formatFileDate(v.date_published)}</span>}
                      </div>
                    </div>
                    <button onClick={() => onInstall(v.id)} disabled={installing || installed}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                        installed ? 'bg-green-500/20 text-green-400 cursor-default'
                          : installing ? 'bg-purple-600/60 text-white/70 cursor-wait'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                      }`}>
                      {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={10} />}
                      {installed ? 'Instalado' : installing ? '...' : 'Instalar'}
                    </button>
                  </div>
                )
              })}
            </div>
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
  defaultSource?: 'cf' | 'mr'
  onClose: () => void
  onInstalled: (filename: string) => void
}

export default function FileCatalogModal({ instance, type, installedFiles: _installedFiles, defaultSource, onClose, onInstalled }: Props) {
  const { classId, categoryId, label, folder, icon: Icon, mrProjectType } = FILE_CLASS[type]

  const [source, setSource] = useState<'cf' | 'mr'>(defaultSource ?? 'cf')

  // Shared state
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

  // CF-specific
  const [cfSortField, setCfSortField] = useState('2')
  // MR-specific
  const [mrSortBy, setMrSortBy] = useState('downloads')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load source from settings only when no defaultSource was provided by the caller
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
          .filter((v: any) => v.type === 'release')
          .map((v: any) => v.id as string)
        setMcVersions(releases)
      })
      .catch(() => {})
  }, [])

  // Fetch mods
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
        }) as Promise<any>).then(result => {
          setMods(result?.data ?? [])
          setTotalCount(result?.pagination?.totalCount ?? 0)
        })
      : (window.launcher.mr.search({
          query: debouncedSearch || undefined,
          projectType: mrProjectType,
          gameVersions: version ? [version] : undefined,
          sortBy: mrSortBy,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }) as Promise<any>).then(result => {
          setMods(result?.hits ?? [])
          setTotalCount(result?.total_hits ?? 0)
        })

    doFetch.catch(() => {}).finally(() => setLoading(false))
  }, [debouncedSearch, version, cfSortField, mrSortBy, page, classId, categoryId, selectedMod, source, mrProjectType])

  useEffect(() => {
    if (!selectedMod) inputRef.current?.focus()
  }, [selectedMod])

  // ── CF install ────────────────────────────────────────────────────────────
  async function handleCfInstall(mod: any, fileId: number) {
    const key = String(mod.id)
    setInstalling(key)
    setInstallErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    try {
      const result = await (window.launcher.instances.installFile(instance.id, folder, mod.id, fileId) as Promise<any>)
      setInstalledIds(prev => new Set([...prev, key]))
      onInstalled(result.filename)
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [key]: err.message ?? 'Error' }))
    } finally {
      setInstalling(null)
    }
  }

  // ── MR install ────────────────────────────────────────────────────────────
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

  function isInstalled(id: string) { return installedIds.has(id) }

  const totalPages = Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE)
  const isCf = source === 'cf'

  const versionOptions = [
    { value: '', label: 'Todas las versiones' },
    ...mcVersions.map((v: string) => ({ value: v, label: v })),
  ]

  const accentBorder = 'border-purple-500/40'
  const accentBg     = 'bg-[#13111f]'
  const accentHdr    = 'border-gray-700/60'
  const accentIcon   = 'bg-purple-500/15'
  const accentIconCl = 'text-purple-400'
  const SourceIcon   = isCf ? Icon : Leaf

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-3 md:p-6">
        <div
          className={`w-full max-w-4xl h-full max-h-[88vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col ${accentBg} ${accentBorder}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${accentHdr}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentIcon}`}>
                <SourceIcon size={14} className={accentIconCl} />
              </div>
              <h3 className="font-semibold text-sm text-white">
                {label} — <span className={accentIconCl}>{instance.name}</span>
              </h3>
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium border-purple-500/25 text-purple-400`}>
                {isCf ? 'CurseForge' : 'Modrinth'}
              </span>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors hover:bg-gray-700/30 text-gray-400 hover:text-gray-200`}>
              <X size={15} />
            </button>
          </div>

          {/* Detail or catalog */}
          {selectedMod ? (
            isCf ? (
              <CfFileDetailView
                mod={selectedMod}
                Icon={Icon}
                installing={installing === String(selectedMod.id)}
                installed={isInstalled(String(selectedMod.id))}
                installError={installErrors[String(selectedMod.id)]}
                onInstall={fileId => handleCfInstall(selectedMod, fileId)}
                onBack={() => setSelectedMod(null)}
                version={version}
              />
            ) : (
              <MrFileDetailView
                mod={selectedMod}
                instanceId={instance.id}
                folder={folder}
                version={version}
                Icon={Icon}
                installing={installing === selectedMod.project_id}
                installed={isInstalled(selectedMod.project_id)}
                installError={installErrors[selectedMod.project_id]}
                onInstall={versionId => handleMrInstall(selectedMod, versionId)}
                onBack={() => setSelectedMod(null)}
              />
            )
          ) : (
            <>
              {/* Filters */}
              <div className={`px-4 py-3 border-b flex-shrink-0 flex flex-wrap gap-2 ${accentHdr}`}>
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                  <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Buscar ${label.toLowerCase()}...`}
                    className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm border bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:ring-offset-0`}
                  />
                </div>
                <FilterSelect
                  value={version}
                  onChange={v => { setVersion(v); setPage(0) }}
                  options={versionOptions}
                  placeholder="Versión"
                  icon={Tag}
                />
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
                      return isCf ? (
                        <CfFileCard
                          key={modKey}
                          mod={mod}
                          Icon={Icon}
                          installing={installing === modKey}
                          installed={isInstalled(modKey)}
                          error={installErrors[modKey]}
                          onInstall={() => {
                            const fileId = mod.mainFileId ?? mod.latestFilesIndexes?.[0]?.fileId
                            if (fileId) handleCfInstall(mod, fileId)
                          }}
                          onDetail={() => setSelectedMod(mod)}
                        />
                      ) : (
                        <MrFileCard
                          key={modKey}
                          mod={mod}
                          Icon={Icon}
                          installing={installing === modKey}
                          installed={isInstalled(modKey)}
                          error={installErrors[modKey]}
                          onInstall={() => {
                            // Quick install using latest_version
                            const vid = mod.latest_version
                            if (vid) handleMrInstall(mod, vid)
                          }}
                          onDetail={() => setSelectedMod(mod)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className={`flex items-center justify-between px-5 py-3 border-t flex-shrink-0 ${accentHdr}`}>
                <span className="text-xs text-gray-500">
                  {loading ? <RefreshCw size={11} className="animate-spin inline mr-1" /> : null}
                  {totalCount > 0 ? `${totalCount.toLocaleString()} resultados` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs font-medium min-w-[60px] text-center text-gray-400">
                    {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                  >
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
