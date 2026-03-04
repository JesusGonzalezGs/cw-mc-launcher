import { contextBridge, ipcRenderer } from 'electron'

// Canales permitidos para eventos entrantes (main → renderer)
const ALLOWED_EVENTS = [
  'game:log',
  'game:stopped',
  'game:error',
  'mc:downloadProgress',
  'loaders:progress',
  'cf:installProgress',
  'mod:installProgress',
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
    isRunning: (id: string) => ipcRenderer.invoke('instances:isRunning', id),
    stop: (id: string) => ipcRenderer.invoke('instances:stop', id),
    launch: (instance: any) => ipcRenderer.invoke('instances:launch', instance),
    getMods: (id: string) => ipcRenderer.invoke('instances:getMods', id),
    getModsMeta: (id: string) => ipcRenderer.invoke('instances:getModsMeta', id),
    toggleMod: (id: string, filename: string) => ipcRenderer.invoke('instances:toggleMod', id, filename),
    removeMod: (id: string, filename: string) => ipcRenderer.invoke('instances:removeMod', id, filename),
    installMod: (instanceId: string, modId: number, fileId: number) =>
      ipcRenderer.invoke('instances:installMod', instanceId, modId, fileId),
    installModWithDeps: (instanceId: string, modId: number, fileId: number) =>
      ipcRenderer.invoke('instances:installModWithDeps', instanceId, modId, fileId),
    identifyMods: (instanceId: string) =>
      ipcRenderer.invoke('instances:identifyMods', instanceId),
    openFolder: (id: string) => ipcRenderer.invoke('instances:openFolder', id),
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
    getCategories: () => ipcRenderer.invoke('cf:getCategories'),
    getMod: (modId: number) => ipcRenderer.invoke('cf:getMod', modId),
    getFileDetails: (modId: number, fileId: number) => ipcRenderer.invoke('cf:getFileDetails', modId, fileId),
    getModDescription: (modId: number) => ipcRenderer.invoke('cf:getModDescription', modId),
    getModFiles: (modId: number, gameVersion?: string, loaderType?: number) =>
      ipcRenderer.invoke('cf:getModFiles', modId, gameVersion, loaderType),
    installModpack: (modpackId: number, fileId: number, name: string, logoUrl?: string, fileVersion?: string) =>
      ipcRenderer.invoke('cf:installModpack', modpackId, fileId, name, logoUrl, fileVersion),
    cancelInstall: () => ipcRenderer.invoke('cf:cancelInstall'),
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial: any) => ipcRenderer.invoke('settings:save', partial),
  },

  // ── Eventos de main → renderer ───────────────────────────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (!(ALLOWED_EVENTS as readonly string[]).includes(channel)) return
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    if (!(ALLOWED_EVENTS as readonly string[]).includes(channel)) return
    ipcRenderer.removeListener(channel, callback)
  },
})
