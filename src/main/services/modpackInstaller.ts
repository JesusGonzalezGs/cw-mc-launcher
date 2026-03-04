/**
 * Instalación de modpacks de CurseForge para el cliente.
 * Descarga el ZIP del modpack, parsea manifest.json e instala todos los componentes.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getSettings } from '../store'
import { cfGetDownloadUrl, cfGetModsBatch } from './curseforgeService'
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
import { identifyMods } from './modManager'
import { identifyFiles } from './fileManager'

export interface InstallProgress {
  stage: string
  current: number
  total: number
  percent: number
}

let activeController: AbortController | null = null

export function cancelInstall(): void {
  activeController?.abort()
}

/** Parses "fabric-0.15.11" → { loader: 'fabric', version: '0.15.11' } */
function parseModLoaderString(id: string): { loader: ModLoader; version: string } {
  if (id.startsWith('fabric-')) return { loader: 'fabric', version: id.slice(7) }
  if (id.startsWith('quilt-')) return { loader: 'quilt', version: id.slice(6) }
  if (id.startsWith('neoforge-')) return { loader: 'neoforge', version: id.slice(9) }
  if (id.startsWith('forge-')) return { loader: 'forge', version: id.slice(6) }
  return { loader: 'vanilla', version: '' }
}

export async function installCurseForgeModpack(
  modpackId: number,
  fileId: number,
  cfName: string,
  cfLogoUrl: string | undefined,
  onProgress: (p: InstallProgress) => void,
  cfFileVersion?: string,
  cfSlug?: string
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
    if (instance) {
      try { deleteInstance(instance.id) } catch {}
    }
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
  const { loader, version: loaderVersion } = parseModLoaderString(rawLoader)
  const modFiles: { projectID: number; fileID: number }[] = manifest.files ?? []

  // 5. Crear instancia
  check()
  onProgress({ stage: 'Creando instancia...', current: 0, total: 100, percent: 28 })
  instance = createInstance({
    name: cfName,
    mcVersion,
    modLoader: loader,
    modLoaderVersion: loaderVersion,
    resolvedVersionId: mcVersion,
    source: 'curseforge',
    cfMeta: { modpackId, fileId, name: cfName, logoUrl: cfLogoUrl, fileVersion: cfFileVersion, slug: cfSlug },
  })

  const instanceDir = getInstanceDir(instance.id)
  const modsDir = getModsDir(instance.id)
  fs.mkdirSync(modsDir, { recursive: true })

  // 6. Copiar overrides
  const overridesDir = path.join(tmpExtract, 'overrides')
  if (fs.existsSync(overridesDir)) {
    onProgress({ stage: 'Copiando overrides...', current: 0, total: 100, percent: 30 })
    await fs.promises.cp(overridesDir, instanceDir, { recursive: true })
  }

  fs.rmSync(tmpExtract, { recursive: true, force: true })

  // 7. Descargar archivos de Minecraft
  check()
  onProgress({ stage: 'Descargando Minecraft...', current: 0, total: 100, percent: 33 })
  await downloadVersionFiles(mcVersion, (e) => {
    onProgress({ stage: e.stage, current: e.current, total: e.total, percent: 33 + Math.round(e.percent * 0.2) })
  })

  // 8. Instalar mod loader
  onProgress({ stage: `Instalando ${loader}...`, current: 0, total: 100, percent: 55 })
  let resolvedVersionId = mcVersion
  if (loader === 'fabric') {
    resolvedVersionId = await installFabric(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 57 }))
  } else if (loader === 'quilt') {
    resolvedVersionId = await installQuilt(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 57 }))
  } else if (loader === 'forge') {
    await installForge(mcVersion, `${mcVersion}-${loaderVersion}`, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 57 }))
    resolvedVersionId = `${mcVersion}-forge-${loaderVersion}`
  } else if (loader === 'neoforge') {
    await installNeoForge(mcVersion, loaderVersion, (msg) => onProgress({ stage: msg, current: 0, total: 100, percent: 57 }))
    resolvedVersionId = `neoforge-${loaderVersion}`
  }

  // 9. Clasificar archivos del manifest por classId
  check()
  onProgress({ stage: 'Clasificando archivos...', current: 0, total: 100, percent: 63 })
  const CLASS_FOLDER: Record<number, string> = {
    6:    'mods',
    12:   'resourcepacks',
    6552: 'shaderpacks',
    6945: 'datapacks',
  }
  const projectIds = [...new Set(modFiles.map(f => f.projectID))]
  const modsMeta = await cfGetModsBatch(projectIds).catch(() => ({} as Record<number, any>))

  // 10. Descargar archivos al directorio correcto
  check()
  let modsDone = 0
  for (const modEntry of modFiles) {
    check()
    try {
      const classId: number = modsMeta[modEntry.projectID]?.classId ?? 6
      const folder = CLASS_FOLDER[classId] ?? 'mods'
      const destDir = path.join(instanceDir, folder)
      fs.mkdirSync(destDir, { recursive: true })

      const url = await cfGetDownloadUrl(modEntry.projectID, modEntry.fileID)
      if (!url) continue
      const filename = decodeURIComponent(url.split('/').pop() ?? `file-${modEntry.fileID}`)
      const destPath = path.join(destDir, filename)
      if (!fs.existsSync(destPath)) {
        await downloadFile(url, destPath, undefined, undefined, signal)
      }
    } catch (e: any) {
      if (e?.message === 'CANCELLED') throw e
      /* continuar con el siguiente archivo */
    }

    modsDone++
    onProgress({
      stage: 'Descargando archivos...',
      current: modsDone,
      total: modFiles.length,
      percent: 65 + Math.round((modsDone / modFiles.length) * 28),
    })
  }

  // 11. Identificar mods y recursos
  onProgress({ stage: 'Identificando mods...', current: 0, total: 100, percent: 94 })
  await identifyMods(instance.id).catch(() => {})
  await Promise.all([
    identifyFiles(instance.id, 'resourcepacks').catch(() => {}),
    identifyFiles(instance.id, 'shaderpacks').catch(() => {}),
    identifyFiles(instance.id, 'datapacks').catch(() => {}),
  ])

  // 12. Actualizar instancia con resolvedVersionId
  const settings = getSettings()
  const updatedInstance: Instance = {
    ...instance,
    resolvedVersionId,
  }
  const cfgPath = path.join(instanceDir, 'instance.json')
  fs.writeFileSync(cfgPath, JSON.stringify(updatedInstance, null, 2))

  onProgress({ stage: '¡Instalación completada!', current: 100, total: 100, percent: 100 })
  return updatedInstance

  } catch (err: any) {
    if (signal.aborted || err?.message === 'CANCELLED') {
      cleanup()
      throw new Error('CANCELLED')
    }
    throw err
  } finally {
    if (activeController === controller) activeController = null
  }
}
