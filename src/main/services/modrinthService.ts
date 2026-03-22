/**
 * Servicio para la API pública de Modrinth.
 */
import path from 'path'
import fs from 'fs'
import os from 'os'
import { getInstanceDir, createInstance, deleteInstance, getInstance } from './instanceManager'
import { downloadFile } from '../utils/downloadHelper'
import { extractZip } from '../utils/platform'
import { downloadVersionFiles } from './gameDownloader'
import { installFabric, installQuilt, installForge, installNeoForge } from './modLoaderInstaller'
import { identifyMods } from './modManager'
import { identifyFiles } from './fileManager'
import type { Instance } from './instanceManager'
import type { ModLoader } from './modLoaderInstaller'
import type { InstallProgress } from './modpackInstaller'

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

export interface MrInstallResult {
  ok: boolean
  filename: string
  depsInstalled: { filename: string; name: string }[]
  depsFailed: { slug: string; error: string }[]
}

export async function mrInstallVersion(
  instanceId: string,
  versionId: string,
  folder: string = 'mods',
  mrSlug?: string,
): Promise<MrInstallResult> {
  const depsInstalled: { filename: string; name: string }[] = []
  const depsFailed: { slug: string; error: string }[] = []
  const result = await _mrInstallVersionInternal(
    instanceId, versionId, folder, mrSlug, new Set(), depsInstalled, depsFailed,
  )
  return { ok: true, filename: result.filename, depsInstalled, depsFailed }
}

async function _mrInstallVersionInternal(
  instanceId: string,
  versionId: string,
  folder: string,
  mrSlug: string | undefined,
  seen: Set<string>,
  depsInstalled: { filename: string; name: string }[],
  depsFailed: { slug: string; error: string }[],
): Promise<{ filename: string }> {
  const version = await mrGetVersion(versionId)
  const primaryFile = version.files.find((f: any) => f.primary) ?? version.files[0]
  if (!primaryFile) throw new Error('No hay archivos en esta versión de Modrinth')

  const instanceDir = getInstanceDir(instanceId)
  const targetDir = path.join(instanceDir, folder)
  fs.mkdirSync(targetDir, { recursive: true })

  const dest = path.join(targetDir, primaryFile.filename)
  await downloadFile(primaryFile.url, dest)

  // Pre-write minimal metadata immediately so the file watcher doesn't trigger identifyMods.
  // Do NOT include mrSlug here — the cleanup loop below matches by mrSlug and would delete
  // the just-downloaded file if it found its own entry.
  if (mrSlug && folder === 'mods') {
    const { readModsJson: rMJ, writeModsJson: wMJ } = await import('./modManager')
    const preJson = rMJ(instanceId)
    if (!preJson.mods[primaryFile.filename]) {
      preJson.mods[primaryFile.filename] = {
        modId: 0, fileId: 0, name: mrSlug, slug: '',
        mrVersionId: version.id, gameVersions: version.game_versions ?? [],
        recognized: true, mrResolved: true,
      }
      wMJ(instanceId, preJson)
    }
  }

  if (mrSlug) {
    let projectTitle = mrSlug
    let logo: string | undefined
    let summary: string | undefined
    try {
      const project = await mrGetProject(version.project_id)
      projectTitle = project.title ?? mrSlug
      logo = project.icon_url
      summary = project.description
    } catch {}

    if (folder === 'mods') {
      const { readModsJson, writeModsJson } = await import('./modManager')
      const modsJson = readModsJson(instanceId)
      // Remove old version with the same mrSlug
      for (const [existingFilename, meta] of Object.entries(modsJson.mods)) {
        if (meta.mrSlug !== mrSlug) continue
        const cleanName = existingFilename.replace('.jar.disabled', '.jar')
        for (const f of [cleanName, cleanName.replace('.jar', '.jar.disabled')]) {
          try { fs.rmSync(path.join(targetDir, f), { force: true }) } catch {}
        }
        delete modsJson.mods[cleanName]
        delete modsJson.mods[cleanName.replace('.jar', '.jar.disabled')]
      }
      modsJson.mods[primaryFile.filename] = {
        modId: 0, fileId: 0,
        name: projectTitle, slug: '', mrSlug, mrVersionId: version.id, logo, summary,
        gameVersions: version.game_versions ?? [],
        recognized: true,
        mrResolved: true,
      }
      writeModsJson(instanceId, modsJson)
    } else {
      const { readFilesJson, writeFilesJson } = await import('./fileManager')
      const filesJson = readFilesJson(instanceId, folder)
      // Remove old version with the same mrSlug
      for (const [existingFilename, meta] of Object.entries(filesJson.files)) {
        if ((meta as any).mrSlug !== mrSlug) continue
        const cleanName = existingFilename.replace('.disabled', '')
        for (const f of [cleanName, cleanName + '.disabled']) {
          try { fs.rmSync(path.join(targetDir, f), { force: true }) } catch {}
        }
        delete filesJson.files[cleanName]
        delete filesJson.files[cleanName + '.disabled']
      }
      filesJson.files[primaryFile.filename] = {
        modId: 0, fileId: 0,
        name: projectTitle, slug: '', mrSlug, mrVersionId: version.id, logo, summary,
        recognized: true,
      }
      writeFilesJson(instanceId, folder, filesJson)
    }
  }

  // Install required dependencies (only for mods folder)
  if (folder === 'mods') {
    const requiredDeps: any[] = (version.dependencies ?? []).filter(
      (d: any) => d.dependency_type === 'required' && d.project_id,
    )
    if (requiredDeps.length > 0) {
      const { readModsJson } = await import('./modManager')
      const instance = getInstance(instanceId)

      for (const dep of requiredDeps) {
        const projectId: string = dep.project_id
        if (seen.has(projectId)) continue
        seen.add(projectId)

        try {
          const project = await mrGetProject(projectId)
          const depSlug: string = project.slug

          const modsJson = readModsJson(instanceId)
          const alreadyInstalled = Object.values(modsJson.mods).some(m => m.mrSlug === depSlug)
          if (alreadyInstalled) continue

          let depVersionId: string = dep.version_id
          if (!depVersionId) {
            const gameVersions = instance?.mcVersion ? [instance.mcVersion] : undefined
            const loaders =
              instance?.modLoader && instance.modLoader !== 'vanilla'
                ? [instance.modLoader]
                : undefined
            const depVersions = await mrGetProjectVersions(projectId, gameVersions, loaders)
            if (depVersions.length === 0) {
              depsFailed.push({ slug: depSlug, error: 'Sin versiones compatibles' })
              continue
            }
            depVersionId = depVersions[0].id
          }

          const depResult = await _mrInstallVersionInternal(
            instanceId, depVersionId, 'mods', depSlug, seen, depsInstalled, depsFailed,
          )
          depsInstalled.push({ filename: depResult.filename, name: project.title ?? depSlug })
        } catch (err: any) {
          const project = await mrGetProject(dep.project_id).catch(() => null)
          const slug = project?.slug ?? dep.project_id
          depsFailed.push({ slug, error: err?.message ?? 'Error desconocido' })
        }
      }
    }
  }

  return { filename: primaryFile.filename }
}

/** Parses Modrinth dependency key into ModLoader */
function mrParseLoader(deps: Record<string, string>): { loader: ModLoader; loaderVersion: string } {
  if (deps['fabric-loader']) return { loader: 'fabric', loaderVersion: deps['fabric-loader'] }
  if (deps['quilt-loader']) return { loader: 'quilt', loaderVersion: deps['quilt-loader'] }
  if (deps['neoforge']) return { loader: 'neoforge', loaderVersion: deps['neoforge'] }
  if (deps['forge']) return { loader: 'forge', loaderVersion: deps['forge'] }
  return { loader: 'vanilla', loaderVersion: '' }
}

let mrActiveController: AbortController | null = null

export function cancelMrInstall(): void {
  mrActiveController?.abort()
}

export async function mrInstallModpack(
  projectId: string,
  versionId: string,
  packName: string,
  logoUrl: string | undefined,
  onProgress: (p: InstallProgress) => void,
): Promise<Instance> {
  const controller = new AbortController()
  mrActiveController = controller
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
    // 1. Get version details
    check()
    onProgress({ stage: 'Obteniendo información del modpack...', current: 0, total: 100, percent: 0 })
    const version = await mrGetVersion(versionId)
    const primaryFile = version.files.find((f: any) => f.primary) ?? version.files[0]
    if (!primaryFile) throw new Error('No hay archivo .mrpack disponible')

    // 2. Download .mrpack
    check()
    onProgress({ stage: 'Descargando modpack...', current: 0, total: 100, percent: 3 })
    await downloadFile(primaryFile.url, tmpMrpack, (p) => {
      onProgress({ stage: 'Descargando modpack...', current: p.downloaded, total: p.total, percent: 3 + Math.round(p.percent * 0.18) })
    }, undefined, signal)

    // 3. Extract
    check()
    onProgress({ stage: 'Extrayendo modpack...', current: 0, total: 100, percent: 22 })
    fs.mkdirSync(tmpExtract, { recursive: true })
    await extractZip(tmpMrpack, tmpExtract)
    fs.rmSync(tmpMrpack, { force: true })

    // 4. Parse modrinth.index.json
    const indexPath = path.join(tmpExtract, 'modrinth.index.json')
    if (!fs.existsSync(indexPath)) throw new Error('No contiene modrinth.index.json — no es un mrpack válido')
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

    const deps: Record<string, string> = index.dependencies ?? {}
    const mcVersion: string = deps['minecraft'] ?? ''
    if (!mcVersion) throw new Error('No se encontró la versión de Minecraft en el mrpack')
    const { loader, loaderVersion } = mrParseLoader(deps)
    const packFiles: any[] = index.files ?? []

    // 5. Create instance
    check()
    onProgress({ stage: 'Creando instancia...', current: 0, total: 100, percent: 25 })
    instance = createInstance({
      name: packName,
      mcVersion,
      modLoader: loader,
      modLoaderVersion: loaderVersion,
      resolvedVersionId: mcVersion,
      source: 'modrinth',
      mrMeta: { projectId, versionId, name: packName, logoUrl },
    })

    const instanceDir = getInstanceDir(instance.id)
    fs.mkdirSync(path.join(instanceDir, 'mods'), { recursive: true })

    // 6. Copy overrides
    for (const overrideDir of ['overrides', 'client-overrides']) {
      const src = path.join(tmpExtract, overrideDir)
      if (fs.existsSync(src)) {
        onProgress({ stage: `Copiando ${overrideDir}...`, current: 0, total: 100, percent: 27 })
        await fs.promises.cp(src, instanceDir, { recursive: true })
      }
    }
    fs.rmSync(tmpExtract, { recursive: true, force: true })

    // 7. Download Minecraft files
    check()
    onProgress({ stage: 'Descargando Minecraft...', current: 0, total: 100, percent: 30 })
    await downloadVersionFiles(mcVersion, (e) => {
      onProgress({ stage: e.stage, current: e.current, total: e.total, percent: 30 + Math.round(e.percent * 0.2) })
    })

    // 8. Install mod loader
    onProgress({ stage: `Instalando ${loader}...`, current: 0, total: 100, percent: 52 })
    let resolvedVersionId = mcVersion
    if (loader === 'fabric') {
      resolvedVersionId = await installFabric(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 54 }))
    } else if (loader === 'quilt') {
      resolvedVersionId = await installQuilt(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 54 }))
    } else if (loader === 'forge') {
      await installForge(mcVersion, `${mcVersion}-${loaderVersion}`, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 54 }))
      resolvedVersionId = `${mcVersion}-forge-${loaderVersion}`
    } else if (loader === 'neoforge') {
      await installNeoForge(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 54 }))
      resolvedVersionId = `neoforge-${loaderVersion}`
    }

    // 9. Download pack files
    check()
    const clientFiles = packFiles.filter(f => f.env?.client !== 'unsupported')
    let done = 0
    for (const packFile of clientFiles) {
      check()
      try {
        const relPath: string = packFile.path
        const destPath = path.join(instanceDir, relPath)
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        if (!fs.existsSync(destPath)) {
          const url = packFile.downloads?.[0]
          if (url) await downloadFile(url, destPath, undefined, undefined, signal)
        }
      } catch (e: any) {
        if (e?.message === 'CANCELLED') throw e
      }
      done++
      onProgress({
        stage: 'Descargando archivos del modpack...',
        current: done,
        total: clientFiles.length,
        percent: 62 + Math.round((done / clientFiles.length) * 28),
      })
    }

    // 10. Identify mods and resources
    onProgress({ stage: 'Identificando mods...', current: 0, total: 100, percent: 92 })
    await identifyMods(instance.id).catch(() => {})
    await Promise.all([
      identifyFiles(instance.id, 'resourcepacks').catch(() => {}),
      identifyFiles(instance.id, 'shaderpacks').catch(() => {}),
      identifyFiles(instance.id, 'datapacks').catch(() => {}),
    ])

    // 11. Save resolvedVersionId
    const updatedInstance: Instance = { ...instance, resolvedVersionId }
    fs.writeFileSync(path.join(instanceDir, 'instance.json'), JSON.stringify(updatedInstance, null, 2))

    onProgress({ stage: '¡Instalación completada!', current: 100, total: 100, percent: 100 })
    return updatedInstance

  } catch (err: any) {
    if (signal.aborted || err?.message === 'CANCELLED') {
      cleanup()
      throw new Error('CANCELLED')
    }
    throw err
  } finally {
    if (mrActiveController === controller) mrActiveController = null
  }
}
