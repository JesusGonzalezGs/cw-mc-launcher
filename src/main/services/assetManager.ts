/**
 * Gestión unificada de metadatos de mods y archivos de recursos.
 *
 * Cubre todos los casos de uso del usuario:
 *  - Instalar mod/archivo desde el launcher (CF o MR)
 *  - Soltar un archivo directamente en la carpeta (auto-identificación)
 *  - Eliminar desde el launcher o desde el sistema de archivos
 *  - Activar / desactivar (toggle)
 *  - Mods (.jar), resource/shader/datapacks (.zip) — misma lógica
 *  - CurseForge (fingerprint murmur2) y Modrinth (SHA1) — mismo flujo
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getInstanceDir, getModsDir, getInstance } from './instanceManager'
import { cfGetFileDetails, cfGetModFiles, cfGetMod, cfGetDownloadUrl, cfFingerprint, cfGetFingerprintMatches } from './curseforgeService'
import { mrGetVersion, mrGetProject, mrGetProjectVersions } from './modrinthService'
import { downloadFile } from '../utils/downloadHelper'

const MR_HEADERS = { 'User-Agent': 'cw-mc-launcher/0.1.0', 'Accept': 'application/json', 'Content-Type': 'application/json' }
const LOADER_TYPE_MAP: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssetMeta {
  /** How this asset entered the instance */
  source: 'cf' | 'mr' | 'manual'
  name: string
  /** CF mod slug or MR project slug */
  slug: string
  logo?: string
  summary?: string
  gameVersions?: string[]
  // CurseForge
  cfModId?: number
  cfFileId?: number
  /** Required CF dependency mod IDs (used for cascade disable) */
  cfDeps?: number[]
  // Modrinth
  mrProjectId?: string
  mrVersionId?: string
  mrSlug?: string
  /**
   * Identification state for files dropped directly into the folder:
   *   undefined = pending (will be checked on next identify run)
   *   true      = identified in CF or MR catalog
   *   false     = not found in any catalog (won't be retried)
   */
  recognized?: boolean
}

export interface AssetsJson {
  assets: Record<string, AssetMeta>
}

export interface CfInstallResult {
  filename: string
  depsInstalled: { filename: string; name: string }[]
  depsFailed: { modId: number; error: string }[]
}

// ── Migration from old mods.json / files.json format ─────────────────────────

function migrateOldRecord(old: any): AssetMeta {
  const hasMrId = Boolean(old.mrVersionId)
  const hasCfId = (old.modId ?? 0) > 0
  const source: 'cf' | 'mr' | 'manual' = hasMrId ? 'mr' : hasCfId ? 'cf' : 'manual'
  const meta: AssetMeta = {
    source,
    name: old.name ?? '',
    slug: old.mrSlug ?? old.slug ?? '',
    logo: old.logo,
    summary: old.summary,
    gameVersions: old.gameVersions,
    recognized: old.recognized,
  }
  if (hasCfId) {
    meta.cfModId = old.modId
    meta.cfFileId = old.fileId
    meta.cfDeps = old.deps
  }
  if (hasMrId || old.mrSlug) {
    meta.mrVersionId = old.mrVersionId
    meta.mrSlug = old.mrSlug
  }
  return meta
}

function parseRawJson(raw: any): AssetsJson {
  if (raw && typeof raw === 'object') {
    if (raw.assets && typeof raw.assets === 'object') return raw as AssetsJson
    const legacyKey = raw.mods ?? raw.files
    if (legacyKey && typeof legacyKey === 'object') {
      const assets: Record<string, AssetMeta> = {}
      for (const [k, v] of Object.entries(legacyKey)) assets[k] = migrateOldRecord(v)
      return { assets }
    }
  }
  return { assets: {} }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export function getAssetsJsonPath(instanceId: string, folder: string): string {
  return path.join(getInstanceDir(instanceId), `${folder}.json`)
}

export function readAssetsJson(instanceId: string, folder: string): AssetsJson {
  const p = getAssetsJsonPath(instanceId, folder)
  if (!fs.existsSync(p)) return { assets: {} }
  try { return parseRawJson(JSON.parse(fs.readFileSync(p, 'utf-8'))) } catch { return { assets: {} } }
}

export function writeAssetsJson(instanceId: string, folder: string, data: AssetsJson): void {
  fs.writeFileSync(getAssetsJsonPath(instanceId, folder), JSON.stringify(data, null, 2))
}

export function removeAssetMeta(instanceId: string, folder: string, filename: string): void {
  const json = readAssetsJson(instanceId, folder)
  const ext = folder === 'mods' ? '.jar' : '.zip'
  const clean = filename.endsWith('.disabled')
    ? filename.slice(0, -(ext + '.disabled').length) + ext
    : filename
  delete json.assets[filename]
  delete json.assets[clean]
  writeAssetsJson(instanceId, folder, json)
}

// ── Extension helpers ─────────────────────────────────────────────────────────

function getExt(folder: string): { enabled: string; disabled: string } {
  return folder === 'mods'
    ? { enabled: '.jar', disabled: '.jar.disabled' }
    : { enabled: '.zip', disabled: '.zip.disabled' }
}

function getFolderDir(instanceId: string, folder: string): string {
  return folder === 'mods' ? getModsDir(instanceId) : path.join(getInstanceDir(instanceId), folder)
}

// ── CurseForge install ────────────────────────────────────────────────────────

async function installCfSingle(
  instanceId: string,
  folder: string,
  modId: number,
  fileId: number,
  json: AssetsJson,
  onProgress?: (msg: string) => void,
): Promise<{ filename: string; name: string }> {
  const { enabled, disabled } = getExt(folder)
  const dir = getFolderDir(instanceId, folder)
  fs.mkdirSync(dir, { recursive: true })

  // Remove any previously installed version of the same mod
  for (const [existing, meta] of Object.entries(json.assets)) {
    if (meta.cfModId !== modId) continue
    const clean = existing.replace(disabled, enabled)
    for (const f of [clean, clean.replace(enabled, disabled)]) {
      try { fs.rmSync(path.join(dir, f), { force: true }) } catch {}
    }
    delete json.assets[clean]
    delete json.assets[clean.replace(enabled, disabled)]
  }

  const url = await cfGetDownloadUrl(modId, fileId)
  if (!url) throw new Error('URL de descarga vacía')

  const filename = decodeURIComponent(url.split('/').pop() ?? `asset-${fileId}${enabled}`)
  onProgress?.(`Descargando ${filename}...`)
  await downloadFile(url, path.join(dir, filename))

  // Pre-write minimal metadata so the FS watcher doesn't trigger identifyAssets
  json.assets[filename] = { source: 'cf', cfModId: modId, cfFileId: fileId, name: filename.replace(enabled, ''), slug: '', gameVersions: [], recognized: true }
  writeAssetsJson(instanceId, folder, json)

  // Enrich with full metadata from API (best-effort)
  let name = filename.replace(enabled, '')
  try {
    const [modData, fileData] = await Promise.all([cfGetMod(modId) as Promise<any>, cfGetFileDetails(modId, fileId) as Promise<any>])
    const mod = modData?.data
    const file = fileData?.data
    if (mod) {
      const cfDeps: number[] = (file?.dependencies ?? []).filter((d: any) => d.relationType === 3).map((d: any) => d.modId as number)
      name = mod.name ?? name
      json.assets[filename] = {
        source: 'cf', cfModId: modId, cfFileId: fileId,
        name, slug: mod.slug ?? '', logo: mod.logo?.thumbnailUrl, summary: mod.summary,
        gameVersions: file?.gameVersions ?? [], cfDeps, recognized: true,
      }
    }
  } catch { /* metadata optional */ }

  return { filename, name }
}

export async function installCfAsset(
  instanceId: string,
  folder: string,
  modId: number,
  fileId: number,
): Promise<string> {
  const json = readAssetsJson(instanceId, folder)
  const { filename } = await installCfSingle(instanceId, folder, modId, fileId, json)
  writeAssetsJson(instanceId, folder, json)
  return filename
}

export async function installCfAssetWithDeps(
  instanceId: string,
  modId: number,
  fileId: number,
  mcVersion: string,
  modLoader: string,
  onProgress?: (msg: string) => void,
): Promise<CfInstallResult> {
  const json = readAssetsJson(instanceId, 'mods')
  const loaderType = LOADER_TYPE_MAP[modLoader.toLowerCase()] ?? 0

  const { filename } = await installCfSingle(instanceId, 'mods', modId, fileId, json, onProgress)

  const requiredDepIds: number[] = json.assets[filename]?.cfDeps ?? []
  const depsInstalled: { filename: string; name: string }[] = []
  const depsFailed: { modId: number; error: string }[] = []

  for (const depModId of requiredDepIds) {
    if (Object.values(json.assets).some((m) => m.cfModId === depModId)) continue
    try {
      onProgress?.(`Buscando dependencia #${depModId}...`)
      const filesData = (await cfGetModFiles(depModId, mcVersion, loaderType || undefined)) as any
      const files: any[] = filesData?.data ?? []
      if (files.length === 0) { depsFailed.push({ modId: depModId, error: 'Sin versiones compatibles' }); continue }
      const depResult = await installCfSingle(instanceId, 'mods', depModId, files[0].id, json, onProgress)
      depsInstalled.push(depResult)
    } catch (err: any) {
      depsFailed.push({ modId: depModId, error: err.message ?? 'Error desconocido' })
    }
  }

  writeAssetsJson(instanceId, 'mods', json)
  return { filename, depsInstalled, depsFailed }
}

// ── Identification ────────────────────────────────────────────────────────────

/**
 * Scans a folder for unidentified assets and looks them up in CF (fingerprint)
 * or MR (SHA1) depending on the instance's source. Safe to call at any time —
 * already-identified files and files that previously failed are skipped.
 */
export async function identifyAssets(
  instanceId: string,
  folder: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const { enabled, disabled } = getExt(folder)
  const dir = getFolderDir(instanceId, folder)
  if (!fs.existsSync(dir)) return

  const json = readAssetsJson(instanceId, folder)
  const instance = getInstance(instanceId)
  const isModrinth = instance?.source === 'modrinth' || instance?.modSource === 'mr'

  const toIdentify: { filename: string; cleanName: string; isDir: boolean }[] = []
  for (const filename of fs.readdirSync(dir)) {
    if (filename.startsWith('.')) continue
    const isDir = fs.statSync(path.join(dir, filename)).isDirectory()
    if (folder === 'mods') {
      if (!filename.endsWith(enabled) && !filename.endsWith(disabled)) continue
    } else {
      if (!isDir && !filename.endsWith(enabled) && !filename.endsWith(disabled)) continue
    }
    const cleanName = filename.endsWith('.disabled') ? filename.slice(0, -'.disabled'.length) : filename
    const existing = json.assets[cleanName] ?? json.assets[filename]
    if (existing?.recognized === true && (existing.cfFileId || existing.mrVersionId || isDir)) continue
    if (existing?.recognized === false) continue
    toIdentify.push({ filename, cleanName, isDir })
  }

  // Directories cannot be hash-identified — mark as unrecognized immediately
  for (const { filename, cleanName, isDir } of toIdentify) {
    if (!isDir) continue
    if (!json.assets[cleanName]) {
      json.assets[cleanName] = { source: 'manual', name: cleanName, slug: '', recognized: false }
    }
    if (filename !== cleanName) delete json.assets[filename]
  }

  const hashable = toIdentify.filter(e => !e.isDir)
  writeAssetsJson(instanceId, folder, json)
  if (hashable.length === 0) return

  onProgress?.(`Identificando ${hashable.length} archivo${hashable.length > 1 ? 's' : ''}...`)

  if (isModrinth) {
    await _identifyMrHash(dir, hashable, json, enabled)
  } else {
    await _identifyCfFingerprint(dir, hashable, json, enabled)
  }

  writeAssetsJson(instanceId, folder, json)
}

async function _identifyMrHash(
  dir: string,
  files: { filename: string; cleanName: string }[],
  json: AssetsJson,
  ext: string,
): Promise<void> {
  const withHash: { filename: string; cleanName: string; sha1: string }[] = []
  for (const f of files) {
    try {
      const buf = fs.readFileSync(path.join(dir, f.filename))
      withHash.push({ ...f, sha1: crypto.createHash('sha1').update(buf).digest('hex') })
    } catch { /* skip unreadable */ }
  }
  if (withHash.length === 0) return

  let matched: Record<string, any> = {}
  try {
    const res = await fetch('https://api.modrinth.com/v2/version_files', {
      method: 'POST', headers: MR_HEADERS,
      body: JSON.stringify({ hashes: withHash.map(f => f.sha1), algorithm: 'sha1' }),
    })
    if (res.ok) matched = await res.json()
  } catch { /* leave all unmatched */ }

  const projectIds = [...new Set(Object.values(matched).map((v: any) => v.project_id as string))]
  const projects: Record<string, any> = {}
  if (projectIds.length > 0) {
    try {
      const res = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(projectIds))}`, { headers: MR_HEADERS })
      if (res.ok) for (const p of (await res.json()) as any[]) projects[p.id] = p
    } catch { /* use version data as fallback */ }
  }

  const matchedHashes = new Set<string>()
  for (const { filename, cleanName, sha1 } of withHash) {
    const version = matched[sha1]
    if (!version) continue
    matchedHashes.add(sha1)
    const project = projects[version.project_id]
    json.assets[cleanName] = {
      ...(json.assets[cleanName] ?? {}),
      source: 'mr',
      name: project?.title ?? cleanName.replace(ext, ''),
      slug: project?.slug ?? '',
      mrProjectId: version.project_id,
      mrVersionId: version.id,
      mrSlug: project?.slug,
      logo: project?.icon_url,
      summary: project?.description,
      gameVersions: version.game_versions ?? [],
      recognized: true,
    }
    if (filename !== cleanName) delete json.assets[filename]
  }

  for (const { sha1, cleanName } of withHash) {
    if (matchedHashes.has(sha1)) continue
    const existing = json.assets[cleanName]
    json.assets[cleanName] = {
      source: 'manual', slug: '',
      ...(existing ?? {}),
      name: existing?.name ?? cleanName.replace(ext, ''),
      recognized: false,
    }
  }
}

async function _identifyCfFingerprint(
  dir: string,
  files: { filename: string; cleanName: string }[],
  json: AssetsJson,
  ext: string,
): Promise<void> {
  const withFp: { filename: string; cleanName: string; fingerprint: number }[] = []
  for (const f of files) {
    try {
      const buf = fs.readFileSync(path.join(dir, f.filename))
      withFp.push({ ...f, fingerprint: cfFingerprint(buf) })
    } catch { /* skip unreadable */ }
  }
  if (withFp.length === 0) return

  let result: any
  try { result = await cfGetFingerprintMatches(withFp.map(f => f.fingerprint)) } catch { return }

  const exactMatches: any[] = result?.data?.exactMatches ?? []
  const matchedFps = new Set<number>()
  const fpToEntry = new Map(withFp.map(f => [f.fingerprint, f]))

  for (const match of exactMatches) {
    const fp: number = match.file?.fileFingerprint
    const entry = fpToEntry.get(fp)
    if (!entry) continue
    matchedFps.add(fp)
    const cfModId: number = match.id
    const cfFileId: number = match.file?.id ?? 0
    const gameVersions: string[] = match.file?.gameVersions ?? []
    const cfDeps: number[] = (match.file?.dependencies ?? []).filter((d: any) => d.relationType === 3).map((d: any) => d.modId as number)
    let name = entry.cleanName.replace(ext, ''), slug = '', logo: string | undefined, summary: string | undefined
    try {
      const mod = ((await cfGetMod(cfModId)) as any)?.data
      if (mod) { name = mod.name ?? name; slug = mod.slug ?? ''; logo = mod.logo?.thumbnailUrl; summary = mod.summary }
    } catch { /* use filename as name */ }
    json.assets[entry.cleanName] = {
      ...(json.assets[entry.cleanName] ?? {}),
      source: 'cf', cfModId, cfFileId, name, slug, logo, summary, gameVersions, cfDeps, recognized: true,
    }
    if (entry.filename !== entry.cleanName) delete json.assets[entry.filename]
  }

  for (const { fingerprint, cleanName } of withFp) {
    if (matchedFps.has(fingerprint)) continue
    const existing = json.assets[cleanName]
    json.assets[cleanName] = {
      source: 'manual', slug: '',
      ...(existing ?? {}),
      name: existing?.name ?? cleanName.replace(ext, ''),
      recognized: false,
    }
  }
}

// ── Modrinth install ──────────────────────────────────────────────────────────

export interface MrInstallResult {
  ok: boolean
  filename: string
  depsInstalled: { filename: string; name: string }[]
  depsFailed: { slug: string; error: string }[]
}

/**
 * Instala un mod/archivo de Modrinth en una instancia, con resolución recursiva
 * de dependencias requeridas (solo para la carpeta mods).
 */
export async function installMrAsset(
  instanceId: string,
  versionId: string,
  folder: string = 'mods',
  mrSlug?: string,
): Promise<MrInstallResult> {
  const depsInstalled: { filename: string; name: string }[] = []
  const depsFailed: { slug: string; error: string }[] = []
  const result = await _installMrAssetInternal(instanceId, versionId, folder, mrSlug, new Set(), depsInstalled, depsFailed)
  return { ok: true, filename: result.filename, depsInstalled, depsFailed }
}

async function _installMrAssetInternal(
  instanceId: string,
  versionId: string,
  folder: string,
  mrSlug: string | undefined,
  seen: Set<string>,
  depsInstalled: { filename: string; name: string }[],
  depsFailed: { slug: string; error: string }[],
): Promise<{ filename: string }> {
  const { enabled, disabled } = getExt(folder)
  const version = await mrGetVersion(versionId)
  const primaryFile = version.files.find((f: any) => f.primary) ?? version.files[0]
  if (!primaryFile) throw new Error('No hay archivos en esta versión de Modrinth')

  const targetDir = getFolderDir(instanceId, folder)
  fs.mkdirSync(targetDir, { recursive: true })
  await downloadFile(primaryFile.url, path.join(targetDir, primaryFile.filename))

  if (mrSlug) {
    // Pre-write minimal metadata so the FS watcher doesn't trigger identifyAssets.
    // Omit mrSlug here — the cleanup loop below matches by mrSlug and would
    // delete the just-downloaded file if it found its own entry.
    const preJson = readAssetsJson(instanceId, folder)
    if (!preJson.assets[primaryFile.filename]) {
      preJson.assets[primaryFile.filename] = {
        source: 'mr', name: mrSlug, slug: mrSlug,
        mrVersionId: version.id, gameVersions: version.game_versions ?? [],
        recognized: true,
      }
      writeAssetsJson(instanceId, folder, preJson)
    }

    // Fetch project info for full metadata
    let projectTitle = mrSlug, logo: string | undefined, summary: string | undefined, mrProjectId: string | undefined
    try {
      const project = await mrGetProject(version.project_id)
      projectTitle = project.title ?? mrSlug
      logo = project.icon_url
      summary = project.description
      mrProjectId = project.id
    } catch { /* metadata optional */ }

    const json = readAssetsJson(instanceId, folder)
    // Remove old version with the same mrSlug
    for (const [existing, meta] of Object.entries(json.assets)) {
      if (meta.mrSlug !== mrSlug) continue
      const clean = existing.endsWith('.disabled') ? existing.slice(0, -'.disabled'.length) : existing
      for (const f of [clean, clean.replace(enabled, disabled)]) {
        try { fs.rmSync(path.join(targetDir, f), { force: true }) } catch {}
      }
      delete json.assets[clean]
      delete json.assets[clean.replace(enabled, disabled)]
    }
    json.assets[primaryFile.filename] = {
      source: 'mr', mrProjectId, mrVersionId: version.id, mrSlug,
      name: projectTitle, slug: mrSlug, logo, summary,
      gameVersions: version.game_versions ?? [], recognized: true,
    }
    writeAssetsJson(instanceId, folder, json)
  }

  // Resolve required dependencies (mods only)
  if (folder === 'mods') {
    const requiredDeps: any[] = (version.dependencies ?? []).filter(
      (d: any) => d.dependency_type === 'required' && d.project_id,
    )
    if (requiredDeps.length > 0) {
      const instance = getInstance(instanceId)
      for (const dep of requiredDeps) {
        const projectId: string = dep.project_id
        if (seen.has(projectId)) continue
        seen.add(projectId)
        try {
          const project = await mrGetProject(projectId)
          const depSlug: string = project.slug
          const modsJson = readAssetsJson(instanceId, 'mods')
          if (Object.values(modsJson.assets).some(m => m.mrSlug === depSlug)) continue

          let depVersionId: string = dep.version_id
          if (!depVersionId) {
            const gameVersions = instance?.mcVersion ? [instance.mcVersion] : undefined
            const loaders = instance?.modLoader && instance.modLoader !== 'vanilla' ? [instance.modLoader] : undefined
            const depVersions = await mrGetProjectVersions(projectId, gameVersions, loaders)
            if (depVersions.length === 0) { depsFailed.push({ slug: depSlug, error: 'Sin versiones compatibles' }); continue }
            depVersionId = depVersions[0].id
          }
          const depResult = await _installMrAssetInternal(instanceId, depVersionId, 'mods', depSlug, seen, depsInstalled, depsFailed)
          depsInstalled.push({ filename: depResult.filename, name: project.title ?? depSlug })
        } catch (err: any) {
          const project = await mrGetProject(dep.project_id).catch(() => null)
          depsFailed.push({ slug: project?.slug ?? dep.project_id, error: err?.message ?? 'Error desconocido' })
        }
      }
    }
  }

  return { filename: primaryFile.filename }
}
