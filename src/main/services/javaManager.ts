/**
 * Gestión de JREs (Eclipse Adoptium/Temurin) para distintas versiones de Minecraft.
 * Port directo de backend/services/javaManager.js, adaptado para Electron.
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { isWindows, extractZip, spawnAsync } from '../utils/platform'

export type JavaStatus = 'idle' | 'downloading' | 'done' | 'error'

export interface JavaDownloadState {
  status: JavaStatus
  progress: number
  error: string
}

const javaDownloads: Record<number, JavaDownloadState> = {}

export function getJavaDownloads() {
  return javaDownloads
}

function makeWritable(dirPath: string): void {
  try {
    fs.chmodSync(dirPath, 0o755)
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name)
      try { fs.chmodSync(full, entry.isDirectory() ? 0o755 : 0o644) } catch { /* ignorar */ }
      if (entry.isDirectory()) makeWritable(full)
    }
  } catch { /* ignorar si el directorio no existe */ }
}

export function getMcJavaVersion(mcVersion: string): number {
  if (!mcVersion || mcVersion === 'Desconocida') return 21
  const parts = mcVersion.split('.').map(Number)
  const minor = parts[1] ?? 0
  const patch = parts[2] ?? 0
  if (minor < 17) return 8
  if (minor < 20 || (minor === 20 && patch <= 4)) return 17
  return 21
}

export function getJavaDir(majorVersion: number): string {
  return path.join(app.getPath('userData'), 'java', String(majorVersion))
}

export function getJavaExe(majorVersion: number): string {
  const dir = getJavaDir(majorVersion)
  return isWindows
    ? path.join(dir, 'bin', 'java.exe')
    : path.join(dir, 'bin', 'java')
}

export function isJavaReady(majorVersion: number): boolean {
  return fs.existsSync(getJavaExe(majorVersion))
}

export async function downloadJava(majorVersion: number): Promise<void> {
  if (javaDownloads[majorVersion]?.status === 'downloading') return

  javaDownloads[majorVersion] = { status: 'downloading', progress: 0, error: '' }

  try {
    const osName = isWindows ? 'windows'
      : process.platform === 'darwin' ? 'mac'
      : 'linux'
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64'

    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=${arch}&image_type=jre&os=${osName}&vendor=eclipse`
    const apiResp = await fetch(apiUrl)
    if (!apiResp.ok) throw new Error(`Adoptium API error: ${apiResp.status}`)

    const assets = await apiResp.json()
    if (!Array.isArray(assets) || assets.length === 0) {
      throw new Error(`No se encontraron assets de Java ${majorVersion} para ${osName}/${arch}`)
    }

    const pkg = assets[0].binary.package
    const downloadUrl = pkg.link
    const isZip = pkg.name.endsWith('.zip')

    const tmpFile = path.join(os.tmpdir(), `cw-mc-java-${majorVersion}${isZip ? '.zip' : '.tar.gz'}`)
    const dlResp = await fetch(downloadUrl)
    if (!dlResp.ok) throw new Error(`Error descargando Java: ${dlResp.status}`)

    const totalSize = parseInt(dlResp.headers.get('content-length') || '0', 10)
    let downloaded = 0

    await new Promise<void>((resolve, reject) => {
      const dest = createWriteStream(tmpFile)
      const body = Readable.fromWeb(dlResp.body as any)

      body.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        if (totalSize > 0) {
          javaDownloads[majorVersion].progress = Math.round((downloaded / totalSize) * 90)
        }
      })

      body.pipe(dest)
      dest.on('finish', resolve)
      dest.on('error', reject)
      body.on('error', reject)
    })

    javaDownloads[majorVersion].progress = 92

    const destDir = getJavaDir(majorVersion)
    fs.mkdirSync(destDir, { recursive: true })

    if (isZip) {
      const tmpExtract = destDir + '_tmp_extract'
      fs.mkdirSync(tmpExtract, { recursive: true })
      await extractZip(tmpFile, tmpExtract)

      const entries = fs.readdirSync(tmpExtract)
      const inner = entries.find((e) => fs.statSync(path.join(tmpExtract, e)).isDirectory())
      if (inner) {
        const innerPath = path.join(tmpExtract, inner)
        for (const f of fs.readdirSync(innerPath)) {
          const src = path.join(innerPath, f)
          const dst = path.join(destDir, f)
          if (fs.existsSync(dst)) await fs.promises.rm(dst, { recursive: true, force: true })
          await fs.promises.cp(src, dst, { recursive: true })
        }
      }
      await fs.promises.rm(tmpExtract, { recursive: true, force: true })
      makeWritable(destDir)
    } else {
      await spawnAsync('tar', ['-xzf', tmpFile, '-C', destDir, '--strip-components=1'])
      makeWritable(destDir)
    }

    javaDownloads[majorVersion].progress = 98
    fs.rmSync(tmpFile, { force: true })

    if (!isWindows) {
      try { fs.chmodSync(getJavaExe(majorVersion), 0o755) } catch { /* ignorar */ }
    }

    javaDownloads[majorVersion].progress = 100
    javaDownloads[majorVersion].status = 'done'
    console.log(`✅ Java ${majorVersion} JRE instalado en ${destDir}`)
  } catch (err: any) {
    console.error(`Error descargando Java ${majorVersion}:`, err.message)
    javaDownloads[majorVersion].status = 'error'
    javaDownloads[majorVersion].error = err.message
  }
}
