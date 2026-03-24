import { contextBridge, ipcRenderer } from 'electron'

// Single ipcRenderer listener per channel; subscribers stored in a Set.
// Avoids MaxListenersExceededWarning regardless of how many components subscribe.
const _subs = new Map<string, Set<(...args: any[]) => void>>()

function _ensureChannel(channel: string) {
  if (_subs.has(channel)) return
  const set = new Set<(...args: any[]) => void>()
  _subs.set(channel, set)
  ipcRenderer.on(channel, (_event, ...args) => { for (const fn of set) fn(...args) })
}

// Canales permitidos para eventos entrantes (main → renderer)
const ALLOWED_EVENTS = [
  'game:log',
  'game:stopped',
  'game:error',
  'mc:downloadProgress',
  'loaders:progress',
  'cf:installProgress',
  'mod:installProgress',
  'mr:installModpack:progress',
  'update:available',
  'update:progress',
  'update:ready',
  'mods:changed',
] as const

contextBridge.exposeInMainWorld('launcher', {
  // ── Window ──────────────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // ── Java ────────────────────────────────────────────────────────────────────
  java: {
    getStatus: () => ipcRenderer.invoke('java:getStatus'),
    download: (version: number) => ipcRenderer.invoke('java:download', version),
    pollStatus: () => ipcRenderer.invoke('java:pollStatus'),
    getForMcVersion: (mcVersion: string) => ipcRenderer.invoke('java:getForMcVersion', mcVersion),
  },

  // ── Launcher user (Google) ───────────────────────────────────────────────────
  launcherUser: {
    login: () => ipcRenderer.invoke('launcher:loginGoogle'),
    logout: () => ipcRenderer.invoke('launcher:logoutGoogle'),
    getUser: () => ipcRenderer.invoke('launcher:getUser'),
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    loginMsa: () => ipcRenderer.invoke('auth:loginMsa'),
    loginOffline: (username: string) => ipcRenderer.invoke('auth:loginOffline', username),
    listAccounts: () => ipcRenderer.invoke('auth:listAccounts'),
    setActive: (id: string) => ipcRenderer.invoke('auth:setActive', id),
    logout: (id: string) => ipcRenderer.invoke('auth:logout', id),
    getActive: () => ipcRenderer.invoke('auth:getActive'),
  },

  // ── Instances ────────────────────────────────────────────────────────────────
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    get: (id: string) => ipcRenderer.invoke('instances:get', id),
    create: (params: any) => ipcRenderer.invoke('instances:create', params),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    clone: (id: string, customName?: string) => ipcRenderer.invoke('instances:clone', id, customName),
    patch: (id: string, partial: Record<string, any>) => ipcRenderer.invoke('instances:patch', id, partial),
    isRunning: (id: string) => ipcRenderer.invoke('instances:isRunning', id),
    stop: (id: string) => ipcRenderer.invoke('instances:stop', id),
    launch: (instance: any) => ipcRenderer.invoke('instances:launch', instance),
    getMods: (id: string) => ipcRenderer.invoke('instances:getMods', id),
    getModsMeta: (id: string) => ipcRenderer.invoke('instances:getModsMeta', id),
    checkModUpdates: (id: string, folder: string) => ipcRenderer.invoke('instances:checkModUpdates', id, folder),
    applyModUpdate: (id: string, folder: string, update: any) => ipcRenderer.invoke('instances:applyModUpdate', id, folder, update),
    toggleMod: (id: string, filename: string) => ipcRenderer.invoke('instances:toggleMod', id, filename),
    removeMod: (id: string, filename: string) => ipcRenderer.invoke('instances:removeMod', id, filename),
    identifyMods: (instanceId: string) =>
      ipcRenderer.invoke('instances:identifyMods', instanceId),
    openFolder: (id: string) => ipcRenderer.invoke('instances:openFolder', id),
    watchMods: (id: string) => ipcRenderer.invoke('instances:watchMods', id),
    unwatchMods: (id: string) => ipcRenderer.invoke('instances:unwatchMods', id),
    toggleFile: (id: string, folder: string, filename: string) => ipcRenderer.invoke('instances:toggleFile', id, folder, filename),
    listFolder: (id: string, folder: string) => ipcRenderer.invoke('instances:listFolder', id, folder),
    deleteFile: (id: string, folder: string, filename: string) => ipcRenderer.invoke('instances:deleteFile', id, folder, filename),
    getFilesMeta: (id: string, folder: string) => ipcRenderer.invoke('instances:getFilesMeta', id, folder),
    identifyFiles: (id: string, folder: string) => ipcRenderer.invoke('instances:identifyFiles', id, folder),
    openSubFolder: (id: string, folder: string) => ipcRenderer.invoke('instances:openSubFolder', id, folder),
    getCrashReport: (id: string) => ipcRenderer.invoke('instances:getCrashReport', id),
  },

  // ── Minecraft ────────────────────────────────────────────────────────────────
  mc: {
    getVersionManifest: () => ipcRenderer.invoke('mc:getVersionManifest'),
    isVersionDownloaded: (versionId: string) => ipcRenderer.invoke('mc:isVersionDownloaded', versionId),
    downloadVersion: (versionId: string) => ipcRenderer.invoke('mc:downloadVersion', versionId),
  },

  // ── Mod Loaders ──────────────────────────────────────────────────────────────
  loaders: {
    fabricVersions: () => ipcRenderer.invoke('loaders:fabricVersions'),
    quiltVersions: () => ipcRenderer.invoke('loaders:quiltVersions'),
    forgeVersions: (mcVersion: string) => ipcRenderer.invoke('loaders:forgeVersions', mcVersion),
    neoforgeVersions: (mcVersion: string) => ipcRenderer.invoke('loaders:neoforgeVersions', mcVersion),
    installFabric: (mc: string, loader: string) => ipcRenderer.invoke('loaders:installFabric', mc, loader),
    installQuilt: (mc: string, loader: string) => ipcRenderer.invoke('loaders:installQuilt', mc, loader),
    installForge: (mc: string, loader: string) => ipcRenderer.invoke('loaders:installForge', mc, loader),
    installNeoForge: (mc: string, loader: string) => ipcRenderer.invoke('loaders:installNeoForge', mc, loader),
  },

  // ── CurseForge ───────────────────────────────────────────────────────────────
  cf: {
    searchModpacks: (params: any) => ipcRenderer.invoke('cf:searchModpacks', params),
    searchMods: (params: any) => ipcRenderer.invoke('cf:searchMods', params),
    searchFiles: (params: any) => ipcRenderer.invoke('cf:searchFiles', params),
    getCategories: () => ipcRenderer.invoke('cf:getCategories'),
    getMod: (modId: number) => ipcRenderer.invoke('cf:getMod', modId),
    getFileDetails: (modId: number, fileId: number) => ipcRenderer.invoke('cf:getFileDetails', modId, fileId),
    getFileChangelog: (modId: number, fileId: number) => ipcRenderer.invoke('cf:getFileChangelog', modId, fileId),
    getModDescription: (modId: number) => ipcRenderer.invoke('cf:getModDescription', modId),
    getModFiles: (modId: number, gameVersion?: string, loaderType?: number) =>
      ipcRenderer.invoke('cf:getModFiles', modId, gameVersion, loaderType),
    installModpack: (modpackId: number, fileId: number, name: string, logoUrl?: string, fileVersion?: string, slug?: string) =>
      ipcRenderer.invoke('cf:installModpack', modpackId, fileId, name, logoUrl, fileVersion, slug),
    installMod: (instanceId: string, modId: number, fileId: number) =>
      ipcRenderer.invoke('cf:installMod', instanceId, modId, fileId),
    installModWithDeps: (instanceId: string, modId: number, fileId: number) =>
      ipcRenderer.invoke('cf:installModWithDeps', instanceId, modId, fileId),
    installFile: (instanceId: string, folder: string, modId: number, fileId: number) =>
      ipcRenderer.invoke('cf:installFile', instanceId, folder, modId, fileId),
    cancelInstall: () => ipcRenderer.invoke('cf:cancelInstall'),
    onInstallProgress: (cb: (p: any) => void) => {
      const wrapped = (_e: Electron.IpcRendererEvent, p: any) => cb(p)
      ;(cb as any).__cfWrapped = wrapped
      ipcRenderer.on('cf:installProgress', wrapped)
      return () => {
        ipcRenderer.removeListener('cf:installProgress', wrapped)
        delete (cb as any).__cfWrapped
      }
    },
  },

  // ── Modrinth ─────────────────────────────────────────────────────────────────
  mr: {
    search: (params: any) => ipcRenderer.invoke('mr:search', params),
    getProject: (id: string) => ipcRenderer.invoke('mr:getProject', id),
    getProjectVersions: (id: string, gameVersions?: string[], loaders?: string[]) =>
      ipcRenderer.invoke('mr:getProjectVersions', id, gameVersions, loaders),
    getVersion: (id: string) => ipcRenderer.invoke('mr:getVersion', id),
    installVersion: (instanceId: string, versionId: string, folder: string, mrSlug?: string) =>
      ipcRenderer.invoke('mr:installVersion', instanceId, versionId, folder, mrSlug),
    installModpack: (projectId: string, versionId: string, name: string, logoUrl?: string) =>
      ipcRenderer.invoke('mr:installModpack', projectId, versionId, name, logoUrl),
    cancelInstall: () => ipcRenderer.invoke('mr:cancelInstall'),
    onInstallProgress: (cb: (p: any) => void) => {
      const wrapped = (_e: Electron.IpcRendererEvent, p: any) => cb(p)
      ;(cb as any).__mrWrapped = wrapped
      ipcRenderer.on('mr:installModpack:progress', wrapped)
      return () => {
        ipcRenderer.removeListener('mr:installModpack:progress', wrapped)
        delete (cb as any).__mrWrapped
      }
    },
  },

  // ── Updater ──────────────────────────────────────────────────────────────────
  updater: {
    install: () => ipcRenderer.invoke('update:install'),
    check: () => ipcRenderer.invoke('update:check'),
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial: any) => ipcRenderer.invoke('settings:save', partial),
  },

  // ── Shell ─────────────────────────────────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),

  // ── Eventos de main → renderer ───────────────────────────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (!(ALLOWED_EVENTS as readonly string[]).includes(channel)) return
    _ensureChannel(channel)
    _subs.get(channel)!.add(callback)
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    if (!(ALLOWED_EVENTS as readonly string[]).includes(channel)) return
    _subs.get(channel)?.delete(callback)
  },
})
