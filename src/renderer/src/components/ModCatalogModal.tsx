import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Search, Package, Download, RefreshCw,
  ChevronLeft, ChevronRight, Tag, Layers, ArrowUpDown,
} from 'lucide-react'
import FilterSelect from './common/FilterSelect'
import type { Instance } from '../types'

const LOADER_NAMES: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }
const KNOWN_LOADER_NAMES = new Set(['Forge', 'Fabric', 'Quilt', 'NeoForge'])
const LOADER_NUM: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }

const LOADER_COLORS: Record<number, string> = {
  1: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  4: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  5: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}
const LOADER_NAME_COLORS: Record<string, string> = {
  Forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  Fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  Quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  NeoForge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

const SORT_OPTIONS = [
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

const CATALOG_LOADER_OPTIONS = [
  { value: '', label: 'Todos los loaders' },
  ...Object.entries(LOADER_NAMES).map(([k, v]) => ({ value: k, label: v })),
]

const PAGE_SIZE = 20

function formatDownloads(n: number): string {
  if (!n) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toString()
}

function getFileLoader(file: any): string | null {
  const fromGV = (file.gameVersions || []).find((v: string) => KNOWN_LOADER_NAMES.has(v))
  if (fromGV) return fromGV
  const fromSGV = (file.sortableGameVersions || []).find((sgv: any) => KNOWN_LOADER_NAMES.has(sgv.gameVersionName))
  return fromSGV?.gameVersionName ?? null
}

function formatFileDate(isoDate: string): string | null {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ── ModCard ───────────────────────────────────────────────────────────────────
interface ModCardProps {
  mod: any
  installing: boolean
  installed: boolean
  error?: string
  onInstall: () => void
  onDetail: () => void
  version: string
  loader: string
}

function ModCard({ mod, installing, installed, error, onInstall, onDetail, version, loader }: ModCardProps) {
  const fileId = pickFileId(mod, version, loader)
  const compatible = fileId !== null
  const availableLoaders = [...new Set((mod.latestFilesIndexes || []).map((f: any) => f.modLoader as number))].filter(Boolean) as number[]

  return (
    <div
      onClick={onDetail}
      className="rounded-2xl border flex flex-col transition-all cursor-pointer bg-gradient-to-br from-gray-700 via-purple-900/20 to-gray-800 border-purple-500/25 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-900/20 hover:-translate-y-0.5"
    >
      <div className="p-3 flex items-start gap-3 flex-1">
        {mod.logo?.thumbnailUrl ? (
          <img
            src={mod.logo.thumbnailUrl}
            alt=""
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight text-gray-100">{mod.name}</p>
          <p className="text-xs mt-1 line-clamp-2 leading-relaxed text-gray-500">{mod.summary}</p>
          {availableLoaders.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {availableLoaders.slice(0, 3).map(l => LOADER_NAMES[l] && (
                <span key={l} className={`text-[10px] px-1.5 py-px rounded-full font-medium border ${LOADER_COLORS[l] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400'}`}>
                  {LOADER_NAMES[l]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between px-3 py-2.5 border-t border-purple-500/10"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-xs flex items-center gap-1 text-gray-600">
          <Download size={10} />
          {formatDownloads(mod.downloadCount)}
        </span>
        {error ? (
          <span className="text-[11px] text-red-400 truncate max-w-[130px]" title={error}>{error}</span>
        ) : installed ? (
          <span className="text-xs text-green-400 font-medium">✓ Instalado</span>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing || !compatible}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              !compatible
                ? 'border border-gray-700/60 text-gray-600'
                : installing
                  ? 'bg-purple-600/60 text-white/70 cursor-wait'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}
          >
            {installing
              ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
              : <Download size={11} />}
            {!compatible ? 'Sin versión' : installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── ModDetailView ─────────────────────────────────────────────────────────────
interface DepsNotice {
  deps: { filename: string; name: string }[]
  failedDeps: { modId: number; error: string }[]
}

interface ModDetailViewProps {
  mod: any
  installing: boolean
  installed: boolean
  installError?: string
  onInstall: (fileId: number) => void
  onBack: () => void
  version: string
  loader: string
  depsNotice: DepsNotice | null
  onClearDeps: () => void
}

function ModDetailView({ mod, installing, installed, installError, onInstall, onBack, version, loader, depsNotice, onClearDeps }: ModDetailViewProps) {
  const [detailTab, setDetailTab] = useState<'desc' | 'versions' | 'screenshots'>('desc')
  const [description, setDescription] = useState('')
  const [loadingDesc, setLoadingDesc] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [versionFilter, setVersionFilter] = useState('')
  const [loaderFilter, setLoaderFilter] = useState('')
  const [filesPage, setFilesPage] = useState(0)
  const FILES_PER_PAGE = 15

  const fileId = pickFileId(mod, version, loader)
  const compatible = fileId !== null

  const isInstallable = (file: any) => {
    const gv: string[] = file.gameVersions || []
    if (version && !gv.includes(version)) return false
    if (loader && LOADER_NAMES[Number(loader)] && !gv.includes(LOADER_NAMES[Number(loader)])) return false
    return true
  }

  const matchesFilter = (file: any) => {
    const gv: string[] = file.gameVersions || []
    if (versionFilter && !gv.includes(versionFilter)) return false
    if (loaderFilter && LOADER_NAMES[Number(loaderFilter)] && !gv.includes(LOADER_NAMES[Number(loaderFilter)])) return false
    return true
  }

  const filteredFiles = files.filter(matchesFilter)
  const filesTotalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE)
  const pagedFiles = filteredFiles.slice(filesPage * FILES_PER_PAGE, (filesPage + 1) * FILES_PER_PAGE)

  useEffect(() => { setFilesPage(0) }, [versionFilter, loaderFilter])

  const versionOptions = useMemo(() => {
    const versions = [...new Set(
      files.flatMap(f => (f.gameVersions || []) as string[]).filter(v => /^\d+\.\d+/.test(v))
    )].sort((a, b) => {
      const pa = a.split('.').map(Number)
      const pb = b.split('.').map(Number)
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
      return 0
    })
    return [{ value: '', label: 'Todas las versiones' }, ...versions.map(v => ({ value: v, label: v }))]
  }, [files])

  const loaderOptions = useMemo(() => {
    const present = new Set(
      files.flatMap(f => (f.gameVersions || []) as string[])
        .map(v => Object.entries(LOADER_NAMES).find(([, name]) => name === v)?.[0])
        .filter(Boolean) as string[]
    )
    return [
      { value: '', label: 'Todos los loaders' },
      ...Object.entries(LOADER_NAMES).filter(([k]) => present.has(k)).map(([k, v]) => ({ value: k, label: v })),
    ]
  }, [files])

  useEffect(() => {
    setLoadingDesc(true)
    ;(window.launcher.cf.getModDescription(mod.id) as Promise<string>)
      .then(html => setDescription(html))
      .catch(() => {})
      .finally(() => setLoadingDesc(false))
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
        setLoaderFilter(loader && LOADER_NAMES[Number(loader)] && allGV.has(LOADER_NAMES[Number(loader)]) ? String(loader) : '')
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false))
  }, [mod.id, detailTab])

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Back */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700/60 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ChevronLeft size={16} />
          Volver al catálogo
        </button>
      </div>

      {/* Deps notice */}
      {depsNotice && (
        <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 border bg-purple-500/10 border-purple-500/25 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {depsNotice.deps.length > 0 && (
              <p className="text-xs font-medium text-purple-300">
                Dependencias instaladas: {depsNotice.deps.map(d => d.name).join(', ')}
              </p>
            )}
            {depsNotice.failedDeps.length > 0 && (
              <p className="text-xs mt-0.5 text-red-400">
                No se pudieron instalar: {depsNotice.failedDeps.map(d => `mod ${d.modId}`).join(', ')}
              </p>
            )}
          </div>
          <button onClick={onClearDeps} className="p-0.5 rounded flex-shrink-0 text-gray-500 hover:text-gray-300">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Hero */}
        <div className="relative px-5 py-5 border-b border-purple-500/15 bg-purple-950/20">
          <div className="flex items-start gap-4">
            {mod.logo?.url || mod.logo?.thumbnailUrl ? (
              <img
                src={mod.logo.url || mod.logo.thumbnailUrl}
                alt=""
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
                <Package size={28} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight text-white">{mod.name}</h2>
              {mod.authors?.length > 0 && (
                <p className="text-xs mt-0.5 text-gray-500">por {mod.authors.map((a: any) => a.name).join(', ')}</p>
              )}
              <p className="text-sm mt-2 leading-relaxed text-gray-400">{mod.summary}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="text-xs flex items-center gap-1 text-gray-500">
                  <Download size={11} />
                  {formatDownloads(mod.downloadCount)} descargas
                </span>
                {([...new Set((mod.latestFilesIndexes || []).map((f: any) => f.modLoader as number))].filter(Boolean) as number[]).slice(0, 4).map(l => LOADER_NAMES[l] && (
                  <span key={l} className={`text-[10px] px-1.5 py-px rounded-full font-medium border ${LOADER_COLORS[l] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400'}`}>
                    {LOADER_NAMES[l]}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {installed ? (
                <span className="text-sm text-green-400 font-medium">✓ Instalado</span>
              ) : (
                <>
                  <button
                    onClick={() => fileId !== null && onInstall(fileId)}
                    disabled={installing || !compatible}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                      !compatible
                        ? 'border border-gray-700 text-gray-600'
                        : installing
                          ? 'bg-purple-600/60 text-white/70 cursor-wait'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                    }`}
                  >
                    {installing
                      ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                      : <Download size={14} />}
                    {!compatible ? 'Sin versión' : installing ? 'Instalando...' : 'Instalar'}
                  </button>
                  {installError && (
                    <p className="text-[11px] text-red-400 max-w-[160px] text-right">{installError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2 border-b border-gray-700/60">
          {(['desc', 'versions', 'screenshots'] as const).map(key => {
            const labels = { desc: 'Descripción', versions: 'Versiones', screenshots: 'Capturas' }
            return (
              <button
                key={key}
                onClick={() => setDetailTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  detailTab === key ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/30'
                }`}
              >
                {labels[key]}
                {key === 'screenshots' && mod.screenshots?.length > 0 && (
                  <span className="ml-1 text-[10px] text-gray-600">({mod.screenshots.length})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* Description */}
          {detailTab === 'desc' && (
            loadingDesc ? (
              <div className="h-32 rounded-xl animate-pulse bg-gray-700/50" />
            ) : description ? (
              <div
                className="rounded-xl p-4 bg-gray-800/60 border border-gray-700/40 text-gray-300 text-sm leading-relaxed [&_a]:text-purple-400 [&_a:hover]:text-purple-300 [&_img]:rounded-lg [&_img]:max-w-full [&_h1]:text-white [&_h1]:font-bold [&_h1]:text-base [&_h2]:text-white [&_h2]:font-semibold [&_h3]:text-gray-200 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_p]:mt-2 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="text-sm text-gray-600">Sin descripción disponible.</p>
            )
          )}

          {/* Versions */}
          {detailTab === 'versions' && (
            <>
              <div className="-mx-5 -mt-5 mb-4 px-4 py-3 border-b border-gray-700/60 flex flex-wrap gap-2">
                <FilterSelect value={versionFilter} onChange={setVersionFilter} options={versionOptions} placeholder="Versión" icon={Tag} />
                <FilterSelect value={loaderFilter} onChange={setLoaderFilter} options={loaderOptions} placeholder="Loader" icon={Layers} />
              </div>
              {loadingFiles ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-gray-700/50" />)}
                </div>
              ) : filteredFiles.length === 0 ? (
                <p className="text-sm text-gray-600">No hay archivos para estos filtros.</p>
              ) : (
                <div className="space-y-2">
                  {pagedFiles.map(file => {
                    const installable = isInstallable(file)
                    return (
                      <div key={file.id} className="flex items-center justify-between px-4 py-3 rounded-xl border gap-3 bg-gray-800/50 border-purple-500/15 hover:border-purple-500/30 hover:bg-purple-950/10 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-gray-200">{file.displayName || file.fileName}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {(file.gameVersions || []).filter((v: string) => /^\d+\.\d+/.test(v)).slice(0, 3).map((v: string) => (
                              <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-gray-700/60 text-gray-400">{v}</span>
                            ))}
                            {getFileLoader(file) && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${LOADER_NAME_COLORS[getFileLoader(file)!] ?? 'bg-gray-700/60 border-gray-600/60 text-gray-400'}`}>{getFileLoader(file)}</span>
                            )}
                            {formatFileDate(file.fileDate) && (
                              <span className="text-[10px] text-gray-600">{formatFileDate(file.fileDate)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => installable && onInstall(file.id)}
                          disabled={installing || !installable}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                            !installable
                              ? 'border border-gray-700 text-gray-600 cursor-not-allowed'
                              : installing
                                ? 'bg-purple-600/60 text-white/70 cursor-wait'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                          }`}
                        >
                          {installing && installable
                            ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
                            : <Download size={10} />}
                          {installable ? 'Instalar' : 'Incompatible'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {filesTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700/60">
                  <span className="text-xs text-gray-500">{filteredFiles.length} archivos</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFilesPage(p => Math.max(0, p - 1))} disabled={filesPage === 0} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                      <ChevronLeft size={15} />
                    </button>
                    <span className="text-xs font-medium min-w-[60px] text-center text-gray-400">{filesPage + 1} / {filesTotalPages}</span>
                    <button onClick={() => setFilesPage(p => Math.min(filesTotalPages - 1, p + 1))} disabled={filesPage >= filesTotalPages - 1} className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Screenshots */}
          {detailTab === 'screenshots' && (
            mod.screenshots?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mod.screenshots.map((ss: any) => (
                  <button
                    key={ss.id}
                    onClick={() => setLightboxSrc(ss.url || ss.thumbnailUrl)}
                    className="aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group border-purple-500/20 hover:border-purple-400/50"
                    aria-label={ss.title || 'Ver screenshot'}
                  >
                    <img
                      src={ss.thumbnailUrl || ss.url}
                      alt={ss.title || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No hay capturas disponibles.</p>
            )
          )}

        </div>
      </div>
    </>
  )
}

// ── Main ModCatalogModal ──────────────────────────────────────────────────────
interface Props {
  instance: Instance
  onClose: () => void
  onModInstalled: () => void
  installedModIds?: Set<number>
}

export default function ModCatalogModal({ instance, onClose, onModInstalled, installedModIds: parentInstalledIds }: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [version, setVersion] = useState(instance.mcVersion)
  const [loader, setLoader] = useState(() => {
    const n = LOADER_NUM[instance.modLoader.toLowerCase()]
    return n ? String(n) : ''
  })
  const [sortField, setSortField] = useState('2')
  const [page, setPage] = useState(0)
  const [mods, setMods] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<{ modId: number; fileId: number } | null>(null)
  const [installErrors, setInstallErrors] = useState<Record<number, string>>({})
  const [installedIds, setInstalledIds] = useState(new Set<number>())
  const [selectedMod, setSelectedMod] = useState<any>(null)
  const [depsNotice, setDepsNotice] = useState<DepsNotice | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { setPage(0) }, [version, loader, sortField])

  useEffect(() => {
    if (selectedMod) return
    setLoading(true)
    ;(window.launcher.cf.searchMods({
      searchFilter: debouncedSearch || undefined,
      gameVersion: version || undefined,
      modLoaderType: loader ? Number(loader) : undefined,
      sortField: Number(sortField),
      sortOrder: 'desc',
      pageSize: PAGE_SIZE,
      index: page * PAGE_SIZE,
    }) as Promise<any>)
      .then(result => {
        setMods(result?.data ?? [])
        setTotalCount(result?.pagination?.totalCount ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedSearch, version, loader, sortField, page, selectedMod])

  useEffect(() => {
    if (!selectedMod) inputRef.current?.focus()
  }, [selectedMod])

  const isInstalled = (modId: number) => installedIds.has(modId) || (parentInstalledIds?.has(modId) ?? false)

  const installMod = async (mod: any, fileId: number) => {
    if (!fileId) return
    setInstalling({ modId: mod.id, fileId })
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

  const totalPages = Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE)

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-3 md:p-6">
        <div
          className="w-full max-w-5xl h-full max-h-[92vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col bg-gradient-to-br from-gray-900 via-purple-950/30 to-[#0a0a14] border-purple-500/30"
          onClick={e => e.stopPropagation()}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                <Package size={14} className="text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm text-white">
                Catálogo de Mods — <span className="text-purple-400">{instance.name}</span>
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors hover:bg-purple-500/15 text-gray-400 hover:text-gray-200"
            >
              <X size={15} />
            </button>
          </div>

          {/* Detail view or catalog */}
          {selectedMod ? (
            <ModDetailView
              mod={selectedMod}
              installing={installing?.modId === selectedMod.id}
              installed={isInstalled(selectedMod.id)}
              installError={installErrors[selectedMod.id]}
              onInstall={fileId => installMod(selectedMod, fileId)}
              onBack={() => setSelectedMod(null)}
              version={version}
              loader={loader}
              depsNotice={depsNotice}
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
                <FilterSelect
                  value={version}
                  onChange={v => { setVersion(v); setPage(0) }}
                  options={MC_VERSION_OPTIONS}
                  placeholder="Versión"
                  icon={Tag}
                />
                <FilterSelect
                  value={loader}
                  onChange={v => { setLoader(v); setPage(0) }}
                  options={CATALOG_LOADER_OPTIONS}
                  placeholder="Loader"
                  icon={Layers}
                />
                <FilterSelect
                  value={sortField}
                  onChange={v => { setSortField(v); setPage(0) }}
                  options={SORT_OPTIONS}
                  placeholder="Ordenar"
                  icon={ArrowUpDown}
                />
              </div>

              {/* Deps notice */}
              {depsNotice && (
                <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 border bg-purple-500/10 border-purple-500/25 flex-shrink-0">
                  <div className="flex-1 min-w-0">
                    {depsNotice.deps.length > 0 && (
                      <p className="text-xs font-medium text-indigo-300">
                        Dependencias instaladas: {depsNotice.deps.map(d => d.name).join(', ')}
                      </p>
                    )}
                    {depsNotice.failedDeps.length > 0 && (
                      <p className="text-xs mt-0.5 text-red-400">
                        No se pudieron instalar: {depsNotice.failedDeps.map(d => `mod ${d.modId}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setDepsNotice(null)} className="p-0.5 rounded flex-shrink-0 text-gray-500 hover:text-gray-300">
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Mod grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(9)].map((_, i) => <div key={i} className="h-36 rounded-2xl animate-pulse bg-gray-700/50" />)}
                  </div>
                ) : mods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
                    <Package size={40} className="opacity-25" />
                    <p className="text-sm">No se encontraron mods</p>
                    {(version || loader) && (
                      <button
                        onClick={() => { setVersion(''); setLoader('') }}
                        className="text-xs text-purple-400 hover:text-purple-300 underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mods.map(mod => (
                      <ModCard
                        key={mod.id}
                        mod={mod}
                        installing={installing?.modId === mod.id}
                        installed={isInstalled(mod.id)}
                        error={installErrors[mod.id]}
                        onInstall={() => {
                          const fid = pickFileId(mod, version, loader)
                          if (fid !== null) installMod(mod, fid)
                        }}
                        onDetail={() => setSelectedMod(mod)}
                        version={version}
                        loader={loader}
                      />
                    ))}
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
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                    aria-label="Página anterior"
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
                    aria-label="Página siguiente"
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
