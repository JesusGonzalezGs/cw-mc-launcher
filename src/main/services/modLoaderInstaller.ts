/**
 * Instaladores de mod loaders para el cliente de Minecraft:
 * Fabric, Quilt, Forge, NeoForge
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getSettings } from '../store'
import { isWindows, spawnWithOutput } from '../utils/platform'
import { downloadFile } from '../utils/downloadHelper'
import { getMcJavaVersion, getJavaExe, isJavaReady } from './javaManager'

/** Recursively counts .jar files in a directory (used to track installer progress). */
function countJars(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let n = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) n += countJars(path.join(dir, entry.name))
      else if (entry.name.endsWith('.jar')) n++
    }
  } catch { /* ignore permission errors */ }
  return n
}

/** Returns a human-readable elapsed time string like "2m 5s" or "45s". */
function elapsedStr(startMs: number): string {
  const s = Math.round((Date.now() - startMs) / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

/** Verifies a downloaded file is a structurally complete ZIP/JAR. */
function assertValidJar(jarPath: string, label: string): void {
  const size = fs.statSync(jarPath).size
  if (size < 1024) {
    throw new Error(`El instalador de ${label} descargado es inválido (${size} bytes).`)
  }
  // Check ZIP start magic (PK)
  const magic = Buffer.alloc(4)
  const fd = fs.openSync(jarPath, 'r')
  fs.readSync(fd, magic, 0, 4, 0)
  // Check ZIP End-of-Central-Directory record in last 64 KB
  const eocdBufSize = Math.min(size, 65_558)
  const eocdBuf = Buffer.alloc(eocdBufSize)
  fs.readSync(fd, eocdBuf, 0, eocdBufSize, size - eocdBufSize)
  fs.closeSync(fd)

  if (magic[0] !== 0x50 || magic[1] !== 0x4b) {
    throw new Error(`El archivo descargado no es un JAR válido para ${label}. El servidor devolvió contenido inesperado.`)
  }
  let eocdFound = false
  for (let i = eocdBufSize - 22; i >= 0; i--) {
    if (eocdBuf[i] === 0x50 && eocdBuf[i + 1] === 0x4b && eocdBuf[i + 2] === 0x05 && eocdBuf[i + 3] === 0x06) {
      eocdFound = true
      break
    }
  }
  if (!eocdFound) {
    throw new Error(`El instalador de ${label} está truncado o corrupto (sin registro EOCD). Inténtalo de nuevo.`)
  }
}

export type ModLoader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge'

export interface LoaderVersion {
  id: string
  stable: boolean
}

export async function getFabricLoaderVersions(): Promise<LoaderVersion[]> {
  const resp = await fetch('https://meta.fabricmc.net/v2/versions/loader')
  if (!resp.ok) throw new Error(`Fabric meta error: ${resp.status}`)
  const data = (await resp.json()) as any[]
  return data.map((v: any) => ({ id: v.version, stable: v.stable }))
}

export async function getQuiltLoaderVersions(): Promise<LoaderVersion[]> {
  const resp = await fetch('https://meta.quiltmc.org/v3/versions/loader')
  if (!resp.ok) throw new Error(`Quilt meta error: ${resp.status}`)
  const data = (await resp.json()) as any[]
  return data.map((v: any) => ({ id: v.version, stable: true }))
}

export async function getForgeVersions(mcVersion: string): Promise<string[]> {
  const resp = await fetch(`https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json`)
  if (!resp.ok) return []
  const data = (await resp.json()) as any
  const recommended = data.promos[`${mcVersion}-recommended`]
  const latest = data.promos[`${mcVersion}-latest`]
  const versions: string[] = []
  if (recommended) versions.push(`${mcVersion}-${recommended}`)
  if (latest && latest !== recommended) versions.push(`${mcVersion}-${latest}`)
  return versions
}

export async function getNeoForgeVersions(mcVersion: string): Promise<string[]> {
  try {
    // NeoForge >= 1.20.2 cambia el esquema de versiones
    const [, minor] = mcVersion.split('.').map(Number)
    if (minor < 20) return []

    const resp = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')
    if (!resp.ok) return []
    const data = (await resp.json()) as any
    const all: string[] = data.versions ?? []
    // Filtrar versiones relevantes al mcVersion (ej. "21.1.x" para 1.21.1)
    const mcMinor = mcVersion.split('.').slice(1).join('.')
    return all.filter((v) => v.startsWith(mcMinor)).reverse().slice(0, 5)
  } catch {
    return []
  }
}

function getJavaForMc(mcVersion: string): string {
  const ver = getMcJavaVersion(mcVersion)
  if (isJavaReady(ver)) return getJavaExe(ver)
  return isWindows ? 'java.exe' : 'java'
}

function mavenCoordToRelPath(name: string): string {
  const parts = name.split(':')
  const groupPath = parts[0].split('.').join('/')
  const artifactId = parts[1]
  const version = parts[2]
  const classifier = parts[3] ? `-${parts[3]}` : ''
  return `${groupPath}/${artifactId}/${version}/${artifactId}-${version}${classifier}.jar`
}

async function downloadLoaderLibraries(
  libraries: any[],
  librariesDir: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  for (const lib of libraries) {
    if (lib.downloads?.artifact) continue // Already downloaded by vanilla downloader
    if (!lib.name) continue

    const relPath = mavenCoordToRelPath(lib.name)
    const libPath = path.join(librariesDir, relPath.split('/').join(path.sep))
    if (fs.existsSync(libPath)) continue

    const baseUrl = (lib.url ?? 'https://libraries.minecraft.net/').replace(/\/$/, '')
    const url = `${baseUrl}/${relPath}`
    fs.mkdirSync(path.dirname(libPath), { recursive: true })
    onProgress?.(`Descargando ${lib.name}`)
    await downloadFile(url, libPath)
  }
}

/** Downloads any libraries listed in a Forge/NeoForge version JSON that are missing from disk. */
async function downloadMissingVersionLibraries(
  versionJsonPath: string,
  librariesDir: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  if (!fs.existsSync(versionJsonPath)) return
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'))
  for (const lib of versionJson.libraries ?? []) {
    // Standard format with download URL
    const artifact = lib.downloads?.artifact
    if (artifact?.url && artifact?.path) {
      const libPath = path.join(librariesDir, artifact.path.split('/').join(path.sep))
      if (!fs.existsSync(libPath)) {
        onProgress?.(`Descargando ${lib.name ?? artifact.path}`)
        fs.mkdirSync(path.dirname(libPath), { recursive: true })
        try { await downloadFile(artifact.url, libPath) } catch (e: any) {
          console.warn(`Warning: could not download ${lib.name}: ${e.message}`)
        }
      }
      continue
    }
    // Maven coordinate format with url
    if (lib.name && lib.url) {
      const relPath = mavenCoordToRelPath(lib.name)
      const libPath = path.join(librariesDir, relPath.split('/').join(path.sep))
      if (!fs.existsSync(libPath)) {
        const baseUrl = (lib.url as string).replace(/\/$/, '')
        onProgress?.(`Descargando ${lib.name}`)
        fs.mkdirSync(path.dirname(libPath), { recursive: true })
        try { await downloadFile(`${baseUrl}/${relPath}`, libPath) } catch (e: any) {
          console.warn(`Warning: could not download ${lib.name}: ${e.message}`)
        }
      }
    }
  }
}

export async function installFabric(
  mcVersion: string,
  loaderVersion: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const settings = getSettings()
  const versionsDir = path.join(settings.assetsDir, '..', 'versions')
  const librariesDir = path.join(settings.assetsDir, '..', 'libraries')

  onProgress?.('Obteniendo perfil de Fabric...')
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`
  const resp = await fetch(profileUrl)
  if (!resp.ok) throw new Error(`Fabric profile error: ${resp.status}`)
  const profile = (await resp.json()) as any

  const fabricVersionId = profile.id
  const fabricVersionDir = path.join(versionsDir, fabricVersionId)
  fs.mkdirSync(fabricVersionDir, { recursive: true })
  fs.writeFileSync(
    path.join(fabricVersionDir, `${fabricVersionId}.json`),
    JSON.stringify(profile, null, 2)
  )

  onProgress?.('Descargando librerías de Fabric...')
  await downloadLoaderLibraries(profile.libraries ?? [], librariesDir, onProgress)

  onProgress?.('Fabric instalado correctamente')
  return fabricVersionId
}

export async function installQuilt(
  mcVersion: string,
  loaderVersion: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const settings = getSettings()
  const versionsDir = path.join(settings.assetsDir, '..', 'versions')
  const librariesDir = path.join(settings.assetsDir, '..', 'libraries')

  onProgress?.('Obteniendo perfil de Quilt...')
  const profileUrl = `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`
  const resp = await fetch(profileUrl)
  if (!resp.ok) throw new Error(`Quilt profile error: ${resp.status}`)
  const profile = (await resp.json()) as any

  const quiltVersionId = profile.id
  const quiltVersionDir = path.join(versionsDir, quiltVersionId)
  fs.mkdirSync(quiltVersionDir, { recursive: true })
  fs.writeFileSync(
    path.join(quiltVersionDir, `${quiltVersionId}.json`),
    JSON.stringify(profile, null, 2)
  )

  onProgress?.('Descargando librerías de Quilt...')
  await downloadLoaderLibraries(profile.libraries ?? [], librariesDir, onProgress)

  onProgress?.('Quilt instalado correctamente')
  return quiltVersionId
}

export async function installForge(
  mcVersion: string,
  forgeVersion: string,
  onProgress?: (msg: string, percent: number) => void
): Promise<string> {
  const settings = getSettings()
  const javaExe = getJavaForMc(mcVersion)
  const gameDir = path.resolve(path.join(settings.assetsDir, '..'))
  const versionsDir = path.join(gameDir, 'versions')

  // Snapshot de versiones existentes para detectar la nueva después de instalar
  const existingVersions = new Set(fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [])

  onProgress?.('Descargando instalador de Forge...', 0)
  const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`
  const tmpJar = path.join(os.tmpdir(), `forge-${forgeVersion}-installer.jar`)

  // Eliminar instalador previo que pudo haber quedado corrupto
  if (fs.existsSync(tmpJar)) fs.rmSync(tmpJar, { force: true })

  await downloadFile(installerUrl, tmpJar, (p) => {
    onProgress?.(`Descargando Forge: ${p.percent}%`, Math.round(p.percent * 0.6))
  })

  try {
    assertValidJar(tmpJar, `Forge ${forgeVersion}`)
  } catch (e) {
    fs.rmSync(tmpJar, { force: true })
    throw e
  }

  // Forge necesita launcher_profiles.json para validar el directorio de instalación
  const profilesPath = path.join(gameDir, 'launcher_profiles.json')
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {}, selectedProfile: '' }))
  }

  onProgress?.('Ejecutando instalador de Forge...', 65)
  const librariesDir = path.join(gameDir, 'libraries')
  fs.mkdirSync(librariesDir, { recursive: true })
  const startMs = Date.now()
  let lastJarCount = countJars(librariesDir)
  const heartbeat = setInterval(() => {
    const jars = countJars(librariesDir)
    const time = elapsedStr(startMs)
    if (jars > lastJarCount) {
      lastJarCount = jars
      onProgress?.(`Descargando bibliotecas de Forge... (${jars} JARs, ${time})`, 75)
    } else {
      onProgress?.(`Instalando Forge, por favor espera... (${time})`, 75)
    }
  }, 2000)
  try {
    await spawnWithOutput(
      javaExe,
      ['-Djava.awt.headless=true', '-jar', tmpJar, '--installClient', gameDir],
      { cwd: gameDir },
      (line) => onProgress?.(line, 75)
    )
  } finally {
    clearInterval(heartbeat)
    fs.rmSync(tmpJar, { force: true })
  }

  // Detectar la carpeta creada por el instalador
  let installedForgeId: string | undefined
  if (fs.existsSync(versionsDir)) {
    const newVersions = fs.readdirSync(versionsDir).filter((v) => !existingVersions.has(v))
    installedForgeId = newVersions.find((v) => v.toLowerCase().includes('forge'))
  }
  if (!installedForgeId) {
    const buildNumber = forgeVersion.startsWith(mcVersion + '-')
      ? forgeVersion.slice(mcVersion.length + 1)
      : forgeVersion
    installedForgeId = `${mcVersion}-forge-${buildNumber}`
  }

  // Post-install: descargar librerías faltantes del version JSON
  onProgress?.('Verificando bibliotecas de Forge...', 90)
  await downloadMissingVersionLibraries(
    path.join(versionsDir, installedForgeId, `${installedForgeId}.json`),
    librariesDir,
    (msg) => onProgress?.(msg, 92)
  )

  onProgress?.('Forge instalado correctamente', 100)
  return installedForgeId
}

export async function installNeoForge(
  mcVersion: string,
  neoForgeVersion: string,
  onProgress?: (msg: string, percent: number) => void
): Promise<string> {
  const settings = getSettings()
  const javaExe = getJavaForMc(mcVersion)
  const gameDir = path.resolve(path.join(settings.assetsDir, '..'))
  const versionsDir = path.join(gameDir, 'versions')

  const existingVersions = new Set(fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [])

  onProgress?.('Descargando instalador de NeoForge...', 0)
  const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`
  const tmpJar = path.join(os.tmpdir(), `neoforge-${neoForgeVersion}-installer.jar`)

  if (fs.existsSync(tmpJar)) fs.rmSync(tmpJar, { force: true })

  await downloadFile(installerUrl, tmpJar, (p) => {
    onProgress?.(`Descargando NeoForge: ${p.percent}%`, Math.round(p.percent * 0.6))
  })

  try {
    assertValidJar(tmpJar, `NeoForge ${neoForgeVersion}`)
  } catch (e) {
    fs.rmSync(tmpJar, { force: true })
    throw e
  }

  const profilesPath = path.join(gameDir, 'launcher_profiles.json')
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {}, selectedProfile: '' }))
  }

  onProgress?.('Ejecutando instalador de NeoForge...', 65)
  const librariesDir = path.join(gameDir, 'libraries')
  fs.mkdirSync(librariesDir, { recursive: true })
  const startMs = Date.now()
  let lastJarCount = countJars(librariesDir)
  const heartbeat = setInterval(() => {
    const jars = countJars(librariesDir)
    const time = elapsedStr(startMs)
    if (jars > lastJarCount) {
      lastJarCount = jars
      onProgress?.(`Descargando bibliotecas de NeoForge... (${jars} JARs, ${time})`, 75)
    } else {
      onProgress?.(`Instalando NeoForge, por favor espera... (${time})`, 75)
    }
  }, 2000)
  try {
    await spawnWithOutput(
      javaExe,
      ['-Djava.awt.headless=true', '-jar', tmpJar, '--install-client', gameDir],
      { cwd: gameDir },
      (line) => onProgress?.(line, 75)
    )
  } finally {
    clearInterval(heartbeat)
    fs.rmSync(tmpJar, { force: true })
  }

  // Detectar la carpeta creada por el instalador
  let installedVersionId: string | undefined
  if (fs.existsSync(versionsDir)) {
    const newVersions = fs.readdirSync(versionsDir).filter((v) => !existingVersions.has(v))
    installedVersionId = newVersions.find((v) => v.toLowerCase().includes('neoforge'))
  }
  installedVersionId ??= `neoforge-${neoForgeVersion}`

  // Post-install: descargar librerías faltantes del version JSON (ej. client-srg.jar)
  onProgress?.('Verificando bibliotecas de NeoForge...', 90)
  await downloadMissingVersionLibraries(
    path.join(versionsDir, installedVersionId, `${installedVersionId}.json`),
    librariesDir,
    (msg) => onProgress?.(msg, 92)
  )

  onProgress?.('NeoForge instalado correctamente', 100)
  return installedVersionId
}
