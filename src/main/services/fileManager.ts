/**
 * Gestión de metadatos de resource packs, datapacks y shaderpacks.
 * Análogo a modManager.ts pero para archivos de recursos.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getInstanceDir, getInstance } from './instanceManager'
import { cfGetDownloadUrl, cfGetMod, cfGetFileDetails, cfFingerprint, cfGetFingerprintMatches } from './curseforgeService'
import { downloadFile } from '../utils/downloadHelper'

const MR_HEADERS = { 'User-Agent': 'cw-mc-launcher/0.1.0', 'Accept': 'application/json', 'Content-Type': 'application/json' }

export interface FileMeta {
  modId: number
  fileId: number
  name: string
  slug: string
  mrSlug?: string
  mrVersionId?: string
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
  // Remove old version with the same modId
  for (const [existingFilename, meta] of Object.entries(json.files)) {
    if (meta.modId !== modId || meta.modId === 0) continue
    const cleanName = existingFilename.replace('.disabled', '')
    for (const f of [cleanName, cleanName + '.disabled']) {
      try { fs.rmSync(path.join(dir, f), { force: true }) } catch {}
    }
    delete json.files[cleanName]
    delete json.files[cleanName + '.disabled']
  }
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

  const json = readFilesJson(instanceId, folder)
  const instance = getInstance(instanceId)
  const isModrinth = instance?.source === 'modrinth' || instance?.modSource === 'mr'

  // Scan: .zip files + directories (shaderpacks can be dirs)
  const toIdentify: { filename: string; cleanName: string; isDir: boolean }[] = []
  for (const filename of fs.readdirSync(dir)) {
    if (filename.startsWith('.')) continue
    const fullPath = path.join(dir, filename)
    const stat = fs.statSync(fullPath)
    const isDir = stat.isDirectory()
    if (!isDir && !filename.endsWith('.zip') && !filename.endsWith('.zip.disabled')) continue
    const cleanName = filename.replace('.disabled', '')
    const existing = json.files[cleanName] ?? json.files[filename]
    // Skip if already identified (CF: fileId > 0, MR: mrVersionId, or directory)
    if (existing?.recognized !== undefined && (existing?.mrVersionId || (existing?.fileId ?? 0) > 0 || isDir)) continue
    // Skip failed identifications — don't retry
    if (existing?.recognized === false) continue
    toIdentify.push({ filename, cleanName, isDir })
  }

  // Directories can't be hash-identified — mark immediately as unrecognized
  const zipFiles = toIdentify.filter(e => !e.isDir)
  for (const { filename, cleanName } of toIdentify.filter(e => e.isDir)) {
    const existing = json.files[cleanName]
    if (!existing) {
      json.files[cleanName] = {
        modId: 0, fileId: 0,
        name: cleanName,
        slug: '',
        recognized: false,
      }
    }
    if (filename !== cleanName) delete json.files[filename]
  }

  writeFilesJson(instanceId, folder, json)
  if (zipFiles.length === 0) return
  onProgress?.(`Identificando ${zipFiles.length} archivo${zipFiles.length > 1 ? 's' : ''}...`)

  if (isModrinth) {
    // ── Modrinth: SHA1 hash lookup ──────────────────────────────────────────
    const withHash: { filename: string; cleanName: string; sha1: string }[] = []
    for (const entry of zipFiles) {
      try {
        const buf = fs.readFileSync(path.join(dir, entry.filename))
        withHash.push({ ...entry, sha1: crypto.createHash('sha1').update(buf).digest('hex') })
      } catch { /* skip */ }
    }

    let matched: Record<string, any> = {}
    try {
      const res = await fetch('https://api.modrinth.com/v2/version_files', {
        method: 'POST', headers: MR_HEADERS,
        body: JSON.stringify({ hashes: withHash.map(f => f.sha1), algorithm: 'sha1' }),
      })
      if (res.ok) matched = await res.json()
    } catch { /* leave unmatched */ }

    const projectIds = [...new Set(Object.values(matched).map((v: any) => v.project_id as string))]
    const projects: Record<string, any> = {}
    if (projectIds.length > 0) {
      try {
        const res = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(projectIds))}`, { headers: MR_HEADERS })
        if (res.ok) { for (const p of (await res.json()) as any[]) projects[p.id] = p }
      } catch { /* use version data as fallback */ }
    }

    const matchedHashes = new Set<string>()
    for (const { filename, cleanName, sha1 } of withHash) {
      const version = matched[sha1]
      if (!version) continue
      matchedHashes.add(sha1)
      const project = projects[version.project_id]
      json.files[cleanName] = {
        ...(json.files[cleanName] ?? {}),
        modId: 0, fileId: 0,
        name: project?.title ?? cleanName.replace('.zip', ''),
        slug: project?.slug ?? '',
        mrSlug: project?.slug,
        mrVersionId: version.id,
        logo: project?.icon_url,
        summary: project?.description,
        recognized: true,
      }
      if (filename !== cleanName) delete json.files[filename]
    }

    for (const { sha1, cleanName } of withHash) {
      if (matchedHashes.has(sha1)) continue
      const existing = json.files[cleanName]
      json.files[cleanName] = {
        modId: 0, fileId: 0,
        ...(existing ?? {}),
        name: existing?.name ?? cleanName.replace('.zip', ''),
        slug: existing?.slug ?? '',
        recognized: false,
      }
    }
  } else {
    // ── CurseForge: fingerprint matching ────────────────────────────────────
    const withFp: { filename: string; cleanName: string; fingerprint: number }[] = []
    for (const entry of zipFiles) {
      try {
        const buf = fs.readFileSync(path.join(dir, entry.filename))
        withFp.push({ ...entry, fingerprint: cfFingerprint(buf) })
      } catch { /* skip */ }
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
      const modId: number = match.id
      if (!modId) continue
      matchedFps.add(fp)
      const fileId: number = match.file?.id ?? 0
      let name = entry.cleanName.replace('.zip', '')
      let slug = '', logo: string | undefined, summary: string | undefined
      try {
        const mod = ((await cfGetMod(modId)) as any)?.data
        if (mod) { name = mod.name ?? name; slug = mod.slug ?? ''; logo = mod.logo?.thumbnailUrl; summary = mod.summary }
      } catch { /* use filename */ }
      json.files[entry.cleanName] = { ...(json.files[entry.cleanName] ?? {}), modId, fileId, name, slug, logo, summary, recognized: true }
      if (entry.filename !== entry.cleanName) delete json.files[entry.filename]
    }

    for (const { fingerprint, cleanName } of withFp) {
      if (matchedFps.has(fingerprint)) continue
      const existing = json.files[cleanName]
      json.files[cleanName] = {
        modId: 0, fileId: 0, ...(existing ?? {}),
        name: existing?.name ?? cleanName.replace('.zip', ''),
        slug: existing?.slug ?? '', recognized: false,
      }
    }
  }

  writeFilesJson(instanceId, folder, json)
}
