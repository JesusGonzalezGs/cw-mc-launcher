export type ModLoader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge'

export interface Instance {
  id: string
  name: string
  mcVersion: string
  modLoader: ModLoader
  modLoaderVersion: string
  resolvedVersionId: string
  iconPath?: string
  description?: string
  jvmArgs?: string
  lastPlayed?: number
  source: 'manual' | 'curseforge'
  cfMeta?: {
    modpackId: number
    fileId: number
    name: string
    logoUrl?: string
    fileVersion?: string
    slug?: string
  }
}

export interface Account {
  id: string
  type: 'msa' | 'offline'
  username: string
  uuid: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  skinUrl?: string
}

export interface AppSettings {
  activeAccountId: string | null
  jvmArgs: string
  instancesDir: string
  assetsDir: string
  javaDir: string
  cfApiToken: string
  windowWidth: number
  windowHeight: number
}

export interface JavaStatus {
  version: number
  ready: boolean
  status: 'idle' | 'downloading' | 'done' | 'error'
  progress: number
  error: string
}

export interface McVersion {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  releaseTime: string
}

export interface CfMod {
  id: number
  name: string
  summary: string
  logo?: { url: string }
  downloadCount: number
  dateModified: string
  latestFiles?: CfFile[]
  latestFilesIndexes?: { gameVersion: string; fileId: number; filename: string; releaseType: number; modLoader?: number }[]
}

export interface CfFile {
  id: number
  fileName: string
  displayName: string
  gameVersions: string[]
  sortableGameVersions?: { gameVersionName: string; gameVersionTypeId?: number }[]
  downloadCount: number
  fileDate: string
  downloadUrl?: string
}

export interface InstallProgress {
  stage: string
  current: number
  total: number
  percent: number
}
