/**
 * Descarga de archivos de juego de Minecraft desde la API de Mojang.
 * Maneja: version manifest, client.jar, libraries y assets.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { getSettings } from '../store'
import { downloadFile } from '../utils/downloadHelper'
import { isWindows } from '../utils/platform'

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

export interface McVersion {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  releaseTime: string
}

export interface McVersionManifest {
  latest: { release: string; snapshot: string }
  versions: McVersion[]
}

export interface DownloadProgressEvent {
  stage: string
  current: number
  total: number
  percent: number
}

let manifestCache: McVersionManifest | null = null

export async function getMcVersionManifest(): Promise<McVersionManifest> {
  if (manifestCache) return manifestCache
  const resp = await fetch(VERSION_MANIFEST_URL)
  if (!resp.ok) throw new Error(`Error obteniendo version manifest: ${resp.status}`)
  manifestCache = (await resp.json()) as McVersionManifest
  return manifestCache!
}

export async function getMcVersionJson(versionId: string): Promise<any> {
  const manifest = await getMcVersionManifest()
  const entry = manifest.versions.find((v) => v.id === versionId)
  if (!entry) throw new Error(`Versión de Minecraft no encontrada: ${versionId}`)

  const resp = await fetch(entry.url)
  if (!resp.ok) throw new Error(`Error obteniendo version JSON: ${resp.status}`)
  return resp.json()
}

function sha1(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha1').update(buf).digest('hex')
}

function needsDownload(filePath: string, expectedSha1?: string): boolean {
  if (!fs.existsSync(filePath)) return true
  if (expectedSha1 && sha1(filePath) !== expectedSha1) return true
  return false
}

export async function downloadVersionFiles(
  versionId: string,
  onProgress?: (e: DownloadProgressEvent) => void
): Promise<void> {
  const settings = getSettings()
  const assetsDir = settings.assetsDir
  const versionJson = await getMcVersionJson(versionId)

  // Directorios base
  const versionsDir = path.join(assetsDir, '..', 'versions')
  const librariesDir = path.join(assetsDir, '..', 'libraries')
  fs.mkdirSync(assetsDir, { recursive: true })
  fs.mkdirSync(versionsDir, { recursive: true })
  fs.mkdirSync(librariesDir, { recursive: true })

  // 1. Guardar el version JSON
  const versionDir = path.join(versionsDir, versionId)
  fs.mkdirSync(versionDir, { recursive: true })
  fs.writeFileSync(
    path.join(versionDir, `${versionId}.json`),
    JSON.stringify(versionJson, null, 2)
  )

  // 2. Descargar client.jar
  const clientDl = versionJson.downloads?.client
  if (clientDl) {
    const clientJar = path.join(versionDir, `${versionId}.jar`)
    if (needsDownload(clientJar, clientDl.sha1)) {
      onProgress?.({ stage: 'Descargando cliente de Minecraft', current: 0, total: 1, percent: 0 })
      await downloadFile(clientDl.url, clientJar, (p) => {
        onProgress?.({ stage: 'Descargando cliente de Minecraft', current: p.downloaded, total: p.total, percent: p.percent })
      })
    }
  }

  // 3. Descargar libraries
  const libraries: any[] = versionJson.libraries ?? []
  const validLibs = libraries.filter((lib) => {
    if (!lib.rules) return true
    return lib.rules.some((rule: any) => {
      if (rule.action !== 'allow') return false
      if (!rule.os) return true
      const currentOs = isWindows ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
      return rule.os.name === currentOs
    })
  })

  const currentOs = isWindows ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
  let libsDone = 0
  for (const lib of validLibs) {
    // Descargar artefacto principal
    const artifact = lib.downloads?.artifact
    if (artifact) {
      const libPath = path.join(librariesDir, artifact.path)
      fs.mkdirSync(path.dirname(libPath), { recursive: true })
      if (needsDownload(libPath, artifact.sha1)) {
        await downloadFile(artifact.url, libPath)
      }
    }

    // Descargar JAR de nativos (classifiers) para el OS actual
    const nativeKey = lib.natives?.[currentOs]?.replace('${arch}', process.arch === 'x64' ? '64' : '32')
    if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
      const native = lib.downloads.classifiers[nativeKey]
      const nativePath = path.join(librariesDir, native.path)
      fs.mkdirSync(path.dirname(nativePath), { recursive: true })
      if (needsDownload(nativePath, native.sha1)) {
        await downloadFile(native.url, nativePath)
      }
    }

    libsDone++
    onProgress?.({
      stage: 'Descargando librerías',
      current: libsDone,
      total: validLibs.length,
      percent: Math.round((libsDone / validLibs.length) * 100),
    })
  }

  // 4. Descargar asset index
  const assetIndex = versionJson.assetIndex
  if (assetIndex) {
    const indexDir = path.join(assetsDir, 'indexes')
    fs.mkdirSync(indexDir, { recursive: true })
    const indexFile = path.join(indexDir, `${assetIndex.id}.json`)

    if (needsDownload(indexFile, assetIndex.sha1)) {
      await downloadFile(assetIndex.url, indexFile)
    }

    // 5. Descargar assets
    const indexData = JSON.parse(fs.readFileSync(indexFile, 'utf-8'))
    const objects = Object.entries(indexData.objects ?? {}) as [string, { hash: string; size: number }][]

    let assetsDone = 0
    for (const [, obj] of objects) {
      const prefix = obj.hash.substring(0, 2)
      const objDir = path.join(assetsDir, 'objects', prefix)
      fs.mkdirSync(objDir, { recursive: true })
      const objPath = path.join(objDir, obj.hash)

      if (!fs.existsSync(objPath)) {
        const url = `https://resources.download.minecraft.net/${prefix}/${obj.hash}`
        try { await downloadFile(url, objPath) } catch { /* continuar */ }
      }

      assetsDone++
      if (assetsDone % 50 === 0) {
        onProgress?.({
          stage: 'Descargando assets',
          current: assetsDone,
          total: objects.length,
          percent: Math.round((assetsDone / objects.length) * 100),
        })
      }
    }

    onProgress?.({ stage: 'Assets completos', current: objects.length, total: objects.length, percent: 100 })
  }
}

export function getVersionJsonPath(versionId: string): string {
  const settings = getSettings()
  return path.join(settings.assetsDir, '..', 'versions', versionId, `${versionId}.json`)
}

export function isVersionDownloaded(versionId: string): boolean {
  return fs.existsSync(getVersionJsonPath(versionId))
}
