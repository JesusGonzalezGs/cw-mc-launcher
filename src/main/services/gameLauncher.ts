/**
 * Lanzamiento del juego Minecraft.
 * Construye el comando java con classpath y argumentos correctos.
 */
import fs from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import * as unzipper from 'unzipper'
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

/**
 * NeoForge's new installer creates `minecraft-client-patched.jar` but older FML
 * still looks for `client-{mcVersion}-{neoFormVersion}-srg.jar`. Copy if needed.
 */
function bridgeNeoForgeSrgJar(versionJson: any, librariesDir: string, versionId: string): void {
  if (!versionId.toLowerCase().includes('neoforge')) return

  const gameArgs: any[] = versionJson.arguments?.game ?? []
  const strArgs = gameArgs.filter((a): a is string => typeof a === 'string')
  const mcVersionIdx = strArgs.indexOf('--fml.mcVersion')
  const neoFormVersionIdx = strArgs.indexOf('--fml.neoFormVersion')
  const neoForgeVersionIdx = strArgs.indexOf('--fml.neoForgeVersion')
  if (mcVersionIdx === -1 || neoFormVersionIdx === -1 || neoForgeVersionIdx === -1) return

  const mcVersion = strArgs[mcVersionIdx + 1]
  const neoFormVersion = strArgs[neoFormVersionIdx + 1]
  const neoForgeVersion = strArgs[neoForgeVersionIdx + 1]
  if (!mcVersion || !neoFormVersion || !neoForgeVersion) return

  const srcPath = path.join(
    librariesDir, 'net', 'neoforged', 'minecraft-client-patched', neoForgeVersion,
    `minecraft-client-patched-${neoForgeVersion}.jar`
  )
  const targetDir = path.join(librariesDir, 'net', 'minecraft', 'client', `${mcVersion}-${neoFormVersion}`)
  const targetPath = path.join(targetDir, `client-${mcVersion}-${neoFormVersion}-srg.jar`)

  if (fs.existsSync(srcPath) && !fs.existsSync(targetPath)) {
    fs.mkdirSync(targetDir, { recursive: true })
    fs.copyFileSync(srcPath, targetPath)
  }
}

/**
 * Extrae las librerías nativas de los JARs de natives al directorio nativesDir.
 * Solo extrae si el directorio está vacío (para no re-extraer en cada arranque).
 */
async function extractNatives(versionJson: any, librariesDir: string, nativesDir: string): Promise<void> {
  const currentOs = isWindows ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'

  const nativeJars: string[] = []

  for (const lib of versionJson.libraries ?? []) {
    // Comprobar reglas OS
    if (lib.rules) {
      const allowed = lib.rules.some((rule: any) => {
        if (rule.action !== 'allow') return false
        if (!rule.os) return true
        return rule.os.name === currentOs
      })
      if (!allowed) continue
    }

    // Método 1: downloads.classifiers con natives-{os}
    const nativeKey = lib.natives?.[currentOs]?.replace('${arch}', process.arch === 'x64' ? '64' : '32')
    if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
      const classifier = lib.downloads.classifiers[nativeKey]
      const jarPath = path.join(librariesDir, classifier.path)
      if (!fs.existsSync(jarPath) && classifier.url) {
        // El JAR nativo no fue descargado durante la instalación — descargarlo ahora
        fs.mkdirSync(path.dirname(jarPath), { recursive: true })
        const resp = await fetch(classifier.url)
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer())
          fs.writeFileSync(jarPath, buf)
        }
      }
      if (fs.existsSync(jarPath)) nativeJars.push(jarPath)
      continue
    }

    // Método 2: el propio artifact tiene "natives-windows" en el nombre (lwjgl3, etc.)
    if (lib.downloads?.artifact?.path) {
      const p = lib.downloads.artifact.path as string
      if (p.includes(`natives-${currentOs}`) || p.includes('natives-windows') && currentOs === 'windows') {
        const jarPath = path.join(librariesDir, p)
        if (fs.existsSync(jarPath)) nativeJars.push(jarPath)
      }
    }
  }

  if (nativeJars.length === 0) return

  // Solo re-extraer si el directorio está vacío
  const existing = fs.readdirSync(nativesDir)
  if (existing.length > 0) return

  for (const jarPath of nativeJars) {
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(jarPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: any) => {
          const fileName: string = entry.path
          // Excluir META-INF y directorios
          if (fileName.startsWith('META-INF') || fileName.endsWith('/')) {
            entry.autodrain()
            return
          }
          // Solo extraer archivos nativos relevantes
          const ext = path.extname(fileName).toLowerCase()
          if (!['.dll', '.so', '.dylib', '.jnilib'].includes(ext)) {
            entry.autodrain()
            return
          }
          const outPath = path.join(nativesDir, path.basename(fileName))
          entry.pipe(fs.createWriteStream(outPath)).on('error', reject)
        })
        .on('close', resolve)
        .on('error', reject)
    })
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

function buildClasspath(versionJson: any, settings: ReturnType<typeof getSettings>, resolvedVersionId: string): string {
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

  // El client.jar vanilla se necesita SIEMPRE salvo en Forge/NeoForge modernos,
  // que incluyen su propio cliente parcheado. El Forge antiguo (launchwrapper, ≤1.12.2)
  // también necesita el jar vanilla porque parchea clases en memoria en tiempo de ejecución.
  const isForgeVariant = resolvedVersionId.toLowerCase().includes('forge')
  const usesLaunchWrapper = (versionJson.libraries ?? []).some(
    (lib: any) => typeof lib.name === 'string' && lib.name.includes('launchwrapper')
  )
  if (!isForgeVariant || usesLaunchWrapper) {
    const clientJar = path.join(versionsDir, versionJson.id, `${versionJson.id}.jar`)
    if (fs.existsSync(clientJar)) jars.push(clientJar)
  }

  return [...new Set(jars)].filter((j) => fs.existsSync(j)).join(sep)
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

  // NeoForge: bridge minecraft-client-patched.jar → client-srg.jar if needed
  bridgeNeoForgeSrgJar(effectiveJson, path.join(settings.assetsDir, '..', 'libraries'), instance.resolvedVersionId)

  // Extraer librerías nativas al directorio natives
  const librariesDir = path.resolve(path.join(settings.assetsDir, '..', 'libraries'))
  await extractNatives(effectiveJson, librariesDir, nativesDir)

  const javaExe = resolveJavaExe(instance.mcVersion)
  const classpath = buildClasspath(effectiveJson, settings, instance.resolvedVersionId)
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
    classpath_separator: isWindows ? ';' : ':',
    library_directory: librariesDir,
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

  // Formato antiguo (pre-1.13): child tiene minecraftArguments con el tweaker de Forge incluido.
  // Si child lo define, debe reemplazar al del parent porque ya es el conjunto completo.
  if (child.minecraftArguments) merged.minecraftArguments = child.minecraftArguments

  // Fusionar libraries
  merged.libraries = [...(child.libraries ?? []), ...(parent.libraries ?? [])]

  // Fusionar arguments (formato nuevo, 1.13+)
  if (child.arguments) {
    merged.arguments = {
      jvm: [...(child.arguments.jvm ?? []), ...(parent.arguments?.jvm ?? [])],
      game: [...(parent.arguments?.game ?? []), ...(child.arguments.game ?? [])],
    }
  }

  return merged
}
