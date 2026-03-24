/**
 * Instalación de modpacks de CurseForge y Modrinth.
 * Ambas funciones siguen el mismo patrón: descargar, extraer, crear instancia,
 * instalar MC + mod loader, descargar archivos e identificar assets.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { cfGetDownloadUrl, cfGetModsBatch } from './curseforgeService'
import { mrGetVersion } from './modrinthService'
import { downloadFile } from '../utils/downloadHelper'
import { extractZip } from '../utils/platform'
import { downloadVersionFiles } from './gameDownloader'
import {
  installFabric,
  installQuilt,
  installForge,
  installNeoForge,
} from './modLoaderInstaller'
import { createInstance, deleteInstance, getInstanceDir, getModsDir } from './instanceManager'
import type { Instance } from './instanceManager'
import type { ModLoader } from './modLoaderInstaller'
import { identifyAssets, readAssetsJson, writeAssetsJson } from './assetManager'
import type { AssetsJson } from './assetManager'

export interface InstallProgress {
  stage: string
  current: number
  total: number
  percent: number
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** "fabric-0.15.11" → { loader: 'fabric', version: '0.15.11' } */
function parseCfLoaderString(id: string): { loader: ModLoader; version: string } {
  if (id.startsWith('fabric-'))  return { loader: 'fabric',   version: id.slice(7) }
  if (id.startsWith('quilt-'))   return { loader: 'quilt',    version: id.slice(6) }
  if (id.startsWith('neoforge-'))return { loader: 'neoforge', version: id.slice(9) }
  if (id.startsWith('forge-'))   return { loader: 'forge',    version: id.slice(6) }
  return { loader: 'vanilla', version: '' }
}

/** modrinth.index.json dependencies → { loader, loaderVersion } */
function parseMrLoader(deps: Record<string, string>): { loader: ModLoader; loaderVersion: string } {
  if (deps['fabric-loader']) return { loader: 'fabric',   loaderVersion: deps['fabric-loader'] }
  if (deps['quilt-loader'])  return { loader: 'quilt',    loaderVersion: deps['quilt-loader'] }
  if (deps['neoforge'])      return { loader: 'neoforge', loaderVersion: deps['neoforge'] }
  if (deps['forge'])         return { loader: 'forge',    loaderVersion: deps['forge'] }
  return { loader: 'vanilla', loaderVersion: '' }
}

/**
 * Instala el mod loader apropiado y devuelve el resolvedVersionId resultante.
 * Comparte lógica entre CF y MR.
 */
async function installModLoader(
  mcVersion: string,
  loader: ModLoader,
  loaderVersion: string,
  onProgress: (p: InstallProgress) => void,
  percent: number,
): Promise<string> {
  onProgress({ stage: `Instalando ${loader}...`, current: 0, total: 100, percent })
  if (loader === 'fabric') return installFabric(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent }))
  if (loader === 'quilt')  return installQuilt(mcVersion, loaderVersion,  (msg) => onProgress({ stage: msg, current: 0, total: 100, percent }))
  if (loader === 'forge') {
    await installForge(mcVersion, `${mcVersion}-${loaderVersion}`, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent }))
    return `${mcVersion}-forge-${loaderVersion}`
  }
  if (loader === 'neoforge') {
    await installNeoForge(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent }))
    return `neoforge-${loaderVersion}`
  }
  return mcVersion
}

async function identifyAllFolders(instanceId: string): Promise<void> {
  await Promise.all([
    identifyAssets(instanceId, 'mods').catch(() => {}),
    identifyAssets(instanceId, 'resourcepacks').catch(() => {}),
    identifyAssets(instanceId, 'shaderpacks').catch(() => {}),
    identifyAssets(instanceId, 'datapacks').catch(() => {}),
  ])
}

// ── Download helpers ───────────────────────────────────────────────────────────

const CONCURRENT_DOWNLOADS = 8
const MR_HEADERS = { 'User-Agent': 'cw-mc-launcher/0.1.0', 'Accept': 'application/json', 'Content-Type': 'application/json' }

/** Download with automatic retry and exponential backoff. */
async function downloadWithRetry(url: string, dest: string, signal: AbortSignal, retries = 2): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await downloadFile(url, dest, undefined, undefined, signal)
      return
    } catch (err: any) {
      if (err?.message === 'CANCELLED') throw err
      if (attempt >= retries) throw err
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

/** Run `fn` over `items` with at most `concurrency` parallel workers. */
async function runConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = CONCURRENT_DOWNLOADS,
): Promise<void> {
  if (items.length === 0) return
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (item === undefined) break
        await fn(item)
      }
    }),
  )
}

/** Build a folder→AssetsJson map, lazily reading existing JSON from disk. */
function getFolderAssets(cache: Map<string, AssetsJson>, instanceId: string, folder: string): AssetsJson {
  if (!cache.has(folder)) cache.set(folder, readAssetsJson(instanceId, folder))
  return cache.get(folder)!
}

/** Batch-identify MR files by sha1. Returns sha1 → version object. */
async function mrBatchVersionFiles(sha1s: string[]): Promise<Record<string, any>> {
  if (sha1s.length === 0) return {}
  try {
    const res = await fetch('https://api.modrinth.com/v2/version_files', {
      method: 'POST', headers: MR_HEADERS,
      body: JSON.stringify({ hashes: sha1s, algorithm: 'sha1' }),
    })
    return res.ok ? (await res.json()) as Record<string, any> : {}
  } catch { return {} }
}

/** Batch-fetch MR projects by id array. Returns id → project object. */
async function mrBatchProjects(ids: string[]): Promise<Record<string, any>> {
  if (ids.length === 0) return {}
  try {
    const res = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`, { headers: MR_HEADERS })
    if (!res.ok) return {}
    const projects: Record<string, any> = {}
    for (const p of (await res.json()) as any[]) projects[p.id] = p
    return projects
  } catch { return {} }
}

// ── Cancel ────────────────────────────────────────────────────────────────────

let activeController: AbortController | null = null

export function cancelInstall(): void {
  activeController?.abort()
}

// ── CurseForge modpack ────────────────────────────────────────────────────────

export async function installCurseForgeModpack(
  modpackId: number,
  fileId: number,
  cfName: string,
  cfLogoUrl: string | undefined,
  onProgress: (p: InstallProgress) => void,
  cfFileVersion?: string,
  cfSlug?: string,
): Promise<Instance> {
  const controller = new AbortController()
  activeController = controller
  const { signal } = controller

  const tmpZip = path.join(os.tmpdir(), `cw-mc-modpack-${fileId}.zip`)
  const tmpExtract = path.join(os.tmpdir(), `cw-mc-modpack-extract-${fileId}`)
  let instance: Instance | null = null

  const cleanup = () => {
    try { fs.rmSync(tmpZip, { force: true }) } catch {}
    try { fs.rmSync(tmpExtract, { recursive: true, force: true }) } catch {}
    if (instance) { try { deleteInstance(instance.id) } catch {} }
  }

  const check = () => { if (signal.aborted) throw new Error('CANCELLED') }

  try {
    // 1. Obtener URL de descarga
    check()
    onProgress({ stage: 'Obteniendo URL del modpack...', current: 0, total: 100, percent: 0 })
    const downloadUrl = await cfGetDownloadUrl(modpackId, fileId)
    if (!downloadUrl) throw new Error('No se pudo obtener la URL del modpack')

    // 2. Descargar ZIP
    check()
    onProgress({ stage: 'Descargando modpack...', current: 0, total: 100, percent: 5 })
    await downloadFile(downloadUrl, tmpZip, (p) => {
      onProgress({ stage: 'Descargando modpack...', current: p.downloaded, total: p.total, percent: 5 + Math.round(p.percent * 0.2) })
    }, undefined, signal)

    // 3. Extraer ZIP
    check()
    onProgress({ stage: 'Extrayendo modpack...', current: 0, total: 100, percent: 25 })
    fs.mkdirSync(tmpExtract, { recursive: true })
    await extractZip(tmpZip, tmpExtract)
    fs.rmSync(tmpZip, { force: true })

    // 4. Parsear manifest.json
    const manifestPath = path.join(tmpExtract, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      fs.rmSync(tmpExtract, { recursive: true, force: true })
      throw new Error('El ZIP no contiene manifest.json — no es un modpack de CurseForge válido')
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    const mcVersion: string = manifest.minecraft?.version ?? ''
    const rawLoader: string = manifest.minecraft?.modLoaders?.[0]?.id ?? 'vanilla'
    const { loader, version: loaderVersion } = parseCfLoaderString(rawLoader)
    const modFiles: { projectID: number; fileID: number }[] = manifest.files ?? []

    // 5. Crear instancia
    check()
    onProgress({ stage: 'Creando instancia...', current: 0, total: 100, percent: 28 })
    instance = createInstance({
      name: cfName, mcVersion, modLoader: loader, modLoaderVersion: loaderVersion,
      resolvedVersionId: mcVersion, source: 'curseforge',
      cfMeta: { modpackId, fileId, name: cfName, logoUrl: cfLogoUrl, fileVersion: cfFileVersion, slug: cfSlug },
    })

    const instanceDir = getInstanceDir(instance.id)
    fs.mkdirSync(getModsDir(instance.id), { recursive: true })

    // 6. Copiar overrides
    const overridesDir = path.join(tmpExtract, 'overrides')
    if (fs.existsSync(overridesDir)) {
      onProgress({ stage: 'Copiando overrides...', current: 0, total: 100, percent: 30 })
      await fs.promises.cp(overridesDir, instanceDir, { recursive: true })
    }
    fs.rmSync(tmpExtract, { recursive: true, force: true })

    // 7. Descargar Minecraft
    check()
    onProgress({ stage: 'Descargando Minecraft...', current: 0, total: 100, percent: 33 })
    await downloadVersionFiles(mcVersion, (e) => {
      onProgress({ stage: e.stage, current: e.current, total: e.total, percent: 33 + Math.round(e.percent * 0.2) })
    })

    // 8. Instalar mod loader
    const resolvedVersionId = await installModLoader(mcVersion, loader, loaderVersion, onProgress, 55)

    // 9. Descargar archivos del manifest en paralelo con metadata inline
    check()
    onProgress({ stage: 'Clasificando archivos...', current: 0, total: 100, percent: 63 })
    const CLASS_FOLDER: Record<number, string> = { 6: 'mods', 12: 'resourcepacks', 6552: 'shaderpacks', 6945: 'datapacks' }
    const projectIds = [...new Set(modFiles.map(f => f.projectID))]
    const modsMeta = await cfGetModsBatch(projectIds).catch(() => ({} as Record<number, any>))

    const folderAssetsCache = new Map<string, AssetsJson>()
    let modsDone = 0

    await runConcurrent(modFiles, async (modEntry) => {
      check()
      const folder = CLASS_FOLDER[modsMeta[modEntry.projectID]?.classId ?? 6] ?? 'mods'
      const destDir = path.join(instanceDir, folder)
      fs.mkdirSync(destDir, { recursive: true })
      let filename = `file-${modEntry.fileID}`
      try {
        const url = await cfGetDownloadUrl(modEntry.projectID, modEntry.fileID)
        if (!url) return
        filename = decodeURIComponent(url.split('/').pop() ?? filename)
        if (!fs.existsSync(path.join(destDir, filename))) {
          await downloadWithRetry(url, path.join(destDir, filename), signal)
        }
        const mod = modsMeta[modEntry.projectID]
        const json = getFolderAssets(folderAssetsCache, instance.id, folder)
        json.assets[filename] = {
          source: 'cf',
          cfModId: modEntry.projectID,
          cfFileId: modEntry.fileID,
          name: mod?.name ?? filename,
          slug: mod?.slug ?? '',
          logo: mod?.logo?.thumbnailUrl,
          summary: mod?.summary,
          recognized: true,
        }
      } catch (e: any) {
        if (e?.message === 'CANCELLED') throw e
        // individual file failure — skip and continue
      }
      modsDone++
      onProgress({ stage: `Descargando archivos... (${modsDone}/${modFiles.length})`, current: modsDone, total: modFiles.length, percent: 65 + Math.round((modsDone / modFiles.length) * 28) })
    })

    for (const [folder, json] of folderAssetsCache) writeAssetsJson(instance.id, folder, json)

    // 10. Identificar assets de overrides (archivos sin metadata conocida)
    onProgress({ stage: 'Identificando mods...', current: 0, total: 100, percent: 94 })
    await identifyAllFolders(instance.id)

    // 11. Guardar resolvedVersionId
    const updatedInstance: Instance = { ...instance, resolvedVersionId }
    fs.writeFileSync(path.join(instanceDir, 'instance.json'), JSON.stringify(updatedInstance, null, 2))

    onProgress({ stage: '¡Instalación completada!', current: 100, total: 100, percent: 100 })
    return updatedInstance

  } catch (err: any) {
    if (signal.aborted || err?.message === 'CANCELLED') { cleanup(); throw new Error('CANCELLED') }
    throw err
  } finally {
    if (activeController === controller) activeController = null
  }
}

// ── Modrinth modpack ──────────────────────────────────────────────────────────

export async function installModrinthModpack(
  projectId: string,
  versionId: string,
  packName: string,
  logoUrl: string | undefined,
  onProgress: (p: InstallProgress) => void,
): Promise<Instance> {
  const controller = new AbortController()
  activeController = controller
  const { signal } = controller

  const tmpMrpack = path.join(os.tmpdir(), `cw-mc-mrpack-${versionId}.mrpack`)
  const tmpExtract = path.join(os.tmpdir(), `cw-mc-mrpack-extract-${versionId}`)
  let instance: Instance | null = null

  const cleanup = () => {
    try { fs.rmSync(tmpMrpack, { force: true }) } catch {}
    try { fs.rmSync(tmpExtract, { recursive: true, force: true }) } catch {}
    if (instance) { try { deleteInstance(instance.id) } catch {} }
  }

  const check = () => { if (signal.aborted) throw new Error('CANCELLED') }

  try {
    // 1. Obtener detalles de versión
    check()
    onProgress({ stage: 'Obteniendo información del modpack...', current: 0, total: 100, percent: 0 })
    const version = await mrGetVersion(versionId)
    const primaryFile = version.files.find((f: any) => f.primary) ?? version.files[0]
    if (!primaryFile) throw new Error('No hay archivo .mrpack disponible')

    // 2. Descargar .mrpack
    check()
    onProgress({ stage: 'Descargando modpack...', current: 0, total: 100, percent: 3 })
    await downloadFile(primaryFile.url, tmpMrpack, (p) => {
      onProgress({ stage: 'Descargando modpack...', current: p.downloaded, total: p.total, percent: 3 + Math.round(p.percent * 0.18) })
    }, undefined, signal)

    // 3. Extraer
    check()
    onProgress({ stage: 'Extrayendo modpack...', current: 0, total: 100, percent: 22 })
    fs.mkdirSync(tmpExtract, { recursive: true })
    await extractZip(tmpMrpack, tmpExtract)
    fs.rmSync(tmpMrpack, { force: true })

    // 4. Parsear modrinth.index.json
    const indexPath = path.join(tmpExtract, 'modrinth.index.json')
    if (!fs.existsSync(indexPath)) throw new Error('No contiene modrinth.index.json — no es un mrpack válido')
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

    const deps: Record<string, string> = index.dependencies ?? {}
    const mcVersion: string = deps['minecraft'] ?? ''
    if (!mcVersion) throw new Error('No se encontró la versión de Minecraft en el mrpack')
    const { loader, loaderVersion } = parseMrLoader(deps)
    const packFiles: any[] = index.files ?? []

    // 5. Crear instancia
    check()
    onProgress({ stage: 'Creando instancia...', current: 0, total: 100, percent: 25 })
    instance = createInstance({
      name: packName, mcVersion, modLoader: loader, modLoaderVersion: loaderVersion,
      resolvedVersionId: mcVersion, source: 'modrinth',
      mrMeta: { projectId, versionId, name: packName, logoUrl },
    })

    const instanceDir = getInstanceDir(instance.id)
    fs.mkdirSync(path.join(instanceDir, 'mods'), { recursive: true })

    // 6. Copiar overrides
    for (const overrideDir of ['overrides', 'client-overrides']) {
      const src = path.join(tmpExtract, overrideDir)
      if (fs.existsSync(src)) {
        onProgress({ stage: `Copiando ${overrideDir}...`, current: 0, total: 100, percent: 27 })
        await fs.promises.cp(src, instanceDir, { recursive: true })
      }
    }
    fs.rmSync(tmpExtract, { recursive: true, force: true })

    // 7. Descargar Minecraft
    check()
    onProgress({ stage: 'Descargando Minecraft...', current: 0, total: 100, percent: 30 })
    await downloadVersionFiles(mcVersion, (e) => {
      onProgress({ stage: e.stage, current: e.current, total: e.total, percent: 30 + Math.round(e.percent * 0.2) })
    })

    // 8. Instalar mod loader
    const resolvedVersionId = await installModLoader(mcVersion, loader, loaderVersion, onProgress, 52)

    // 9. Descargar archivos del modpack en paralelo con metadata inline
    check()
    const clientFiles = packFiles.filter((f: any) => f.env?.client !== 'unsupported')
    const mrDownloaded: { relativePath: string; sha1: string }[] = []
    let done = 0

    await runConcurrent(clientFiles, async (packFile) => {
      check()
      try {
        const destPath = path.join(instanceDir, packFile.path)
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        if (!fs.existsSync(destPath)) {
          const url = packFile.downloads?.[0]
          if (url) await downloadWithRetry(url, destPath, signal)
        }
        if (packFile.hashes?.sha1) {
          mrDownloaded.push({ relativePath: packFile.path, sha1: packFile.hashes.sha1 })
        }
      } catch (e: any) {
        if (e?.message === 'CANCELLED') throw e
        // individual file failure — skip and continue
      }
      done++
      onProgress({ stage: `Descargando archivos del modpack... (${done}/${clientFiles.length})`, current: done, total: clientFiles.length, percent: 62 + Math.round((done / clientFiles.length) * 26) })
    })

    // 10. Identificar assets mediante batch SHA1 (una sola llamada a la API)
    onProgress({ stage: 'Identificando mods...', current: 0, total: 100, percent: 89 })
    const sha1s = mrDownloaded.map(f => f.sha1)
    const matchedVersions = await mrBatchVersionFiles(sha1s)
    const projectIdSet = [...new Set(Object.values(matchedVersions).map((v: any) => v.project_id as string))]
    const projects = await mrBatchProjects(projectIdSet)

    const mrFolderCache = new Map<string, AssetsJson>()
    for (const { relativePath, sha1 } of mrDownloaded) {
      const parts = relativePath.replace(/\\/g, '/').split('/')
      const folder = parts[0]
      const filename = parts[parts.length - 1]
      const json = getFolderAssets(mrFolderCache, instance.id, folder)
      const version = matchedVersions[sha1]
      if (version) {
        const project = projects[version.project_id]
        json.assets[filename] = {
          source: 'mr',
          mrProjectId: version.project_id,
          mrVersionId: version.id,
          mrSlug: project?.slug,
          name: project?.title ?? filename,
          slug: project?.slug ?? '',
          logo: project?.icon_url,
          summary: project?.description,
          gameVersions: version.game_versions ?? [],
          recognized: true,
        }
      } else {
        json.assets[filename] = {
          source: 'mr', name: filename, slug: '', recognized: true,
        }
      }
    }
    for (const [folder, json] of mrFolderCache) writeAssetsJson(instance.id, folder, json)

    // Identificar solo assets de overrides que no estén ya identificados
    onProgress({ stage: 'Identificando assets de overrides...', current: 0, total: 100, percent: 93 })
    await identifyAllFolders(instance.id)

    // 11. Guardar resolvedVersionId
    const updatedInstance: Instance = { ...instance, resolvedVersionId }
    fs.writeFileSync(path.join(instanceDir, 'instance.json'), JSON.stringify(updatedInstance, null, 2))

    onProgress({ stage: '¡Instalación completada!', current: 100, total: 100, percent: 100 })
    return updatedInstance

  } catch (err: any) {
    if (signal.aborted || err?.message === 'CANCELLED') { cleanup(); throw new Error('CANCELLED') }
    throw err
  } finally {
    if (activeController === controller) activeController = null
  }
}
