export const LOADER_NAMES: Record<string, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
}

export const LOADER_COLORS: Record<string, string> = {
  vanilla: 'text-green-400',
  fabric: 'text-yellow-400',
  quilt: 'text-purple-400',
  forge: 'text-orange-400',
  neoforge: 'text-red-400',
}

export const LOADER_TYPE_MAP: Record<string, number> = {
  Forge: 1,
  Fabric: 4,
  Quilt: 5,
  NeoForge: 6,
}

// ── CurseForge loader maps ────────────────────────────────────────────────────

/** CF API loader id → display name */
export const CF_LOADER_ID_TO_NAME: Record<number, string> = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' }

// ── Catalog badge colors ──────────────────────────────────────────────────────
// Used for loader tags in ModCatalogModal, FileCatalogModal, CatalogPage, ModpackDetailPage

/** Loader name (capitalized) → badge color classes */
export const CF_LOADER_BADGE_COLORS: Record<string, string> = {
  Forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  Fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  Quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  NeoForge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

/** CF loader id → badge color classes */
export const CF_LOADER_ID_BADGE_COLORS: Record<number, string> = Object.fromEntries(
  Object.entries(CF_LOADER_ID_TO_NAME).map(([id, name]) => [Number(id), CF_LOADER_BADGE_COLORS[name]])
)

/** MR loader name (lowercase) → badge color classes */
export const MR_LOADER_BADGE_COLORS: Record<string, string> = {
  forge:    'bg-orange-500/15 text-orange-300 border-orange-500/25',
  fabric:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
  quilt:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  neoforge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
}

export const DEFAULT_LOADER_BADGE_COLOR = 'bg-gray-500/15 text-gray-300 border-gray-500/25'

// ── Catalog utils ─────────────────────────────────────────────────────────────

export function formatDownloads(n: number): string {
  if (!n) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toString()
}

export function formatDate(isoDate: string): string | null {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
