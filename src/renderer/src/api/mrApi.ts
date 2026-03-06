/**
 * Cliente de la API de Modrinth ejecutado en el renderer process.
 * Al correr en Chromium usa el mismo stack de red que el navegador —
 * sin pasar por IPC ni por Node.js, por lo que es igual de rápido que
 * hacer la petición desde el propio browser.
 */

const BASE = 'https://api.modrinth.com/v2'
const HEADERS = {
  'User-Agent': 'cw-mc-launcher/0.1.0 (github.com/cw-mc-launcher)',
}

async function get(endpoint: string, retries = 2): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${BASE}${endpoint}`, { headers: HEADERS, signal: controller.signal })
    if (res.status === 429 && retries > 0) {
      const wait = Math.min(Number(res.headers.get('X-Ratelimit-Reset') ?? 2) * 1000, 5_000)
      await new Promise(r => setTimeout(r, wait))
      return get(endpoint, retries - 1)
    }
    if (!res.ok) throw new Error(`Modrinth ${res.status}: ${await res.text()}`)
    return res.json()
  } catch (e: any) {
    if (retries > 0) return get(endpoint, retries - 1)
    if (e.name === 'AbortError') throw new Error('La búsqueda en Modrinth tardó demasiado. Inténtalo de nuevo.')
    throw e
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
  const {
    query, projectType = 'mod', gameVersions, loaders,
    sortBy = 'relevance', limit = 20, offset = 0,
  } = params

  const facets: string[][] = [[`project_type:${projectType}`]]
  if (gameVersions?.length) facets.push(gameVersions.map(v => `versions:${v}`))
  if (loaders?.length)      facets.push(loaders.map(l => `categories:${l}`))

  const p = new URLSearchParams()
  if (query) p.set('query', query)
  p.set('limit', String(limit))
  p.set('offset', String(offset))
  p.set('index', sortBy)
  p.set('facets', JSON.stringify(facets))

  return get(`/search?${p}`)
}

export function mrGetProject(id: string): Promise<any> {
  return get(`/project/${id}`)
}

export function mrGetProjectVersions(
  id: string,
  gameVersions?: string[],
  loaders?: string[],
): Promise<any[]> {
  const p = new URLSearchParams()
  if (gameVersions?.length) p.set('game_versions', JSON.stringify(gameVersions))
  if (loaders?.length)      p.set('loaders', JSON.stringify(loaders))
  const qs = p.toString() ? `?${p}` : ''
  return get(`/project/${id}/version${qs}`)
}

export function mrGetVersion(id: string): Promise<any> {
  return get(`/version/${id}`)
}
