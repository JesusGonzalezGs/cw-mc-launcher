/**
 * Gestión de metadatos de mods y resolución de dependencias.
 */
import fs from 'fs'
import path from 'path'
import { getInstanceDir, getModsDir } from './instanceManager'
import { cfGetFileDetails, cfGetModFiles, cfGetMod, cfGetDownloadUrl, cfFingerprint, cfGetFingerprintMatches } from './curseforgeService'
import { downloadFile } from '../utils/downloadHelper'

export interface ModMeta {
  modId: number
  fileId: number
  name: string
  slug: string
  logo?: string
  summary?: string
  gameVersions: string[]
  recognized?: boolean
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

  const url = await cfGetDownloadUrl(modId, fileId)
  if (!url) throw new Error('URL de descarga vacía')

  const filename = decodeURIComponent(url.split('/').pop() ?? `mod-${fileId}.jar`)
  const destPath = path.join(modsDir, filename)

  onProgress?.(`Descargando ${filename}...`)
  await downloadFile(url, destPath)

  // Metadata (best-effort)
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
      modsJson.mods[filename] = {
        modId, fileId,
        name,
        slug: mod.slug ?? '',
        logo: mod.logo?.thumbnailUrl,
        summary: mod.summary,
        gameVersions,
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

  const { filename, name } = await installSingle(instanceId, modId, fileId, modsJson, onProgress)

  // Dependency resolution
  let requiredDeps: any[] = []
  try {
    const fileData = (await cfGetFileDetails(modId, fileId)) as any
    requiredDeps = (fileData?.data?.dependencies ?? []).filter((d: any) => d.relationType === 3)
  } catch { /* no deps */ }

  const depsInstalled: { filename: string; name: string }[] = []
  const depsFailed: { modId: number; error: string }[] = []

  for (const dep of requiredDeps) {
    const depModId: number = dep.modId
    if (Object.values(modsJson.mods).some((m) => m.modId === depModId)) continue

    try {
      onProgress?.(`Buscando dependencia #${depModId}...`)
      const filesData = (await cfGetModFiles(depModId, mcVersion, loaderType || undefined)) as any
      const files: any[] = filesData?.data ?? []
      if (files.length === 0) {
        depsFailed.push({ modId: depModId, error: 'Sin versiones compatibles' })
        continue
      }
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

  // Collect files that need identification (no recognized field yet)
  const toIdentify: { filename: string; cleanName: string; fingerprint: number }[] = []
  for (const filename of allFiles) {
    const cleanName = filename.replace('.jar.disabled', '.jar')
    const existing = modsJson.mods[cleanName] ?? modsJson.mods[filename]
    if (existing?.recognized !== undefined) continue
    try {
      const buf = fs.readFileSync(path.join(modsDir, filename))
      toIdentify.push({ filename, cleanName, fingerprint: cfFingerprint(buf) })
    } catch { /* skip unreadable */ }
  }

  if (toIdentify.length === 0) return
  onProgress?.(`Identificando ${toIdentify.length} mod${toIdentify.length > 1 ? 's' : ''}...`)

  let result: any
  try {
    result = await cfGetFingerprintMatches(toIdentify.map(f => f.fingerprint))
  } catch { return }

  const exactMatches: any[] = result?.data?.exactMatches ?? []
  const matchedFps = new Set<number>()
  const fpToEntry = new Map(toIdentify.map(f => [f.fingerprint, f]))

  for (const match of exactMatches) {
    const fp: number = match.file?.fileFingerprint
    const entry = fpToEntry.get(fp)
    if (!entry) continue
    matchedFps.add(fp)

    const modId: number = match.id
    const fileId: number = match.file?.id ?? 0
    const gameVersions: string[] = match.file?.gameVersions ?? []

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
      modId, fileId, name, slug, logo, summary, gameVersions, recognized: true,
    }
    if (entry.filename !== entry.cleanName) delete modsJson.mods[entry.filename]
  }

  // Mark unmatched
  for (const { fingerprint, cleanName } of toIdentify) {
    if (matchedFps.has(fingerprint)) continue
    modsJson.mods[cleanName] = {
      modId: 0, fileId: 0, gameVersions: [],
      ...(modsJson.mods[cleanName] ?? {}),
      name: modsJson.mods[cleanName]?.name ?? cleanName.replace('.jar', ''),
      slug: modsJson.mods[cleanName]?.slug ?? '',
      recognized: false,
    }
  }

  writeModsJson(instanceId, modsJson)
}
