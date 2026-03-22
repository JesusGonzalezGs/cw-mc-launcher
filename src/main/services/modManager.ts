/**
 * Gestión de metadatos de mods y resolución de dependencias.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getInstanceDir, getModsDir } from './instanceManager'
import { cfGetFileDetails, cfGetModFiles, cfGetMod, cfGetDownloadUrl, cfFingerprint, cfGetFingerprintMatches } from './curseforgeService'
import { downloadFile } from '../utils/downloadHelper'

const MR_HEADERS = { 'User-Agent': 'cw-mc-launcher/0.1.0', 'Accept': 'application/json', 'Content-Type': 'application/json' }

export interface ModMeta {
  modId: number
  fileId: number
  name: string
  slug: string
  mrSlug?: string
  mrVersionId?: string
  mrResolved?: boolean
  logo?: string
  summary?: string
  gameVersions: string[]
  recognized?: boolean
  deps?: number[]
}

export interface ModsJson {
  mods: Record<string, ModMeta>
}

export interface InstallResult {
  filename: string
  depsInstalled: { filename: string; name: string }[]
  depsFailed: { modId: number; error: string }[]
}

const LOADER_TYPE_MAP: Record<string, number> = {
  forge: 1, fabric: 4, quilt: 5, neoforge: 6,
}

export function getModsJsonPath(instanceId: string): string {
  return path.join(getInstanceDir(instanceId), 'mods.json')
}

export function readModsJson(instanceId: string): ModsJson {
  const p = getModsJsonPath(instanceId)
  if (!fs.existsSync(p)) return { mods: {} }
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return { mods: {} } }
}

export function writeModsJson(instanceId: string, data: ModsJson): void {
  fs.writeFileSync(getModsJsonPath(instanceId), JSON.stringify(data, null, 2))
}

export function removeModMeta(instanceId: string, filename: string): void {
  const modsJson = readModsJson(instanceId)
  const clean = filename.replace('.jar.disabled', '.jar')
  delete modsJson.mods[filename]
  delete modsJson.mods[clean]
  writeModsJson(instanceId, modsJson)
}

async function installSingle(
  instanceId: string,
  modId: number,
  fileId: number,
  modsJson: ModsJson,
  onProgress?: (msg: string) => void
): Promise<{ filename: string; name: string }> {
  const modsDir = getModsDir(instanceId)
  fs.mkdirSync(modsDir, { recursive: true })

  // Remove previously installed version of the same mod
  for (const [existingFilename, meta] of Object.entries(modsJson.mods)) {
    if (meta.modId !== modId) continue
    const cleanName = existingFilename.replace('.jar.disabled', '.jar')
    for (const f of [cleanName, cleanName.replace('.jar', '.jar.disabled')]) {
      try { fs.rmSync(path.join(modsDir, f), { force: true }) } catch {}
    }
    delete modsJson.mods[cleanName]
    delete modsJson.mods[cleanName.replace('.jar', '.jar.disabled')]
  }

  const url = await cfGetDownloadUrl(modId, fileId)
  if (!url) throw new Error('URL de descarga vacía')

  const filename = decodeURIComponent(url.split('/').pop() ?? `mod-${fileId}.jar`)
  const destPath = path.join(modsDir, filename)

  onProgress?.(`Descargando ${filename}...`)
  await downloadFile(url, destPath)

  // Pre-write minimal metadata immediately so the file watcher doesn't trigger identifyMods
  modsJson.mods[filename] = { modId, fileId, name: filename.replace(/\.jar$/, ''), slug: '', gameVersions: [], recognized: true }
  writeModsJson(instanceId, modsJson)

  // Enrich metadata with full info from API (best-effort)
  let name = filename.replace(/\.jar$/, '')
  let gameVersions: string[] = []
  try {
    const [modData, fileData] = await Promise.all([
      cfGetMod(modId) as Promise<any>,
      cfGetFileDetails(modId, fileId) as Promise<any>,
    ])
    const mod = modData?.data
    const file = fileData?.data
    gameVersions = file?.gameVersions ?? []
    if (mod) {
      name = mod.name ?? name
      const deps = (file?.dependencies ?? [])
        .filter((d: any) => d.relationType === 3)
        .map((d: any) => d.modId as number)
      modsJson.mods[filename] = {
        modId, fileId,
        name,
        slug: mod.slug ?? '',
        logo: mod.logo?.thumbnailUrl,
        summary: mod.summary,
        gameVersions,
        deps,
        recognized: true,
      }
    }
  } catch { /* metadata optional */ }

  return { filename, name }
}

export async function installModWithDeps(
  instanceId: string,
  modId: number,
  fileId: number,
  mcVersion: string,
  modLoader: string,
  onProgress?: (msg: string) => void
): Promise<InstallResult> {
  const modsJson = readModsJson(instanceId)
  const loaderType = LOADER_TYPE_MAP[modLoader.toLowerCase()] ?? 0

  const { filename } = await installSingle(instanceId, modId, fileId, modsJson, onProgress)

  // Dependency resolution — deps are stored by installSingle from the file metadata
  const requiredDepIds: number[] = modsJson.mods[filename]?.deps ?? []

  const depsInstalled: { filename: string; name: string }[] = []
  const depsFailed: { modId: number; error: string }[] = []

  for (const depModId of requiredDepIds) {
    if (Object.values(modsJson.mods).some((m) => m.modId === depModId)) continue

    try {
      onProgress?.(`Buscando dependencia #${depModId}...`)
      const filesData = (await cfGetModFiles(depModId, mcVersion, loaderType || undefined)) as any
      const files: any[] = filesData?.data ?? []
      if (files.length === 0) {
        depsFailed.push({ modId: depModId, error: 'Sin versiones compatibles' })
        continue
      }
      // installSingle also stores deps for the dependency mod itself
      const depResult = await installSingle(instanceId, depModId, files[0].id, modsJson, onProgress)
      depsInstalled.push(depResult)
    } catch (err: any) {
      depsFailed.push({ modId: depModId, error: err.message ?? 'Error desconocido' })
    }
  }

  writeModsJson(instanceId, modsJson)
  return { filename, depsInstalled, depsFailed }
}

export async function identifyMods(
  instanceId: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const modsDir = getModsDir(instanceId)
  if (!fs.existsSync(modsDir)) return

  const allFiles = fs.readdirSync(modsDir)
    .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
  if (allFiles.length === 0) return

  const modsJson = readModsJson(instanceId)
  const { getInstance } = await import('./instanceManager')
  const instance = getInstance(instanceId)
  const isModrinth = instance?.source === 'modrinth' || instance?.modSource === 'mr'

  // Collect files that need identification
  const toIdentify: { filename: string; cleanName: string }[] = []
  for (const filename of allFiles) {
    const cleanName = filename.replace('.jar.disabled', '.jar')
    const existing = modsJson.mods[cleanName] ?? modsJson.mods[filename]
    // Skip if already identified: CF mods have fileId > 0, MR mods have mrVersionId
    if (existing?.recognized === true && ((existing.fileId ?? 0) > 0 || existing.mrVersionId)) continue
    // Skip MR mods that were resolved (even if recognized failed)
    if (existing?.mrResolved) continue
    // Skip mods that failed identification — don't hammer the API
    if (existing?.recognized === false) continue
    toIdentify.push({ filename, cleanName })
  }

  if (toIdentify.length === 0) return
  onProgress?.(`Identificando ${toIdentify.length} mod${toIdentify.length > 1 ? 's' : ''}...`)

  if (isModrinth) {
    // ── Modrinth: hash-based lookup via POST /version_files ─────────────────
    const withHash: { filename: string; cleanName: string; sha1: string }[] = []
    for (const { filename, cleanName } of toIdentify) {
      try {
        const buf = fs.readFileSync(path.join(modsDir, filename))
        const sha1 = crypto.createHash('sha1').update(buf).digest('hex')
        withHash.push({ filename, cleanName, sha1 })
      } catch { /* skip unreadable */ }
    }

    if (withHash.length === 0) { writeModsJson(instanceId, modsJson); return }

    let matched: Record<string, any> = {}
    try {
      const res = await fetch('https://api.modrinth.com/v2/version_files', {
        method: 'POST',
        headers: MR_HEADERS,
        body: JSON.stringify({ hashes: withHash.map(f => f.sha1), algorithm: 'sha1' }),
      })
      if (res.ok) matched = await res.json()
    } catch { /* leave all unmatched */ }

    // Batch-fetch project info for all matched versions
    const projectIds = [...new Set(Object.values(matched).map((v: any) => v.project_id as string))]
    const projects: Record<string, any> = {}
    if (projectIds.length > 0) {
      try {
        const res = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(projectIds))}`, { headers: MR_HEADERS })
        if (res.ok) {
          const list = (await res.json()) as any[]
          for (const p of list) projects[p.id] = p
        }
      } catch { /* use version data as fallback */ }
    }

    const matchedHashes = new Set<string>()
    for (const { filename, cleanName, sha1 } of withHash) {
      const version = matched[sha1]
      if (!version) continue
      matchedHashes.add(sha1)
      const project = projects[version.project_id]
      modsJson.mods[cleanName] = {
        ...(modsJson.mods[cleanName] ?? {}),
        modId: 0, fileId: 0,
        name: project?.title ?? cleanName.replace('.jar', ''),
        slug: '',
        mrSlug: project?.slug ?? modsJson.mods[cleanName]?.mrSlug ?? '',
        mrVersionId: version.id,
        logo: project?.icon_url,
        summary: project?.description,
        gameVersions: version.game_versions ?? [],
        mrResolved: true,
        recognized: true,
      }
      if (filename !== cleanName) delete modsJson.mods[filename]
    }

    // Mark unmatched
    for (const { sha1, cleanName } of withHash) {
      if (matchedHashes.has(sha1)) continue
      const existing = modsJson.mods[cleanName]
      modsJson.mods[cleanName] = {
        modId: 0, fileId: 0, gameVersions: [],
        ...(existing ?? {}),
        name: existing?.name ?? cleanName.replace('.jar', ''),
        slug: existing?.slug ?? '',
        mrResolved: true,
        recognized: false,
      }
    }
  } else {
    // ── CurseForge: fingerprint matching ────────────────────────────────────
    const withFingerprint: { filename: string; cleanName: string; fingerprint: number }[] = []
    for (const entry of toIdentify) {
      try {
        const buf = fs.readFileSync(path.join(modsDir, entry.filename))
        withFingerprint.push({ ...entry, fingerprint: cfFingerprint(buf) })
      } catch { /* skip unreadable */ }
    }

    if (withFingerprint.length === 0) return

    let result: any
    try {
      result = await cfGetFingerprintMatches(withFingerprint.map(f => f.fingerprint))
    } catch { return }

    const exactMatches: any[] = result?.data?.exactMatches ?? []
    const matchedFps = new Set<number>()
    const fpToEntry = new Map(withFingerprint.map(f => [f.fingerprint, f]))

    for (const match of exactMatches) {
      const fp: number = match.file?.fileFingerprint
      const entry = fpToEntry.get(fp)
      if (!entry) continue
      matchedFps.add(fp)

      const modId: number = match.id
      const fileId: number = match.file?.id ?? 0
      const gameVersions: string[] = match.file?.gameVersions ?? []
      const deps: number[] = (match.file?.dependencies ?? [])
        .filter((d: any) => d.relationType === 3)
        .map((d: any) => d.modId as number)

      let name = entry.cleanName.replace('.jar', '')
      let slug = ''
      let logo: string | undefined
      let summary: string | undefined

      try {
        const modData = (await cfGetMod(modId)) as any
        const mod = modData?.data
        if (mod) { name = mod.name ?? name; slug = mod.slug ?? ''; logo = mod.logo?.thumbnailUrl; summary = mod.summary }
      } catch { /* use filename as name */ }

      modsJson.mods[entry.cleanName] = {
        ...(modsJson.mods[entry.cleanName] ?? {}),
        modId, fileId, name, slug, logo, summary, gameVersions, recognized: true, deps,
      }
      if (entry.filename !== entry.cleanName) delete modsJson.mods[entry.filename]
    }

    // Mark unmatched
    for (const { fingerprint, cleanName } of withFingerprint) {
      if (matchedFps.has(fingerprint)) continue
      const existing = modsJson.mods[cleanName]
      modsJson.mods[cleanName] = {
        modId: 0, fileId: 0, gameVersions: [],
        ...(existing ?? {}),
        name: existing?.name ?? cleanName.replace('.jar', ''),
        slug: existing?.slug ?? '',
        recognized: false,
      }
    }
  }

  writeModsJson(instanceId, modsJson)
}
