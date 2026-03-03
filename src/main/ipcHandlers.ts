/**
 * Registro de todos los handlers IPC del proceso main.
 */
import { ipcMain, app } from 'electron'
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
  cfGetCategories,
} from './services/curseforgeService'
import { installCurseForgeModpack } from './services/modpackInstaller'
import { launchInstance, isInstanceRunning, stopInstance } from './services/gameLauncher'
import { downloadFile } from './utils/downloadHelper'
import path from 'path'
import fs from 'fs'

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

  ipcMain.handle('java:download', async (_, version: 8 | 17 | 21) => {
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

  ipcMain.handle('instances:clone', async (_, id: string) => cloneInstance(id))

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

    await launchInstance(instance, win)
    return { ok: true }
  })

  ipcMain.handle('instances:getMods', (_, id: string) => listMods(id))

  ipcMain.handle('instances:toggleMod', (_, id: string, filename: string) =>
    toggleMod(id, filename)
  )

  ipcMain.handle('instances:removeMod', (_, id: string, filename: string) => {
    removeMod(id, filename)
    return { ok: true }
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

  ipcMain.handle('cf:getCategories', () => cfGetCategories(4471))

  ipcMain.handle('cf:getMod', (_, modId: number) => cfGetMod(modId))

  ipcMain.handle('cf:getModDescription', (_, modId: number) => cfGetModDescription(modId))

  ipcMain.handle('cf:getModFiles', (_, modId: number, gameVersion?: string, loaderType?: number) =>
    cfGetModFiles(modId, gameVersion, loaderType)
  )

  ipcMain.handle('cf:installModpack', async (_, modpackId: number, fileId: number, name: string, logoUrl?: string, fileVersion?: string) => {
    const win = getMainWindow()
    const instance = await installCurseForgeModpack(modpackId, fileId, name, logoUrl, (p) => {
      win?.webContents.send('cf:installProgress', p)
    }, fileVersion)
    return instance
  })

  // ── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:save', (_, partial: any) => {
    saveSettings(partial)
    return { ok: true }
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())
}
