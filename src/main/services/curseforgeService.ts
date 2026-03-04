/**
 * Servicio de CurseForge API para el launcher.
 * Port de backend/utils/curseforge.js + backend/routes/curseforge.js
 */
import { getSettings } from '../store'

export const CF_BASE = 'https://api.curseforge.com/v1'

export const LOADER_TYPE: Record<string, number> = {
  Forge: 1,
  Fabric: 4,
  Quilt: 5,
  NeoForge: 6,
}

function cfHeaders(): Record<string, string> {
  const token = getSettings().cfApiToken
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-api-key': token,
  }
}

// MurmurHash2 32-bit (seed=1) — fingerprint de CurseForge
function murmur2_32(buf: Buffer, seed: number): number {
  const M = 0x5bd1e995
  let h = (seed ^ buf.length) >>> 0
  let i = 0
  while (i + 4 <= buf.length) {
    let k = ((buf[i + 3] << 24) | (buf[i + 2] << 16) | (buf[i + 1] << 8) | buf[i]) >>> 0
    k = Math.imul(k, M) >>> 0; k ^= k >>> 24; k = Math.imul(k, M) >>> 0
    h = Math.imul(h, M) >>> 0; h = (h ^ k) >>> 0
    i += 4
  }
  switch (buf.length - i) {
    case 3: h = (h ^ (buf[i + 2] << 16)) >>> 0
    // falls through
    case 2: h = (h ^ (buf[i + 1] << 8)) >>> 0
    // falls through
    case 1: h = (h ^ buf[i]) >>> 0; h = Math.imul(h, M) >>> 0
  }
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, M) >>> 0; h = (h ^ (h >>> 15)) >>> 0
  return h >>> 0
}

export function cfFingerprint(fileBuffer: Buffer): number {
  let count = 0
  for (let i = 0; i < fileBuffer.length; i++) {
    const b = fileBuffer[i]
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) count++
  }
  const filtered = Buffer.allocUnsafe(count)
  let j = 0
  for (let i = 0; i < fileBuffer.length; i++) {
    const b = fileBuffer[i]
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) filtered[j++] = b
  }
  return murmur2_32(filtered, 1)
}

export interface CfSearchParams {
  classId?: number      // 4471=modpacks, 6=mods
  searchFilter?: string
  gameVersion?: string
  modLoaderType?: number
  sortField?: number    // 2=Popularity, 3=LastUpdated, 4=Name, 6=TotalDownloads
  sortOrder?: 'asc' | 'desc'
  categoryId?: number
  pageSize?: number
  index?: number
}

export async function cfSearch(params: CfSearchParams) {
  const p = new URLSearchParams({ gameId: '432' })
  if (params.classId) p.set('classId', String(params.classId))
  if (params.searchFilter) p.set('searchFilter', params.searchFilter)
  if (params.gameVersion) p.set('gameVersion', params.gameVersion)
  if (params.modLoaderType) p.set('modLoaderType', String(params.modLoaderType))
  if (params.sortField) p.set('sortField', String(params.sortField))
  if (params.sortOrder) p.set('sortOrder', params.sortOrder)
  if (params.categoryId) p.set('categoryId', String(params.categoryId))
  if (params.pageSize) p.set('pageSize', String(params.pageSize))
  if (params.index !== undefined) p.set('index', String(params.index))

  const resp = await fetch(`${CF_BASE}/mods/search?${p}`, { headers: cfHeaders() })
  if (!resp.ok) throw new Error(`CurseForge search error: ${resp.status}`)
  return resp.json()
}

export async function cfGetCategories(classId = 4471) {
  const p = new URLSearchParams({ gameId: '432', classId: String(classId) })
  const resp = await fetch(`${CF_BASE}/categories?${p}`, { headers: cfHeaders() })
  if (!resp.ok) throw new Error(`CurseForge categories error: ${resp.status}`)
  return resp.json()
}

export async function cfGetMod(modId: number) {
  const resp = await fetch(`${CF_BASE}/mods/${modId}`, { headers: cfHeaders() })
  if (!resp.ok) throw new Error(`CurseForge getMod error: ${resp.status}`)
  return resp.json()
}

export async function cfGetModsBatch(modIds: number[]): Promise<Record<number, any>> {
  const CHUNK = 100
  const result: Record<number, any> = {}
  for (let i = 0; i < modIds.length; i += CHUNK) {
    const chunk = modIds.slice(i, i + CHUNK)
    try {
      const resp = await fetch(`${CF_BASE}/mods`, {
        method: 'POST',
        headers: cfHeaders(),
        body: JSON.stringify({ modIds: chunk }),
      })
      if (!resp.ok) continue
      const json: any = await resp.json()
      for (const mod of (json.data ?? [])) result[mod.id] = mod
    } catch { /* continuar con el siguiente chunk */ }
  }
  return result
}

export async function cfGetModDescription(modId: number): Promise<string> {
  const resp = await fetch(`${CF_BASE}/mods/${modId}/description`, { headers: cfHeaders() })
  if (!resp.ok) return ''
  const data = (await resp.json()) as any
  return data?.data ?? ''
}

export async function cfGetModFiles(modId: number, gameVersion?: string, modLoaderType?: number) {
  const PAGE_SIZE = 50
  const allFiles: any[] = []
  let index = 0

  while (true) {
    const p = new URLSearchParams({ pageSize: String(PAGE_SIZE), index: String(index) })
    if (gameVersion) p.set('gameVersion', gameVersion)
    if (modLoaderType) p.set('modLoaderType', String(modLoaderType))

    const resp = await fetch(`${CF_BASE}/mods/${modId}/files?${p}`, { headers: cfHeaders() })
    if (!resp.ok) throw new Error(`CurseForge getFiles error: ${resp.status}`)
    const json: any = await resp.json()

    const batch: any[] = json.data ?? []
    allFiles.push(...batch)

    const pagination = json.pagination
    const totalCount: number = pagination?.totalCount ?? 0
    index += batch.length

    if (index >= totalCount || batch.length === 0) break
  }

  return { data: allFiles }
}

export async function cfGetDownloadUrl(modId: number, fileId: number): Promise<string> {
  const resp = await fetch(`${CF_BASE}/mods/${modId}/files/${fileId}/download-url`, {
    headers: cfHeaders(),
  })

  if (resp.ok) {
    const data = (await resp.json()) as any
    if (data?.data) return data.data
  }

  // Fallback para archivos con distribución restringida (403): construir URL del CDN
  // o usar downloadUrl del detalle del archivo
  const detailResp = await fetch(`${CF_BASE}/mods/${modId}/files/${fileId}`, { headers: cfHeaders() })
  if (!detailResp.ok) throw new Error(`CurseForge downloadUrl error: ${resp.status}`)
  const detail = (await detailResp.json()) as any
  const file = detail?.data
  if (file?.downloadUrl) return file.downloadUrl
  if (file?.fileName) {
    return `https://mediafilez.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${encodeURIComponent(file.fileName)}`
  }
  throw new Error(`CurseForge downloadUrl error: ${resp.status}`)
}

export async function cfGetFileDetails(modId: number, fileId: number) {
  const resp = await fetch(`${CF_BASE}/mods/${modId}/files/${fileId}`, { headers: cfHeaders() })
  if (!resp.ok) throw new Error(`CurseForge fileDetails error: ${resp.status}`)
  return resp.json()
}

export async function cfGetFileChangelog(modId: number, fileId: number): Promise<string> {
  const resp = await fetch(`${CF_BASE}/mods/${modId}/files/${fileId}/changelog`, { headers: cfHeaders() })
  if (!resp.ok) return ''
  const data = (await resp.json()) as any
  return data?.data ?? ''
}

export async function cfGetFingerprintMatches(fingerprints: number[]) {
  const resp = await fetch(`${CF_BASE}/fingerprints`, {
    method: 'POST',
    headers: cfHeaders(),
    body: JSON.stringify({ fingerprints }),
  })
  if (!resp.ok) throw new Error(`CurseForge fingerprints error: ${resp.status}`)
  return resp.json()
}
