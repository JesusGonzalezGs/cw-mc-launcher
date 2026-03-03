/**
 * Lanzamiento del juego Minecraft.
 * Construye el comando java con classpath y argumentos correctos.
 */
import fs from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import { getSettings, getAccounts } from '../store'
import { getMcJavaVersion, getJavaExe, isJavaReady } from './javaManager'
import { isWindows } from '../utils/platform'
import { getInstanceDir } from './instanceManager'
import { updateLastPlayed } from './instanceManager'
import type { Instance } from './instanceManager'

// Procesos activos de Minecraft: instanceId → ChildProcess
const runningProcesses: Map<string, ChildProcess> = new Map()

export function isInstanceRunning(instanceId: string): boolean {
  return runningProcesses.has(instanceId)
}

export function stopInstance(instanceId: string): void {
  const proc = runningProcesses.get(instanceId)
  if (proc) {
    proc.kill('SIGTERM')
    runningProcesses.delete(instanceId)
  }
}

function resolveJavaExe(mcVersion: string): string {
  const ver = getMcJavaVersion(mcVersion)
  if (isJavaReady(ver)) return getJavaExe(ver)
  return isWindows ? 'java.exe' : 'java'
}

/** Converts a Maven coordinate to a relative file path. e.g. "net.fabricmc:fabric-loader:0.16.10" → "net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar" */
function mavenCoordToRelPath(name: string): string {
  const parts = name.split(':')
  const groupPath = parts[0].split('.').join(path.sep)
  const artifactId = parts[1]
  const version = parts[2]
  const classifier = parts[3] ? `-${parts[3]}` : ''
  return path.join(groupPath, artifactId, version, `${artifactId}-${version}${classifier}.jar`)
}

function buildClasspath(versionJson: any, settings: ReturnType<typeof getSettings>): string {
  const librariesDir = path.join(settings.assetsDir, '..', 'libraries')
  const versionsDir = path.join(settings.assetsDir, '..', 'versions')
  const sep = isWindows ? ';' : ':'

  const jars: string[] = []

  for (const lib of versionJson.libraries ?? []) {
    if (lib.rules) {
      const allowed = lib.rules.some((rule: any) => {
        if (rule.action !== 'allow') return false
        if (!rule.os) return true
        const currentOs = isWindows ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
        return rule.os.name === currentOs
      })
      if (!allowed) continue
    }

    if (lib.downloads?.artifact?.path) {
      jars.push(path.join(librariesDir, lib.downloads.artifact.path))
    } else if (lib.name) {
      // Maven coordinate format (Fabric, Quilt, etc.)
      jars.push(path.join(librariesDir, mavenCoordToRelPath(lib.name)))
    }
  }

  // Agregar el client.jar
  const clientJar = path.join(versionsDir, versionJson.id, `${versionJson.id}.jar`)
  if (fs.existsSync(clientJar)) jars.push(clientJar)

  return jars.filter((j) => fs.existsSync(j)).join(sep)
}

function resolveArg(arg: any, vars: Record<string, string>, features: Record<string, boolean> = {}): string[] {
  if (typeof arg === 'string') {
    return [arg.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')]
  }
  if (typeof arg === 'object' && arg.rules) {
    const allowed = arg.rules.every((rule: any) => {
      if (rule.action !== 'allow') return false
      if (rule.features) {
        return Object.entries(rule.features as Record<string, boolean>).every(
          ([k, v]) => (features[k] ?? false) === v
        )
      }
      if (!rule.os) return true
      const currentOs = isWindows ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
      return rule.os?.name === currentOs
    })
    if (!allowed) return []
    const value = arg.value
    if (typeof value === 'string') return resolveArg(value, vars, features)
    if (Array.isArray(value)) return value.flatMap((v: any) => resolveArg(v, vars, features))
  }
  return []
}

export async function launchInstance(
  instance: Instance,
  mainWindow: BrowserWindow
): Promise<void> {
  if (isInstanceRunning(instance.id)) throw new Error('La instancia ya está en ejecución')

  const settings = getSettings()
  const accounts = getAccounts()
  const activeId = settings.activeAccountId
  if (!activeId || !accounts[activeId]) {
    throw new Error('No hay ninguna cuenta activa. Inicia sesión primero.')
  }

  const account = accounts[activeId]
  const instanceDir = getInstanceDir(instance.id)
  const versionsDir = path.join(settings.assetsDir, '..', 'versions')
  const nativesDir = path.join(versionsDir, instance.resolvedVersionId, 'natives')

  // Leer version.json del mod loader (o vanilla)
  const versionJsonPath = path.join(versionsDir, instance.resolvedVersionId, `${instance.resolvedVersionId}.json`)
  if (!fs.existsSync(versionJsonPath)) {
    throw new Error(`No se encontró version.json para ${instance.resolvedVersionId}. ¿Está instalado?`)
  }
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'))

  // Si tiene 'inheritsFrom', fusionar con el JSON padre
  let effectiveJson = versionJson
  if (versionJson.inheritsFrom) {
    const parentPath = path.join(versionsDir, versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`)
    if (fs.existsSync(parentPath)) {
      const parent = JSON.parse(fs.readFileSync(parentPath, 'utf-8'))
      effectiveJson = mergeVersionJsons(parent, versionJson)
    }
  }

  fs.mkdirSync(nativesDir, { recursive: true })
  fs.mkdirSync(instanceDir, { recursive: true })

  const javaExe = resolveJavaExe(instance.mcVersion)
  const classpath = buildClasspath(effectiveJson, settings)
  const mainClass = effectiveJson.mainClass

  const assetIndex = effectiveJson.assetIndex?.id ?? effectiveJson.assets ?? instance.mcVersion

  const vars: Record<string, string> = {
    auth_player_name: account.username,
    version_name: instance.resolvedVersionId,
    game_directory: instanceDir,
    assets_root: settings.assetsDir,
    assets_index_name: assetIndex,
    auth_uuid: account.uuid,
    auth_access_token: account.accessToken,
    user_type: account.type === 'msa' ? 'msa' : 'legacy',
    version_type: effectiveJson.type ?? 'release',
    natives_directory: nativesDir,
    launcher_name: 'cw-mc-launcher',
    launcher_version: '0.1.0',
    classpath,
  }

  const features: Record<string, boolean> = {
    is_demo_user: false,
    has_custom_resolution: false,
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false,
  }

  const jvmArgs: string[] = []
  const gameArgs: string[] = []

  // JVM args del version.json
  if (Array.isArray(effectiveJson.arguments?.jvm)) {
    for (const arg of effectiveJson.arguments.jvm) {
      jvmArgs.push(...resolveArg(arg, vars, features))
    }
  } else {
    // Formato antiguo (minecraftArguments)
    jvmArgs.push(`-Djava.library.path=${nativesDir}`)
    jvmArgs.push('-cp', classpath)
  }

  // JVM args personalizados del usuario
  const customJvmArgs = (instance.jvmArgs || settings.jvmArgs || '-Xmx2G')
    .split(' ')
    .filter(Boolean)
  jvmArgs.push(...customJvmArgs)

  // Game args
  if (Array.isArray(effectiveJson.arguments?.game)) {
    for (const arg of effectiveJson.arguments.game) {
      gameArgs.push(...resolveArg(arg, vars, features))
    }
  } else if (effectiveJson.minecraftArguments) {
    // Formato antiguo
    const old = effectiveJson.minecraftArguments.replace(/\$\{(\w+)\}/g, (_: string, k: string) => vars[k] ?? '')
    gameArgs.push(...old.split(' '))
  }

  const finalArgs = [...jvmArgs, mainClass, ...gameArgs]

  const child = spawn(javaExe, finalArgs, {
    cwd: instanceDir,
    stdio: 'pipe',
  })

  runningProcesses.set(instance.id, child)
  updateLastPlayed(instance.id)

  const sendLog = (line: string) => {
    mainWindow.webContents.send('game:log', { instanceId: instance.id, line })
  }

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) sendLog(line)
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) sendLog(`[STDERR] ${line}`)
    }
  })

  child.on('close', (code) => {
    runningProcesses.delete(instance.id)
    mainWindow.webContents.send('game:stopped', { instanceId: instance.id, code })
  })

  child.on('error', (err) => {
    runningProcesses.delete(instance.id)
    mainWindow.webContents.send('game:error', { instanceId: instance.id, error: err.message })
  })
}

function mergeVersionJsons(parent: any, child: any): any {
  const merged = { ...parent }
  if (child.mainClass) merged.mainClass = child.mainClass
  if (child.assets) merged.assets = child.assets
  if (child.assetIndex) merged.assetIndex = child.assetIndex
  if (child.type) merged.type = child.type

  // Fusionar libraries
  merged.libraries = [...(child.libraries ?? []), ...(parent.libraries ?? [])]

  // Fusionar arguments
  if (child.arguments) {
    merged.arguments = {
      jvm: [...(child.arguments.jvm ?? []), ...(parent.arguments?.jvm ?? [])],
      game: [...(parent.arguments?.game ?? []), ...(child.arguments.game ?? [])],
    }
  }

  return merged
}
