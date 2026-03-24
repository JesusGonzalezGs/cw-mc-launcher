/**
 * Tipado del API expuesto por el preload.
 * Permite usar window.launcher.* con tipos correctos en el renderer.
 */

declare global {
  interface Window {
    launcher: {
      launcherUser: {
        login: () => Promise<any>
        logout: () => Promise<any>
        getUser: () => Promise<any>
      }
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
        export: (id: string) => Promise<{ ok?: boolean; canceled?: boolean; filePath?: string }>
        pickImportFile: () => Promise<{ ok?: boolean; canceled?: boolean; zipPath?: string; name?: string }>
        import: (zipPath: string, customName: string) => Promise<{ ok?: boolean; instance?: any }>
        patch: (id: string, partial: Record<string, any>) => Promise<any>
        isRunning: (id: string) => Promise<boolean>
        stop: (id: string) => Promise<any>
        launch: (instance: any) => Promise<any>
        getMods: (id: string) => Promise<string[]>
        getModsMeta: (id: string) => Promise<import('../types').AssetsJson>
        checkModUpdates: (id: string, folder: string) => Promise<import('../types').ModUpdateInfo[]>
        applyModUpdate: (id: string, folder: string, update: import('../types').ModUpdateInfo) => Promise<void>
        toggleMod: (id: string, filename: string) => Promise<string>
        removeMod: (id: string, filename: string) => Promise<any>
        identifyMods: (instanceId: string) => Promise<any>
        openFolder: (id: string) => Promise<void>
        watchMods: (id: string) => Promise<void>
        unwatchMods: (id: string) => Promise<void>
        toggleFile: (id: string, folder: string, filename: string) => Promise<string>
        listFolder: (id: string, folder: string) => Promise<{ name: string; isDir: boolean }[]>
        deleteFile: (id: string, folder: string, filename: string) => Promise<void>
        getFilesMeta: (id: string, folder: string) => Promise<import('../types').AssetsJson>
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
        installMod: (instanceId: string, modId: number, fileId: number) => Promise<{ ok: boolean; filename: string }>
        installModWithDeps: (instanceId: string, modId: number, fileId: number) => Promise<any>
        installFile: (instanceId: string, folder: string, modId: number, fileId: number) => Promise<{ ok: boolean; filename: string }>
        cancelInstall: () => Promise<void>
        onInstallProgress: (cb: (p: import('../types').InstallProgress) => void) => () => void
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
      updater: {
        install: () => Promise<void>
        check: () => Promise<{ hasUpdate: boolean; version?: string }>
      }
      app: {
        getVersion: () => Promise<string>
      }
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
      openExternal: (url: string) => Promise<void>
    }
  }
}

export {}
