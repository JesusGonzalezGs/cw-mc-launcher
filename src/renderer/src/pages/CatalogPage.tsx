import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Download, Loader2, PackageSearch, Tag, Layers, ArrowUpDown,
  BookOpen, Leaf,
} from 'lucide-react'
import { LOADER_TYPE_MAP } from '../constants'
import FilterSelect from '../components/common/FilterSelect'
import type { CfMod } from '../types'

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const CF_SORT_OPTIONS = [
  { value: '6:desc', label: 'Más descargados' },
  { value: '2:desc', label: 'Popularidad' },
  { value: '3:desc', label: 'Más recientes' },
  { value: '4:asc',  label: 'Nombre A–Z' },
]

const MR_SORT_OPTIONS = [
  { value: 'downloads', label: 'Más descargados' },
  { value: 'follows',   label: 'Más seguidos' },
  { value: 'newest',    label: 'Más nuevos' },
  { value: 'updated',   label: 'Actualizados' },
  { value: 'relevance', label: 'Relevancia' },
]

const LOADER_OPTIONS_CF = [
  { value: '',         label: 'Todos los loaders' },
  { value: 'Forge',    label: 'Forge' },
  { value: 'Fabric',   label: 'Fabric' },
  { value: 'NeoForge', label: 'NeoForge' },
  { value: 'Quilt',    label: 'Quilt' },
]

const LOADER_OPTIONS_MR = [
  { value: '',         label: 'Todos los loaders' },
  { value: 'forge',    label: 'Forge' },
  { value: 'fabric',   label: 'Fabric' },
  { value: 'neoforge', label: 'NeoForge' },
  { value: 'quilt',    label: 'Quilt' },
]

const CF_LOADER_NAMES: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }
const CF_LOADER_COLORS: Record<number, string> = {
  1: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  4: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  5: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

const MR_LOADER_COLORS: Record<string, string> = {
  forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  neoforge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

const KNOWN_LOADERS = new Set(['forge', 'fabric', 'quilt', 'neoforge', 'liteloader', 'modloader', 'rift'])

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const navigate = useNavigate()

  const [source, setSource] = useState<'cf' | 'mr'>('cf')

  // Shared filters
  const [inputQuery, setInputQuery] = useState('')
  const [query, setQuery]           = useState('')
  const [mcFilter, setMcFilter]     = useState('')
  const [loaderFilter, setLoaderFilter] = useState('')
  const [mcVersions, setMcVersions] = useState<string[]>([])

  // CF-specific
  const [cfSortOption, setCfSortOption] = useState('6:desc')
  const [categoryId, setCategoryId]     = useState('')
  const [categories, setCategories]     = useState<{ id: number; name: string }[]>([])
  const [cfModpacks, setCfModpacks]     = useState<CfMod[]>([])
  const [cfTotalCount, setCfTotalCount] = useState(0)
  const [cfPage, setCfPage]             = useState(0)

  // MR-specific
  const [mrSortOption, setMrSortOption] = useState('downloads')
  const [mrModpacks, setMrModpacks]     = useState<any[]>([])
  const [mrTotalCount, setMrTotalCount] = useState(0)
  const [mrPage, setMrPage]             = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load source from settings on mount
  useEffect(() => {
    window.launcher.settings.get().then((s: any) => {
      if (s?.modSource) setSource(s.modSource)
    }).catch(() => {})
  }, [])

  // Debounce text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQuery(inputQuery), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [inputQuery])

  // Load MC versions on mount
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

  // Load CF categories on mount
  useEffect(() => {
    window.launcher.cf.getCategories()
      .then((resp: any) => {
        const list: any[] = resp?.data ?? []
        setCategories(
          list
            .filter((c) => c.name && !c.name.toLowerCase().includes('bukkit'))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      })
      .catch(() => {})
  }, [])

  // Reset page when filters change
  useEffect(() => { setCfPage(0) }, [query, mcFilter, loaderFilter, cfSortOption, categoryId])
  useEffect(() => { setMrPage(0) }, [query, mcFilter, loaderFilter, mrSortOption])

  // Reset loader filter when source changes (CF uses uppercase, MR lowercase)
  useEffect(() => {
    setLoaderFilter('')
    setInputQuery('')
    setQuery('')
    setMcFilter('')
    setError('')
  }, [source])

  // ── CF fetch ────────────────────────────────────────────────────────────────
  const fetchCf = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError('')
    try {
      const [sortField, sortOrder] = cfSortOption.split(':') as [string, 'asc' | 'desc']
      const resp = await window.launcher.cf.searchModpacks({
        searchFilter: query || undefined,
        gameVersion: mcFilter || undefined,
        modLoaderType: loaderFilter ? LOADER_TYPE_MAP[loaderFilter] : undefined,
        sortField: Number(sortField),
        sortOrder,
        categoryId: categoryId ? Number(categoryId) : undefined,
        pageSize: PAGE_SIZE,
        index: targetPage * PAGE_SIZE,
      })
      setCfModpacks(resp?.data ?? [])
      setCfTotalCount(resp?.pagination?.totalCount ?? 0)
      setCfPage(targetPage)
    } catch (e: any) {
      setError(e.message ?? 'Error al buscar modpacks')
    } finally {
      setLoading(false)
    }
  }, [query, mcFilter, loaderFilter, cfSortOption, categoryId])

  // ── MR fetch ────────────────────────────────────────────────────────────────
  const fetchMr = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError('')
    try {
      const resp = await window.launcher.mr.search({
        query: query || undefined,
        projectType: 'modpack',
        gameVersions: mcFilter ? [mcFilter] : undefined,
        loaders: loaderFilter ? [loaderFilter] : undefined,
        sortBy: mrSortOption,
        limit: PAGE_SIZE,
        offset: targetPage * PAGE_SIZE,
      })
      setMrModpacks(resp?.hits ?? [])
      setMrTotalCount(resp?.total_hits ?? 0)
      setMrPage(targetPage)
    } catch (e: any) {
      setError(e.message ?? 'Error al buscar modpacks')
    } finally {
      setLoading(false)
    }
  }, [query, mcFilter, loaderFilter, mrSortOption])

  // Auto-fetch on filter changes
  useEffect(() => {
    if (source === 'cf') fetchCf(0)
  }, [query, mcFilter, loaderFilter, cfSortOption, categoryId, source])

  useEffect(() => {
    if (source === 'mr') fetchMr(0)
  }, [query, mcFilter, loaderFilter, mrSortOption, source])

  // ── Computed ────────────────────────────────────────────────────────────────
  const totalCount = source === 'cf' ? cfTotalCount : mrTotalCount
  const totalPages = Math.max(1, Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE))
  const page       = source === 'cf' ? cfPage : mrPage
  const hasFilters = !!inputQuery || !!mcFilter || !!loaderFilter || !!categoryId

  function clearFilters() {
    setInputQuery('')
    setQuery('')
    setMcFilter('')
    setLoaderFilter('')
    setCategoryId('')
    setCfSortOption('6:desc')
    setMrSortOption('downloads')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {source === 'cf' ? (
          <>
            <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-orange-600" />
            <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-amber-600" />
          </>
        ) : (
          <>
            <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-green-600" />
            <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-emerald-600" />
          </>
        )}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* Header */}
        <div className="mb-7">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${
            source === 'cf'
              ? 'bg-orange-500/10 border-orange-500/25 text-orange-300'
              : 'bg-green-500/10 border-green-500/25 text-green-300'
          }`}>
            {source === 'cf' ? <BookOpen size={11} /> : <Leaf size={11} />}
            {source === 'cf' ? 'CurseForge' : 'Modrinth'}
          </div>
          <h1 className={`text-3xl pb-4 sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r bg-clip-text text-transparent mb-2 ${
            source === 'cf' ? 'from-orange-400 to-amber-400' : 'from-green-400 to-emerald-400'
          }`}>
            Catálogo de Modpacks
          </h1>
          {!loading && totalCount > 0 && (
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-300">{totalCount.toLocaleString()}</span> modpacks encontrados
            </p>
          )}
        </div>

        {/* Filter bar */}
        <div className={`flex flex-col sm:flex-row flex-wrap gap-2.5 mb-6 p-3 rounded-2xl border bg-gray-800/40 ${
          source === 'cf' ? 'border-gray-700/50' : 'border-green-900/30'
        }`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Buscar modpack..."
              aria-label="Buscar modpack"
              className={`w-full bg-gray-800/80 border border-gray-700/80 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none transition-all ${
                source === 'cf'
                  ? 'focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20'
                  : 'focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
              } focus:ring-offset-0`}
            />
          </div>

          {/* MC Version */}
          <FilterSelect
            icon={Tag}
            value={mcFilter}
            onChange={setMcFilter}
            placeholder="Todas las versiones"
            options={[
              { value: '', label: 'Todas las versiones' },
              ...mcVersions.map((v) => ({ value: v, label: v })),
            ]}
          />

          {/* Loader */}
          <FilterSelect
            icon={Layers}
            value={loaderFilter}
            onChange={setLoaderFilter}
            placeholder="Todos los loaders"
            options={source === 'cf' ? LOADER_OPTIONS_CF : LOADER_OPTIONS_MR}
          />

          {/* CF Categories */}
          {source === 'cf' && categories.length > 0 && (
            <FilterSelect
              icon={BookOpen}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Todas las categorías"
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
          )}

          {/* Sort */}
          <FilterSelect
            icon={ArrowUpDown}
            value={source === 'cf' ? cfSortOption : mrSortOption}
            onChange={source === 'cf' ? setCfSortOption : setMrSortOption}
            options={source === 'cf' ? CF_SORT_OPTIONS : MR_SORT_OPTIONS}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 mb-5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className={`animate-spin ${source === 'cf' ? 'text-orange-400' : 'text-green-400'}`} />
          </div>
        )}

        {/* Empty state */}
        {!loading && (source === 'cf' ? cfModpacks : mrModpacks).length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4" role="status">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-800/60 border border-gray-700/60">
              <PackageSearch size={28} className="text-gray-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-gray-400 mb-1">Sin resultados</p>
              <p className="text-xs text-gray-600">Prueba con otros filtros o un término diferente.</p>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && (source === 'cf' ? cfModpacks : mrModpacks).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(source === 'cf' ? cfModpacks : mrModpacks).map((mod: any) => (
              <ModpackCard
                key={source === 'cf' ? mod.id : mod.project_id}
                mod={mod}
                source={source}
                onClick={() => navigate(source === 'cf' ? `/catalog/${mod.id}` : `/catalog/mr/${mod.project_id}`)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (source === 'cf' ? cfModpacks : mrModpacks).length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => source === 'cf' ? fetchCf(page - 1) : fetchMr(page - 1)}
              disabled={page === 0}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${page === 0
                ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500 border border-gray-700'
                : source === 'cf'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-900/20 hover:scale-[1.02] active:scale-95'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-md shadow-green-900/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              ← Anterior
            </button>
            <span className="text-sm tabular-nums px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/60 text-gray-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => source === 'cf' ? fetchCf(page + 1) : fetchMr(page + 1)}
              disabled={page >= totalPages - 1}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${page >= totalPages - 1
                ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500 border border-gray-700'
                : source === 'cf'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-900/20 hover:scale-[1.02] active:scale-95'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-md shadow-green-900/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              Siguiente →
            </button>
          </div>
        )}

      </div>

      {/* MR Detail Panel */}
    </div>
  )
}

// ── ModpackCard ───────────────────────────────────────────────────────────────

function ModpackCard({ mod, source, onClick }: { mod: any; source: 'cf' | 'mr'; onClick: () => void }) {
  const isCf = source === 'cf'
  const name = isCf ? mod.name : mod.title
  const summary = isCf ? mod.summary : mod.description
  const imageUrl = isCf ? mod.logo?.url : mod.icon_url
  const downloads = isCf ? mod.downloadCount : (mod.downloads ?? 0)
  const dateStr = isCf ? mod.dateModified : mod.date_modified

  const loaders = isCf
    ? [...new Set((mod.latestFilesIndexes ?? []).map((f: any) => f.modLoader).filter(Boolean) as number[])]
        .filter(l => CF_LOADER_NAMES[l])
        .map(l => ({ key: String(l), label: CF_LOADER_NAMES[l], color: CF_LOADER_COLORS[l] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25' }))
    : ((mod.display_categories ?? mod.categories ?? []).filter((c: string) => KNOWN_LOADERS.has(c)) as string[])
        .map(l => ({ key: l, label: l.charAt(0).toUpperCase() + l.slice(1), color: MR_LOADER_COLORS[l] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25' }))

  const mcVersions = isCf
    ? [...new Set((mod.latestFilesIndexes ?? []).map((f: any) => f.gameVersion).filter((v: string) => v && /^\d+\.\d+/.test(v)) as string[])]
    : (mod.versions ?? []).filter((v: string) => /^\d+\.\d+/.test(v)).slice(0, 3) as string[]

  const cardClass = isCf
    ? 'via-orange-950/5 border-orange-500/25 hover:border-orange-400/50'
    : 'via-green-950/10 border-green-500/25 hover:border-green-400/50'
  const fallbackBg = isCf
    ? 'from-orange-900/70 via-amber-900/40 to-yellow-900/60'
    : 'from-green-900/70 via-emerald-900/40 to-teal-900/60'

  return (
    <article
      className={`rounded-2xl border cursor-pointer transition-all overflow-hidden flex flex-col shadow-md hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-br from-gray-800/90 ${cardClass} to-gray-900`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle de ${name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <div className="aspect-video relative overflow-hidden flex-shrink-0 rounded-t-2xl">
        {imageUrl ? (
          <img src={imageUrl} alt={`Logo de ${name}`} className="w-full h-full object-cover" loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${fallbackBg}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
      </div>
      <div className="px-3.5 pb-3.5 pt-3 flex flex-col flex-1 gap-2">
        <h3 className="font-bold text-sm leading-tight line-clamp-1 text-white">{name}</h3>
        {summary && <p className="text-xs line-clamp-2 flex-1 leading-relaxed text-gray-500">{summary}</p>}
        {loaders.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {loaders.map(l => (
              <span key={l.key} className={`px-1.5 py-0.5 rounded-full text-xs border ${l.color}`}>{l.label}</span>
            ))}
          </div>
        )}
        {mcVersions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mcVersions.slice(0, 3).map(v => (
              <span key={v} className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-gray-700/50 text-gray-400 border-gray-600/50">{v}</span>
            ))}
            {mcVersions.length > 3 && <span className="px-1.5 py-0.5 text-xs text-gray-600">+{mcVersions.length - 3}</span>}
          </div>
        )}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-700/50 text-gray-500">
          <span className="flex items-center gap-1"><Download size={10} />{formatDownloads(downloads)}</span>
          {dateStr && <span>{new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </div>
      </div>
    </article>
  )
}

