/**
 * Gestión de instancias de juego (perfiles).
 * Cada instancia tiene su propio directorio en userData/instances/{id}/
 */
import fs from 'fs'
import path from 'path'
import { v4 as uuidV4 } from 'uuid'
import { getSettings } from '../store'
import type { ModLoader } from './modLoaderInstaller'

export interface Instance {
  id: string
  name: string
  mcVersion: string
  modLoader: ModLoader
  modLoaderVersion: string
  /** ID de versión resuelto (ej. "fabric-loader-0.15.11-1.20.4") */
  resolvedVersionId: string
  iconPath?: string
  description?: string
  jvmArgs?: string
  /** ms timestamp de última ejecución */
  lastPlayed?: number
  /** origen: 'manual' | 'curseforge' | 'modrinth' */
  source: 'manual' | 'curseforge' | 'modrinth'
  /** Metadatos de CurseForge si el origen es 'curseforge' */
  cfMeta?: {
    modpackId: number
    fileId: number
    name: string
    logoUrl?: string
    fileVersion?: string
    slug?: string
  }
  /** Metadatos de Modrinth si el origen es 'modrinth' */
  mrMeta?: {
    projectId: string
    versionId: string
    name: string
    logoUrl?: string
  }
}

function getInstancesDir(): string {
  return getSettings().instancesDir
}

export function getInstanceDir(id: string): string {
  return path.join(getInstancesDir(), id)
}

export function getInstanceConfigPath(id: string): string {
  return path.join(getInstanceDir(id), 'instance.json')
}

export function listInstances(): Instance[] {
  const dir = getInstancesDir()
  if (!fs.existsSync(dir)) return []

  const instances: Instance[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const cfgPath = path.join(dir, entry.name, 'instance.json')
    if (!fs.existsSync(cfgPath)) continue
    try {
      const inst = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Instance
      instances.push(inst)
    } catch { /* instancia corrupta, ignorar */ }
  }

  return instances.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
}

export function getInstance(id: string): Instance | null {
  const cfgPath = getInstanceConfigPath(id)
  if (!fs.existsSync(cfgPath)) return null
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Instance
  } catch {
    return null
  }
}

export function saveInstance(instance: Instance): void {
  const dir = getInstanceDir(instance.id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getInstanceConfigPath(instance.id), JSON.stringify(instance, null, 2))
}

export function createInstance(params: Omit<Instance, 'id'>): Instance {
  const instance: Instance = { id: uuidV4(), ...params }
  saveInstance(instance)
  return instance
}

export function deleteInstance(id: string): void {
  const dir = getInstanceDir(id)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function cloneInstance(id: string, customName?: string): Instance {
  const source = getInstance(id)
  if (!source) throw new Error(`Instancia ${id} no encontrada`)
  const newId = uuidV4()
  const sourceDir = getInstanceDir(id)
  const targetDir = getInstanceDir(newId)
  fs.cpSync(sourceDir, targetDir, { recursive: true })
  let newName: string
  if (customName) {
    newName = customName
  } else {
    const allNames = new Set(listInstances().map((i) => i.name))
    newName = `${source.name} (Copia)`
    let n = 2
    while (allNames.has(newName)) {
      newName = `${source.name} (Copia ${n++})`
    }
  }
  const clone: Instance = { ...source, id: newId, name: newName, lastPlayed: undefined }
  saveInstance(clone)
  return clone
}

export function updateLastPlayed(id: string): void {
  const inst = getInstance(id)
  if (!inst) return
  inst.lastPlayed = Date.now()
  saveInstance(inst)
}

export function getModsDir(id: string): string {
  return path.join(getInstanceDir(id), 'mods')
}

export function listMods(id: string): string[] {
  const dir = getModsDir(id)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
}

export function toggleMod(instanceId: string, filename: string): string {
  const dir = getModsDir(instanceId)
  const current = path.join(dir, filename)
  let next: string
  if (filename.endsWith('.jar.disabled')) {
    next = path.join(dir, filename.replace('.jar.disabled', '.jar'))
  } else {
    next = path.join(dir, filename + '.disabled')
  }
  fs.renameSync(current, next)
  return path.basename(next)
}

export function removeMod(instanceId: string, filename: string): void {
  const filePath = path.join(getModsDir(instanceId), filename)
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
}
