import Store from 'electron-store'
import { app } from 'electron'
import path from 'path'

export interface Account {
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
  launchMode: 'cwmc' | 'official'
}

function getDefaultDirs() {
  const userData = app.getPath('userData')
  return {
    instancesDir: path.join(userData, 'instances'),
    assetsDir: path.join(userData, 'assets'),
    javaDir: path.join(userData, 'java'),
  }
}

const schema: any = {
  accounts: { type: 'object', default: {} },
  settings: { type: 'object', default: {} },
}

export const store = new Store({ schema })

export function getAccounts(): Record<string, Account> {
  return (store.get('accounts') as Record<string, Account>) ?? {}
}

export function saveAccount(id: string, account: Account): void {
  const accounts = getAccounts()
  accounts[id] = account
  store.set('accounts', accounts)
}

export function deleteAccount(id: string): void {
  const accounts = getAccounts()
  delete accounts[id]
  store.set('accounts', accounts)
}

export function getSettings(): AppSettings {
  const defaults = getDefaultDirs()
  const stored = (store.get('settings') as Partial<AppSettings>) ?? {}
  return {
    activeAccountId: stored.activeAccountId ?? null,
    jvmArgs: stored.jvmArgs ?? '-Xmx2G -XX:+UseG1GC',
    instancesDir: stored.instancesDir || defaults.instancesDir,
    assetsDir: stored.assetsDir || defaults.assetsDir,
    javaDir: stored.javaDir || defaults.javaDir,
    cfApiToken: stored.cfApiToken ?? '',
    windowWidth: stored.windowWidth ?? 1200,
    windowHeight: stored.windowHeight ?? 760,
    launchMode: stored.launchMode ?? 'cwmc',
  }
}

export function saveSettings(partial: Partial<AppSettings>): void {
  store.set('settings', { ...getSettings(), ...partial })
}
