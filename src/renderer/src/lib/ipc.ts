/**
 * Tipado del API expuesto por el preload.
 * Permite usar window.launcher.* con tipos correctos en el renderer.
 */

declare global {
  interface Window {
    launcher: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      java: {
        getStatus: () => Promise<any[]>
        download: (version: number) => Promise<any>
        pollStatus: () => Promise<any[]>
        getForMcVersion: (mcVersion: string) => Promise<any>
      }
      auth: {
        loginMsa: () => Promise<any>
        loginOffline: (username: string) => Promise<any>
        listAccounts: () => Promise<any[]>
        setActive: (id: string) => Promise<any>
        logout: (id: string) => Promise<any>
        getActive: () => Promise<any>
      }
      instances: {
        list: () => Promise<any[]>
        get: (id: string) => Promise<any>
        create: (params: any) => Promise<any>
        delete: (id: string) => Promise<any>
        clone: (id: string, customName?: string) => Promise<any>
        isRunning: (id: string) => Promise<boolean>
        stop: (id: string) => Promise<any>
        launch: (instance: any) => Promise<any>
        getMods: (id: string) => Promise<string[]>
        getModsMeta: (id: string) => Promise<any>
        toggleMod: (id: string, filename: string) => Promise<string>
        removeMod: (id: string, filename: string) => Promise<any>
        installMod: (instanceId: string, modId: number, fileId: number) => Promise<any>
        installModWithDeps: (instanceId: string, modId: number, fileId: number) => Promise<any>
        identifyMods: (instanceId: string) => Promise<any>
        openFolder: (id: string) => Promise<void>
        toggleFile: (id: string, folder: string, filename: string) => Promise<string>
        installFile: (id: string, folder: string, modId: number, fileId: number) => Promise<{ ok: boolean; filename: string }>
        listFolder: (id: string, folder: string) => Promise<{ name: string; isDir: boolean }[]>
        deleteFile: (id: string, folder: string, filename: string) => Promise<void>
        getFilesMeta: (id: string, folder: string) => Promise<{ files: Record<string, any> }>
        identifyFiles: (id: string, folder: string) => Promise<void>
        openSubFolder: (id: string, folder: string) => Promise<void>
        getCrashReport: (id: string) => Promise<string | null>
      }
      mc: {
        getVersionManifest: () => Promise<any>
        isVersionDownloaded: (versionId: string) => Promise<boolean>
        downloadVersion: (versionId: string) => Promise<any>
      }
      loaders: {
        fabricVersions: () => Promise<any[]>
        quiltVersions: () => Promise<any[]>
        forgeVersions: (mcVersion: string) => Promise<string[]>
        neoforgeVersions: (mcVersion: string) => Promise<string[]>
        installFabric: (mc: string, loader: string) => Promise<any>
        installQuilt: (mc: string, loader: string) => Promise<any>
        installForge: (mc: string, loader: string) => Promise<{ versionId: string }>
        installNeoForge: (mc: string, loader: string) => Promise<{ versionId: string }>
      }
      cf: {
        searchModpacks: (params: any) => Promise<any>
        searchMods: (params: any) => Promise<any>
        searchFiles: (params: any) => Promise<any>
        getCategories: () => Promise<any>
        getMod: (modId: number) => Promise<any>
        getModDescription: (modId: number) => Promise<string>
        getModFiles: (modId: number, gameVersion?: string, loaderType?: number) => Promise<any>
        installModpack: (modpackId: number, fileId: number, name: string, logoUrl?: string, fileVersion?: string, slug?: string) => Promise<any>
        getFileDetails: (modId: number, fileId: number) => Promise<any>
        getFileChangelog: (modId: number, fileId: number) => Promise<string>
        getDownloadUrl: (modId: number, fileId: number) => Promise<string>
        cancelInstall: () => Promise<void>
      }
      settings: {
        get: () => Promise<any>
        save: (partial: any) => Promise<any>
      }
      mr: {
        search: (params: any) => Promise<any>
        getProject: (id: string) => Promise<any>
        getProjectVersions: (id: string, gameVersions?: string[], loaders?: string[]) => Promise<any[]>
        getVersion: (id: string) => Promise<any>
        installVersion: (instanceId: string, versionId: string, folder: string, mrSlug?: string) => Promise<{ ok: boolean; filename: string }>
        installModpack: (projectId: string, versionId: string, name: string, logoUrl?: string) => Promise<any>
        cancelInstall: () => Promise<{ ok: boolean }>
        onInstallProgress: (cb: (p: any) => void) => () => void
      }
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
      openExternal: (url: string) => Promise<void>
    }
  }
}

export {}
