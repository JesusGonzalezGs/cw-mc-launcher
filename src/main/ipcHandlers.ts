/**
 * Registro de todos los handlers IPC del proceso main.
 */
import { ipcMain, app, shell } from 'electron'
import { getMainWindow } from './index'
import {
  downloadJava,
  getJavaDownloads,
  isJavaReady,
  getMcJavaVersion,
} from './services/javaManager'
import {
  loginWithMicrosoft,
  loginOffline,
  refreshAccountIfNeeded,
} from './services/authService'
import {
  getAccounts,
  deleteAccount,
  getSettings,
  saveSettings,
} from './store'
import {
  listInstances,
  getInstance,
  createInstance,
  deleteInstance,
  cloneInstance,
  listMods,
  toggleMod,
  removeMod,
  getInstanceDir,
} from './services/instanceManager'
import {
  getMcVersionManifest,
  downloadVersionFiles,
  isVersionDownloaded,
} from './services/gameDownloader'
import {
  getFabricLoaderVersions,
  getQuiltLoaderVersions,
  getForgeVersions,
  getNeoForgeVersions,
  installFabric,
  installQuilt,
  installForge,
  installNeoForge,
} from './services/modLoaderInstaller'
import {
  cfSearch,
  cfGetMod,
  cfGetModDescription,
  cfGetModFiles,
  cfGetDownloadUrl,
  cfGetFileDetails,
  cfGetFileChangelog,
  cfGetCategories,
} from './services/curseforgeService'
import { installCurseForgeModpack, cancelInstall } from './services/modpackInstaller'
import { installModWithDeps, readModsJson, removeModMeta, identifyMods } from './services/modManager'
import { installFileWithMeta, identifyFiles, readFilesJson, removeFileMeta } from './services/fileManager'
import { launchInstance, isInstanceRunning, stopInstance } from './services/gameLauncher'
import { mrSearch, mrGetProject, mrGetProjectVersions, mrGetVersion, mrInstallVersion, mrInstallModpack, cancelMrInstall } from './services/modrinthService'
import { downloadFile } from './utils/downloadHelper'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

export function registerIpcHandlers(): void {
  // ── Window controls ──────────────────────────────────────────────────────────
  ipcMain.on('window:minimize', () => getMainWindow()?.minimize())
  ipcMain.on('window:maximize', () => {
    const win = getMainWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window:close', () => getMainWindow()?.close())

  // ── Java ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('java:getStatus', () => {
    const downloads = getJavaDownloads()
    return [8, 17, 21].map((v) => ({
      version: v,
      ready: isJavaReady(v),
      status: downloads[v]?.status ?? 'idle',
      progress: downloads[v]?.progress ?? 0,
      error: downloads[v]?.error ?? '',
    }))
  })

  ipcMain.handle('java:download', async (_, version: number) => {
    downloadJava(version).catch(console.error)
    return { ok: true }
  })

  ipcMain.handle('java:pollStatus', () => {
    const downloads = getJavaDownloads()
    return [8, 17, 21].map((v) => ({
      version: v,
      ready: isJavaReady(v),
      status: downloads[v]?.status ?? 'idle',
      progress: downloads[v]?.progress ?? 0,
      error: downloads[v]?.error ?? '',
    }))
  })

  ipcMain.handle('java:getForMcVersion', (_, mcVersion: string) => {
    // Intentar leer el version.json para obtener javaVersion.majorVersion exacto
    let version = getMcJavaVersion(mcVersion)
    try {
      const settings = getSettings()
      const versionsDir = path.join(settings.assetsDir, '..', 'versions')
      // Buscar el primer version.json cuyo id empiece por mcVersion
      const entries = fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : []
      const match = entries.find(e => e === mcVersion || e.startsWith(mcVersion + '-') || e.startsWith(mcVersion + '.'))
      if (match) {
        const vj = JSON.parse(fs.readFileSync(path.join(versionsDir, match, `${match}.json`), 'utf-8'))
        if (vj.javaVersion?.majorVersion) version = vj.javaVersion.majorVersion
      }
    } catch { /* ignorar, usar fallback */ }
    const downloads = getJavaDownloads()
    return {
      version,
      ready: isJavaReady(version),
      status: downloads[version]?.status ?? 'idle',
      progress: downloads[version]?.progress ?? 0,
      error: downloads[version]?.error ?? '',
    }
  })

  // ── Auth ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:loginMsa', async () => {
    return loginWithMicrosoft()
  })

  ipcMain.handle('auth:loginOffline', async (_, username: string) => {
    return loginOffline(username)
  })

  ipcMain.handle('auth:listAccounts', () => {
    return Object.entries(getAccounts()).map(([id, acc]) => ({ id, ...acc }))
  })

  ipcMain.handle('auth:setActive', (_, accountId: string) => {
    saveSettings({ activeAccountId: accountId })
    return { ok: true }
  })

  ipcMain.handle('auth:logout', (_, accountId: string) => {
    deleteAccount(accountId)
    const settings = getSettings()
    if (settings.activeAccountId === accountId) {
      const remaining = Object.keys(getAccounts())
      saveSettings({ activeAccountId: remaining[0] ?? null })
    }
    return { ok: true }
  })

  ipcMain.handle('auth:getActive', () => {
    const settings = getSettings()
    const accounts = getAccounts()
    const id = settings.activeAccountId
    if (!id || !accounts[id]) return null
    return { id, ...accounts[id] }
  })

  // ── Instances ────────────────────────────────────────────────────────────────
  ipcMain.handle('instances:list', () => listInstances())

  ipcMain.handle('instances:get', (_, id: string) => getInstance(id))

  ipcMain.handle('instances:create', (_, params: any) => createInstance(params))

  ipcMain.handle('instances:delete', (_, id: string) => {
    deleteInstance(id)
    return { ok: true }
  })

  ipcMain.handle('instances:clone', async (_, id: string, customName?: string) => cloneInstance(id, customName))

  ipcMain.handle('instances:isRunning', (_, id: string) => isInstanceRunning(id))

  ipcMain.handle('instances:stop', (_, id: string) => {
    stopInstance(id)
    return { ok: true }
  })

  ipcMain.handle('instances:launch', async (_, instanceData: any) => {
    const win = getMainWindow()
    if (!win) throw new Error('No hay ventana principal')

    const instance = getInstance(instanceData.id) ?? instanceData
    const settings = getSettings()

    // Refrescar token si es necesario
    if (settings.activeAccountId) {
      await refreshAccountIfNeeded(settings.activeAccountId).catch(console.error)
    }

    // Modo launcher oficial: crear perfil y abrir MinecraftLauncher.exe --workDir
    if (settings.launchMode === 'official') {
      const instanceDir = getInstanceDir(instance.id)
      const installDir = path.resolve(path.join(settings.assetsDir, '..'))
      const librariesDir = path.join(installDir, 'libraries')
      const profilesPath = path.join(installDir, 'launcher_profiles.json')

      const jvmArgs = instance.jvmArgs || settings.jvmArgs || '-Xmx2G'
      const profileKey = 'cw-' + instance.id
      const profilesData: any = {
        profiles: {
          [profileKey]: {
            created: new Date().toISOString(),
            gameDir: instanceDir,
            icon: 'Grass',
            javaArgs: jvmArgs + ' -DlibraryDirectory="' + librariesDir + '"',
            lastVersionId: instance.resolvedVersionId || instance.mcVersion,
            name: instance.name,
            type: 'custom',
            lastUsed: new Date().toISOString(),
          },
        },
        selectedProfile: profileKey,
        settings: { keepLauncherOpen: false, showGameLog: false },
        version: 3,
      }
      fs.mkdirSync(installDir, { recursive: true })
      fs.writeFileSync(profilesPath, JSON.stringify(profilesData, null, 2), 'utf-8')

      const localAppData = process.env['LOCALAPPDATA'] ?? ''
      const officialPaths = [
        path.join(localAppData, 'Programs', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
        path.join('C:', 'XboxGames', 'Minecraft Launcher', 'Content', 'Minecraft.exe'),
        path.join('C:', 'Program Files (x86)', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
      ]
      const exePath = officialPaths.find(p => fs.existsSync(p))
      if (exePath) {
        spawn(exePath, ['--workDir', installDir], { detached: true, stdio: 'ignore' }).unref()
      } else {
        shell.openExternal('minecraft://')
      }
      return { ok: true, method: 'official' }
    }

    // Modo CW-MC: lanzamiento directo con Java
    await launchInstance(instance, win)
    return { ok: true, method: 'direct' }
  })

  ipcMain.handle('instances:getMods', (_, id: string) => listMods(id))

  ipcMain.handle('instances:toggleMod', (_, id: string, filename: string) =>
    toggleMod(id, filename)
  )

  ipcMain.handle('instances:removeMod', (_, id: string, filename: string) => {
    removeMod(id, filename)
    removeModMeta(id, filename)
    return { ok: true }
  })

  ipcMain.handle('instances:getModsMeta', (_, instanceId: string) => readModsJson(instanceId))

  ipcMain.handle('instances:identifyMods', async (_, instanceId: string) => {
    const win = getMainWindow()
    await identifyMods(instanceId, (msg) => {
      win?.webContents.send('mod:installProgress', { instanceId, msg })
    })
    return { ok: true }
  })

  ipcMain.handle('instances:installModWithDeps', async (_, instanceId: string, modId: number, fileId: number) => {
    const inst = getInstance(instanceId)
    if (!inst) throw new Error(`Instancia ${instanceId} no encontrada`)
    const win = getMainWindow()
    return installModWithDeps(instanceId, modId, fileId, inst.mcVersion, inst.modLoader, (msg) => {
      win?.webContents.send('mod:installProgress', { instanceId, msg })
    })
  })

  ipcMain.handle('instances:installMod', async (_, instanceId: string, modId: number, fileId: number) => {
    const url = await cfGetDownloadUrl(modId, fileId)
    if (!url) throw new Error('No se pudo obtener la URL del mod')
    const instanceDir = getInstanceDir(instanceId)
    const modsDir = path.join(instanceDir, 'mods')
    fs.mkdirSync(modsDir, { recursive: true })
    const filename = decodeURIComponent(url.split('/').pop() ?? `mod-${fileId}.jar`)
    const destPath = path.join(modsDir, filename)
    await downloadFile(url, destPath)
    return { ok: true, filename }
  })

  // ── Minecraft versions ───────────────────────────────────────────────────────
  ipcMain.handle('mc:getVersionManifest', () => getMcVersionManifest())

  ipcMain.handle('mc:isVersionDownloaded', (_, versionId: string) => isVersionDownloaded(versionId))

  ipcMain.handle('mc:downloadVersion', async (_, versionId: string) => {
    const win = getMainWindow()
    await downloadVersionFiles(versionId, (e) => {
      win?.webContents.send('mc:downloadProgress', { versionId, ...e })
    })
    return { ok: true }
  })

  // ── Mod Loaders ──────────────────────────────────────────────────────────────
  ipcMain.handle('loaders:fabricVersions', () => getFabricLoaderVersions())
  ipcMain.handle('loaders:quiltVersions', () => getQuiltLoaderVersions())
  ipcMain.handle('loaders:forgeVersions', (_, mcVersion: string) => getForgeVersions(mcVersion))
  ipcMain.handle('loaders:neoforgeVersions', (_, mcVersion: string) => getNeoForgeVersions(mcVersion))

  ipcMain.handle('loaders:installFabric', async (_, mcVersion: string, loaderVersion: string) => {
    const win = getMainWindow()
    const id = await installFabric(mcVersion, loaderVersion, (msg) => {
      win?.webContents.send('loaders:progress', { msg })
    })
    return { versionId: id }
  })

  ipcMain.handle('loaders:installQuilt', async (_, mcVersion: string, loaderVersion: string) => {
    const win = getMainWindow()
    const id = await installQuilt(mcVersion, loaderVersion, (msg) => {
      win?.webContents.send('loaders:progress', { msg })
    })
    return { versionId: id }
  })

  ipcMain.handle('loaders:installForge', async (_, mcVersion: string, forgeVersion: string) => {
    const win = getMainWindow()
    const id = await installForge(mcVersion, forgeVersion, (msg, percent) => {
      win?.webContents.send('loaders:progress', { msg, percent })
    })
    return { versionId: id }
  })

  ipcMain.handle('loaders:installNeoForge', async (_, mcVersion: string, neoForgeVersion: string) => {
    const win = getMainWindow()
    const id = await installNeoForge(mcVersion, neoForgeVersion, (msg, percent) => {
      win?.webContents.send('loaders:progress', { msg, percent })
    })
    return { versionId: id }
  })

  // ── CurseForge ───────────────────────────────────────────────────────────────
  ipcMain.handle('cf:searchModpacks', (_, params: any) =>
    cfSearch({ ...params, classId: 4471 })
  )

  ipcMain.handle('cf:searchMods', (_, params: any) =>
    cfSearch({ ...params, classId: 6 })
  )

  ipcMain.handle('cf:searchFiles', (_, params: any) =>
    cfSearch(params)
  )

  ipcMain.handle('cf:getCategories', () => cfGetCategories(4471))

  ipcMain.handle('cf:getMod', (_, modId: number) => cfGetMod(modId))

  ipcMain.handle('cf:getFileDetails', (_, modId: number, fileId: number) => cfGetFileDetails(modId, fileId))
  ipcMain.handle('cf:getFileChangelog', (_, modId: number, fileId: number) => cfGetFileChangelog(modId, fileId))

  ipcMain.handle('cf:getModDescription', (_, modId: number) => cfGetModDescription(modId))

  ipcMain.handle('cf:getModFiles', (_, modId: number, gameVersion?: string, loaderType?: number) =>
    cfGetModFiles(modId, gameVersion, loaderType)
  )

  ipcMain.handle('cf:installModpack', async (_, modpackId: number, fileId: number, name: string, logoUrl?: string, fileVersion?: string, slug?: string) => {
    const win = getMainWindow()
    const instance = await installCurseForgeModpack(modpackId, fileId, name, logoUrl, (p) => {
      win?.webContents.send('cf:installProgress', p)
    }, fileVersion, slug)
    return instance
  })

  ipcMain.handle('cf:cancelInstall', () => { cancelInstall() })

  // ── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:save', (_, partial: any) => {
    saveSettings(partial)
    return { ok: true }
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('instances:openFolder', (_, id: string) => shell.openPath(getInstanceDir(id)))

  ipcMain.handle('instances:toggleFile', (_, id: string, folder: string, filename: string): string => {
    const dir = path.join(getInstanceDir(id), folder)
    const isDisabled = filename.endsWith('.disabled')
    const newFilename = isDisabled ? filename.slice(0, -'.disabled'.length) : filename + '.disabled'
    fs.renameSync(path.join(dir, filename), path.join(dir, newFilename))
    return newFilename
  })

  ipcMain.handle('instances:installFile', async (_, id: string, folder: string, modId: number, fileId: number) => {
    const filename = await installFileWithMeta(id, folder, modId, fileId)
    return { ok: true, filename }
  })

  ipcMain.handle('instances:getFilesMeta', (_, id: string, folder: string) => {
    return readFilesJson(id, folder)
  })

  ipcMain.handle('instances:identifyFiles', async (_, id: string, folder: string) => {
    await identifyFiles(id, folder)
  })

  ipcMain.handle('instances:listFolder', (_, id: string, folder: string): { name: string; isDir: boolean }[] => {
    const dir = path.join(getInstanceDir(id), folder)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(name => (name.endsWith('.zip') || name.endsWith('.zip.disabled')) && fs.statSync(path.join(dir, name)).isFile())
      .map(name => ({ name, isDir: false }))
  })

  ipcMain.handle('instances:deleteFile', (_, id: string, folder: string, filename: string): void => {
    const fp = path.join(getInstanceDir(id), folder, filename)
    if (!fs.existsSync(fp)) return
    const stat = fs.statSync(fp)
    if (stat.isDirectory()) fs.rmSync(fp, { recursive: true, force: true })
    else fs.unlinkSync(fp)
    removeFileMeta(id, folder, filename)
  })

  ipcMain.handle('instances:openSubFolder', (_, id: string, folder: string) => {
    const dir = path.join(getInstanceDir(id), folder)
    fs.mkdirSync(dir, { recursive: true })
    return shell.openPath(dir)
  })

  ipcMain.handle('instances:getCrashReport', (_, id: string): string | null => {
    const crashDir = path.join(getInstanceDir(id), 'crash-reports')
    if (!fs.existsSync(crashDir)) return null
    const files = fs.readdirSync(crashDir)
      .filter(f => f.endsWith('.txt'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(crashDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    if (!files.length) return null
    return fs.readFileSync(path.join(crashDir, files[0].name), 'utf-8')
  })

  ipcMain.handle('app:openExternal', (_, url: string) => shell.openExternal(url))

  // ── Modrinth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('mr:search', (_, params: any) => mrSearch(params))

  ipcMain.handle('mr:getProject', (_, id: string) => mrGetProject(id))

  ipcMain.handle('mr:getProjectVersions', (_, id: string, gameVersions?: string[], loaders?: string[]) =>
    mrGetProjectVersions(id, gameVersions, loaders)
  )

  ipcMain.handle('mr:getVersion', (_, id: string) => mrGetVersion(id))

  ipcMain.handle('mr:installVersion', (_, instanceId: string, versionId: string, folder: string, mrSlug?: string) =>
    mrInstallVersion(instanceId, versionId, folder, mrSlug)
  )

  ipcMain.handle('mr:installModpack', async (_, projectId: string, versionId: string, name: string, logoUrl?: string) => {
    const win = getMainWindow()
    const instance = await mrInstallModpack(projectId, versionId, name, logoUrl, (p) => {
      win?.webContents.send('mr:installModpack:progress', p)
    })
    return instance
  })

  ipcMain.handle('mr:cancelInstall', () => {
    cancelMrInstall()
    return { ok: true }
  })
}
