/**
 * Gestión de metadatos de resource packs, datapacks y shaderpacks.
 * Análogo a modManager.ts pero para archivos de recursos.
 */
import fs from 'fs'
import path from 'path'
import { getInstanceDir } from './instanceManager'
import { cfGetDownloadUrl, cfGetMod, cfGetFileDetails, cfFingerprint, cfGetFingerprintMatches } from './curseforgeService'
import { downloadFile } from '../utils/downloadHelper'

export interface FileMeta {
  modId: number
  fileId: number
  name: string
  slug: string
  logo?: string
  summary?: string
  recognized?: boolean
}

export interface FilesJson {
  files: Record<string, FileMeta>
}

function getFilesJsonPath(instanceId: string, folder: string): string {
  return path.join(getInstanceDir(instanceId), `${folder}.json`)
}

export function readFilesJson(instanceId: string, folder: string): FilesJson {
  const p = getFilesJsonPath(instanceId, folder)
  if (!fs.existsSync(p)) return { files: {} }
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return { files: {} } }
}

export function writeFilesJson(instanceId: string, folder: string, data: FilesJson): void {
  fs.writeFileSync(getFilesJsonPath(instanceId, folder), JSON.stringify(data, null, 2))
}

export function removeFileMeta(instanceId: string, folder: string, filename: string): void {
  const json = readFilesJson(instanceId, folder)
  const clean = filename.replace('.disabled', '')
  delete json.files[filename]
  delete json.files[clean]
  writeFilesJson(instanceId, folder, json)
}

export async function installFileWithMeta(
  instanceId: string,
  folder: string,
  modId: number,
  fileId: number
): Promise<string> {
  const url = await cfGetDownloadUrl(modId, fileId)
  if (!url) throw new Error('No se pudo obtener la URL del archivo')

  const dir = path.join(getInstanceDir(instanceId), folder)
  fs.mkdirSync(dir, { recursive: true })

  const filename = decodeURIComponent(url.split('/').pop() ?? `file-${fileId}`)
  await downloadFile(url, path.join(dir, filename))

  // Store metadata (best-effort)
  const json = readFilesJson(instanceId, folder)
  try {
    const [modData, fileData] = await Promise.all([
      cfGetMod(modId) as Promise<any>,
      cfGetFileDetails(modId, fileId) as Promise<any>,
    ])
    const mod = modData?.data
    if (mod) {
      json.files[filename] = {
        modId, fileId,
        name: mod.name ?? filename,
        slug: mod.slug ?? '',
        logo: mod.logo?.thumbnailUrl,
        summary: mod.summary,
        recognized: true,
      }
      writeFilesJson(instanceId, folder, json)
    }
  } catch { /* metadata optional */ }

  return filename
}

export async function identifyFiles(
  instanceId: string,
  folder: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const dir = path.join(getInstanceDir(instanceId), folder)
  if (!fs.existsSync(dir)) return

  const allEntries = fs.readdirSync(dir)
  const json = readFilesJson(instanceId, folder)

  // Classify entries
  const toIdentify: { filename: string; cleanName: string; fingerprint: number }[] = []
  for (const filename of allEntries) {
    if (!filename.endsWith('.zip') && !filename.endsWith('.zip.disabled')) continue
    const fullPath = path.join(dir, filename)
    if (!fs.statSync(fullPath).isFile()) continue
    const cleanName = filename.replace('.disabled', '')
    const existing = json.files[cleanName] ?? json.files[filename]
    if (existing?.recognized !== undefined) continue
    try {
      const buf = fs.readFileSync(fullPath)
      toIdentify.push({ filename, cleanName, fingerprint: cfFingerprint(buf) })
    } catch { /* skip unreadable */ }
  }

  // Save folder/other classifications immediately
  writeFilesJson(instanceId, folder, json)

  if (toIdentify.length === 0) return
  onProgress?.(`Identificando ${toIdentify.length} archivo${toIdentify.length > 1 ? 's' : ''}...`)

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

    const modId: number = match.id
    if (!modId) continue  // CF returned invalid modId — treat as unmatched
    matchedFps.add(fp)
    const fileId: number = match.file?.id ?? 0
    let name = entry.cleanName.replace('.zip', '')
    let slug = ''
    let logo: string | undefined
    let summary: string | undefined

    try {
      const modData = (await cfGetMod(modId)) as any
      const mod = modData?.data
      if (mod) { name = mod.name ?? name; slug = mod.slug ?? ''; logo = mod.logo?.thumbnailUrl; summary = mod.summary }
    } catch { /* use filename as name */ }

    json.files[entry.cleanName] = {
      ...(json.files[entry.cleanName] ?? {}),
      modId, fileId, name, slug, logo, summary, recognized: true,
    }
    if (entry.filename !== entry.cleanName) delete json.files[entry.filename]
  }

  // Mark unmatched
  for (const { fingerprint, cleanName } of toIdentify) {
    if (matchedFps.has(fingerprint)) continue
    json.files[cleanName] = {
      modId: 0, fileId: 0,
      ...(json.files[cleanName] ?? {}),
      name: json.files[cleanName]?.name ?? cleanName.replace('.zip', ''),
      slug: json.files[cleanName]?.slug ?? '',
      recognized: false,
    }
  }

  writeFilesJson(instanceId, folder, json)
}
