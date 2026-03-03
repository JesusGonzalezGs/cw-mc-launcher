/**
 * Instalación de modpacks de CurseForge para el cliente.
 * Descarga el ZIP del modpack, parsea manifest.json e instala todos los componentes.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getSettings } from '../store'
import { cfGetDownloadUrl } from './curseforgeService'
import { downloadFile } from '../utils/downloadHelper'
import { extractZip } from '../utils/platform'
import { downloadVersionFiles } from './gameDownloader'
import {
  installFabric,
  installQuilt,
  installForge,
  installNeoForge,
} from './modLoaderInstaller'
import { createInstance, getInstanceDir, getModsDir } from './instanceManager'
import type { Instance } from './instanceManager'
import type { ModLoader } from './modLoaderInstaller'

export interface InstallProgress {
  stage: string
  current: number
  total: number
  percent: number
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
  onProgress: (p: InstallProgress) => void
): Promise<Instance> {
  // 1. Obtener URL de descarga
  onProgress({ stage: 'Obteniendo URL del modpack...', current: 0, total: 100, percent: 0 })
  const downloadUrl = await cfGetDownloadUrl(modpackId, fileId)
  if (!downloadUrl) throw new Error('No se pudo obtener la URL del modpack')

  // 2. Descargar ZIP
  onProgress({ stage: 'Descargando modpack...', current: 0, total: 100, percent: 5 })
  const tmpZip = path.join(os.tmpdir(), `cw-mc-modpack-${fileId}.zip`)
  await downloadFile(downloadUrl, tmpZip, (p) => {
    onProgress({ stage: 'Descargando modpack...', current: p.downloaded, total: p.total, percent: 5 + Math.round(p.percent * 0.2) })
  })

  // 3. Extraer ZIP
  onProgress({ stage: 'Extrayendo modpack...', current: 0, total: 100, percent: 25 })
  const tmpExtract = path.join(os.tmpdir(), `cw-mc-modpack-extract-${fileId}`)
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
  onProgress({ stage: 'Creando instancia...', current: 0, total: 100, percent: 28 })
  const instance = createInstance({
    name: cfName,
    mcVersion,
    modLoader: loader,
    modLoaderVersion: loaderVersion,
    resolvedVersionId: mcVersion,
    source: 'curseforge',
    cfMeta: { modpackId, fileId, name: cfName, logoUrl: cfLogoUrl },
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

  // 9. Descargar mods del manifest
  let modsDone = 0
  for (const modEntry of modFiles) {
    try {
      const url = await cfGetDownloadUrl(modEntry.projectID, modEntry.fileID)
      if (!url) continue
      const filename = decodeURIComponent(url.split('/').pop() ?? `mod-${modEntry.fileID}.jar`)
      const destPath = path.join(modsDir, filename)
      if (!fs.existsSync(destPath)) {
        await downloadFile(url, destPath)
      }
    } catch { /* continuar con el siguiente mod */ }

    modsDone++
    onProgress({
      stage: 'Descargando mods...',
      current: modsDone,
      total: modFiles.length,
      percent: 65 + Math.round((modsDone / modFiles.length) * 30),
    })
  }

  // 10. Actualizar instancia con resolvedVersionId
  const settings = getSettings()
  const updatedInstance: Instance = {
    ...instance,
    resolvedVersionId,
  }
  const cfgPath = path.join(instanceDir, 'instance.json')
  fs.writeFileSync(cfgPath, JSON.stringify(updatedInstance, null, 2))

  onProgress({ stage: '¡Instalación completada!', current: 100, total: 100, percent: 100 })
  return updatedInstance
}
