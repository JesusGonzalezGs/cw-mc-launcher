import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, Loader2 } from 'lucide-react'
import { LOADER_TYPE_MAP } from '../constants'
import type { CfMod, McVersion } from '../types'

const PAGE_SIZE = 20

export default function CatalogPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [mcFilter, setMcFilter] = useState('')
  const [loaderFilter, setLoaderFilter] = useState('')
  const [modpacks, setModpacks] = useState<CfMod[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [mcVersions, setMcVersions] = useState<string[]>([])

  // Cargar versiones de Minecraft (solo releases) al montar
  useEffect(() => {
    window.launcher.mc.getVersionManifest()
      .then((manifest: any) => {
        const releases = (manifest?.versions ?? [] as McVersion[])
          .filter((v: McVersion) => v.type === 'release')
          .map((v: McVersion) => v.id)
        setMcVersions(releases)
      })
      .catch(() => {/* silencioso — el filtro simplemente queda vacío */})
  }, [])

  const fetchModpacks = useCallback(async (reset = false) => {
    setLoading(true)
    setError('')
    const currentPage = reset ? 0 : page
    try {
      const params: any = {
        searchFilter: query || undefined,
        gameVersion: mcFilter || undefined,
        modLoaderType: loaderFilter ? LOADER_TYPE_MAP[loaderFilter] : undefined,
        pageSize: PAGE_SIZE,
        index: currentPage * PAGE_SIZE,
      }
      const resp = await window.launcher.cf.searchModpacks(params)
      const data: CfMod[] = resp?.data ?? []
      if (reset) {
        setModpacks(data)
        setPage(1)
      } else {
        setModpacks((prev) => [...prev, ...data])
        setPage((p) => p + 1)
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch (e: any) {
      setError(e.message ?? 'Error al buscar modpacks')
    } finally {
      setLoading(false)
    }
  }, [query, mcFilter, loaderFilter, page])

  useEffect(() => {
    fetchModpacks(true)
  }, [query, mcFilter, loaderFilter])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-4">Catálogo de modpacks</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar modpack..."
              aria-label="Buscar modpack"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <select
            value={mcFilter}
            onChange={(e) => setMcFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="">Todas las versiones</option>
            {mcVersions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            value={loaderFilter}
            onChange={(e) => setLoaderFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="">Todos los loaders</option>
            <option value="Forge">Forge</option>
            <option value="Fabric">Fabric</option>
            <option value="NeoForge">NeoForge</option>
            <option value="Quilt">Quilt</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {modpacks.map((mod) => (
          <button
            key={mod.id}
            onClick={() => navigate(`/catalog/${mod.id}`)}
            className="bg-gray-800 border border-gray-700 hover:border-purple-500/40 rounded-2xl overflow-hidden text-left transition-all group"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/catalog/${mod.id}`) }}
          >
            <div className="aspect-square bg-gray-700 overflow-hidden">
              {mod.logo?.url ? (
                <img
                  src={mod.logo.url}
                  alt={mod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-pink-900/30">
                  <Package size={32} className="text-gray-600" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-white text-sm font-medium truncate">{mod.name}</p>
              <p className="text-gray-500 text-xs truncate mt-0.5 line-clamp-2">{mod.summary}</p>
              <div className="flex items-center gap-1 mt-2">
                <Download size={11} className="text-gray-600" />
                <span className="text-gray-600 text-xs">{(mod.downloadCount / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Load more */}
      {!loading && hasMore && modpacks.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchModpacks(false)}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors"
          >
            Cargar más
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="text-purple-400 animate-spin" />
        </div>
      )}
    </div>
  )
}

function Package({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>
    </svg>
  )
}
