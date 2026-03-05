import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, Loader2, PackageSearch, Tag, Layers, LayoutGrid, ArrowUpDown, BookOpen } from 'lucide-react'
import { LOADER_TYPE_MAP } from '../constants'
import FilterSelect from '../components/common/FilterSelect'
import type { CfMod } from '../types'

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: '6:desc', label: 'Más descargados' },
  { value: '2:desc', label: 'Popularidad' },
  { value: '3:desc', label: 'Más recientes' },
  { value: '4:asc',  label: 'Nombre A–Z' },
]

const LOADER_OPTIONS = [
  { value: '',         label: 'Todos los loaders' },
  { value: 'Forge',    label: 'Forge' },
  { value: 'Fabric',   label: 'Fabric' },
  { value: 'NeoForge', label: 'NeoForge' },
  { value: 'Quilt',    label: 'Quilt' },
]

const LOADER_NAMES: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }
const LOADER_COLORS: Record<number, string> = {
  1: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  4: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  5: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const navigate = useNavigate()

  // Filter state
  const [inputQuery, setInputQuery] = useState('')
  const [query, setQuery] = useState('')
  const [mcFilter, setMcFilter] = useState('')
  const [loaderFilter, setLoaderFilter] = useState('')
  const [sortOption, setSortOption] = useState('6:desc')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [mcVersions, setMcVersions] = useState<string[]>([])

  // Results state
  const [modpacks, setModpacks] = useState<CfMod[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)   // 0-based for API index
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQuery(inputQuery), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [inputQuery])

  // Load MC release versions on mount
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

  // Load categories on mount
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
      .catch(() => { /* silencioso */ })
  }, [])

  const sortParts = sortOption.split(':') as [string, 'asc' | 'desc']
  const sortField = sortParts[0]
  const sortOrder = sortParts[1]

  const fetchPage = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError('')
    try {
      const params: any = {
        searchFilter: query || undefined,
        gameVersion: mcFilter || undefined,
        modLoaderType: loaderFilter ? LOADER_TYPE_MAP[loaderFilter] : undefined,
        sortField: Number(sortField),
        sortOrder,
        categoryId: categoryId ? Number(categoryId) : undefined,
        pageSize: PAGE_SIZE,
        index: targetPage * PAGE_SIZE,
      }
      const resp = await window.launcher.cf.searchModpacks(params)
      setModpacks(resp?.data ?? [])
      setTotalCount(resp?.pagination?.totalCount ?? 0)
      setPage(targetPage)
    } catch (e: any) {
      setError(e.message ?? 'Error al buscar modpacks')
    } finally {
      setLoading(false)
    }
  }, [query, mcFilter, loaderFilter, sortField, sortOrder, categoryId])

  // Reset to page 0 when filters change
  useEffect(() => {
    fetchPage(0)
  }, [query, mcFilter, loaderFilter, sortOption, categoryId])

  const totalPages = Math.max(1, Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE))
  const hasFilters = !!inputQuery || !!mcFilter || !!loaderFilter || !!categoryId

  function clearFilters() {
    setInputQuery('')
    setQuery('')
    setMcFilter('')
    setLoaderFilter('')
    setCategoryId('')
    setSortOption('6:desc')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 bg-purple-600" />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-pink-600" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* Header */}
        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 bg-purple-500/10 border-purple-500/25 text-purple-300">
            <BookOpen size={11} />
            CurseForge
          </div>
          <h1 className="text-3xl pb-4 sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Catálogo de Modpacks
          </h1>
          {!loading && totalCount > 0 && (
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-300">{totalCount.toLocaleString()}</span> modpacks encontrados
            </p>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 mb-6 p-3 rounded-2xl border bg-gray-800/40 border-gray-700/50">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Buscar modpack..."
              aria-label="Buscar modpack"
              className="w-full bg-gray-800/80 border border-gray-700/80 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:ring-offset-0 transition-all"
            />
          </div>

          {/* Version */}
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
            options={LOADER_OPTIONS}
          />

          {/* Category */}
          {categories.length > 0 && (
            <FilterSelect
              icon={LayoutGrid}
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
            value={sortOption}
            onChange={setSortOption}
            options={SORT_OPTIONS}
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
            <Loader2 size={28} className="text-purple-400 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && modpacks.length === 0 && !error && (
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
        {!loading && modpacks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modpacks.map((mod) => (
              <ModpackCard
                key={mod.id}
                mod={mod}
                onClick={() => navigate(`/catalog/${mod.id}`)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && modpacks.length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => fetchPage(page - 1)}
              disabled={page === 0}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${page === 0
                ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500 border border-gray-700'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              ← Anterior
            </button>
            <span className="text-sm tabular-nums px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/60 text-gray-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={page >= totalPages - 1}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${page >= totalPages - 1
                ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500 border border-gray-700'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              Siguiente →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── ModpackCard ───────────────────────────────────────────────────────────────

function ModpackCard({ mod, onClick }: { mod: CfMod; onClick: () => void }) {
  const loaderNums = [...new Set(
    (mod.latestFilesIndexes ?? []).map((f) => f.modLoader).filter((l): l is number => !!l)
  )]
  const mcVersions = [...new Set(
    (mod.latestFilesIndexes ?? []).map((f) => f.gameVersion).filter((v) => !!v && /^\d+\.\d+/.test(v))
  )]

  return (
    <article
      className="rounded-2xl border cursor-pointer transition-all overflow-hidden flex flex-col shadow-md hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25 hover:border-purple-400/50"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle de ${mod.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden flex-shrink-0 rounded-t-2xl">
        {mod.logo?.url ? (
          <img
            src={mod.logo.url}
            alt={`Logo de ${mod.name}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5 pt-3 flex flex-col flex-1 gap-2">
        <h3 className="font-bold text-sm leading-tight line-clamp-1 text-white">
          {mod.name}
        </h3>

        {mod.summary && (
          <p className="text-xs line-clamp-2 flex-1 leading-relaxed text-gray-500">
            {mod.summary}
          </p>
        )}

        {/* Loaders */}
        {loaderNums.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {loaderNums.map((l) => LOADER_NAMES[l] && (
              <span key={l} className={`px-1.5 py-0.5 rounded-full text-xs border ${LOADER_COLORS[l] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
                {LOADER_NAMES[l]}
              </span>
            ))}
          </div>
        )}

        {/* Versions */}
        {mcVersions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mcVersions.slice(0, 3).map((v) => (
              <span key={v} className="px-1.5 py-0.5 rounded-lg text-xs border font-mono bg-gray-700/50 text-gray-400 border-gray-600/50">
                {v}
              </span>
            ))}
            {mcVersions.length > 3 && (
              <span className="px-1.5 py-0.5 text-xs text-gray-600">+{mcVersions.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-700/50 text-gray-500">
          <span className="flex items-center gap-1">
            <Download size={10} />
            {formatDownloads(mod.downloadCount)}
          </span>
          {mod.dateModified && (
            <span>{new Date(mod.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          )}
        </div>
      </div>
    </article>
  )
}

