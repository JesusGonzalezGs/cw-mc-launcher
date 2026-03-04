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
        getCategories: () => Promise<any>
        getMod: (modId: number) => Promise<any>
        getModDescription: (modId: number) => Promise<string>
        getModFiles: (modId: number, gameVersion?: string, loaderType?: number) => Promise<any>
        installModpack: (modpackId: number, fileId: number, name: string, logoUrl?: string, fileVersion?: string) => Promise<any>
        getFileDetails: (modId: number, fileId: number) => Promise<any>
        getDownloadUrl: (modId: number, fileId: number) => Promise<string>
      }
      settings: {
        get: () => Promise<any>
        save: (partial: any) => Promise<any>
      }
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}

export {}
