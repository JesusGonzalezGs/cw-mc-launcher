/**
 * Capa de acceso a la API pública de Modrinth.
 * Solo fetch + transformación de datos. Sin lógica de instalación ni acceso a disco.
 */

const MR_BASE = 'https://api.modrinth.com/v2'
const MR_HEADERS = {
  'User-Agent': 'cw-mc-launcher/0.1.0 (github.com/cw-mc-launcher)',
  'Accept': 'application/json',
}

async function mrFetch(endpoint: string, retries = 2): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${MR_BASE}${endpoint}`, { headers: MR_HEADERS, signal: controller.signal })
    if (res.status === 429 && retries > 0) {
      await new Promise(r => setTimeout(r, 3_000))
      return mrFetch(endpoint, retries - 1)
    }
    if (!res.ok) throw new Error(`Modrinth ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return res.json()
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('La búsqueda en Modrinth tardó demasiado. Inténtalo de nuevo.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function mrSearch(params: {
  query?: string
  projectType?: string
  gameVersions?: string[]
  loaders?: string[]
  sortBy?: string
  limit?: number
  offset?: number
}): Promise<any> {
  const { query, projectType = 'mod', gameVersions, loaders, sortBy = 'relevance', limit = 20, offset = 0 } = params
  const facets: string[][] = [[`project_type:${projectType}`]]
  if (gameVersions?.length) facets.push(gameVersions.map(v => `versions:${v}`))
  if (loaders?.length) facets.push(loaders.map(l => `categories:${l}`))

  const p = new URLSearchParams()
  if (query) p.set('query', query)
  p.set('limit', String(limit))
  p.set('offset', String(offset))
  p.set('index', sortBy)
  p.set('facets', JSON.stringify(facets))

  return mrFetch(`/search?${p}`)
}

export async function mrGetProject(id: string): Promise<any> {
  return mrFetch(`/project/${id}`)
}

export async function mrGetProjectVersions(id: string, gameVersions?: string[], loaders?: string[]): Promise<any[]> {
  const p = new URLSearchParams()
  if (gameVersions?.length) p.set('game_versions', JSON.stringify(gameVersions))
  if (loaders?.length) p.set('loaders', JSON.stringify(loaders))
  const qs = p.toString() ? `?${p}` : ''
  return mrFetch(`/project/${id}/version${qs}`)
}

export async function mrGetVersion(id: string): Promise<any> {
  return mrFetch(`/version/${id}`)
}
