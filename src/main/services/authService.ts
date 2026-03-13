/**
 * Autenticación del launcher (Google) y de cuentas Minecraft (MSA + offline).
 * Google OAuth usa el flujo de "aplicación de escritorio" con BrowserWindow.
 * MSA usa la cadena completa OAuth2 → XBL → XSTS → MC.
 */
import { BrowserWindow } from 'electron'
import { v5 as uuidV5 } from 'uuid'
import {
  saveAccount, getAccounts, getSettings, saveSettings,
  saveLauncherUser, deleteLauncherUser,
} from '../store'
import type { Account, LauncherUser } from '../store'

// ── Google OAuth ──────────────────────────────────────────────────────────────
// IMPORTANTE: Crea credenciales OAuth 2.0 de tipo "Aplicación de escritorio"
// en https://console.cloud.google.com/ y pega aquí tu Client ID y Secret.
// Para Desktop Apps Google permite cualquier puerto en 127.0.0.1 sin configuración.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const GOOGLE_REDIRECT_URI = 'http://127.0.0.1:19231/oauth2callback'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

async function openGoogleAuthWindow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 520,
      height: 680,
      title: 'Iniciar sesión con Google',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'auth-google',
      },
    })

    const url = new URL(GOOGLE_AUTH_URL)
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'select_account')

    authWindow.loadURL(url.toString())

    const handleRedirect = (_: any, redirectUrl: string) => {
      if (!redirectUrl.startsWith(GOOGLE_REDIRECT_URI)) return
      const params = new URL(redirectUrl).searchParams
      const code = params.get('code')
      const error = params.get('error')
      authWindow.close()
      if (code) resolve(code)
      else reject(new Error(error ?? 'Autenticación cancelada'))
    }

    authWindow.webContents.on('will-redirect', handleRedirect)
    authWindow.webContents.on('will-navigate', handleRedirect)
    authWindow.on('closed', () => reject(new Error('Ventana de autenticación cerrada')))
  })
}

async function exchangeGoogleCode(code: string): Promise<any> {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  })
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!resp.ok) throw new Error(`Google token exchange error: ${resp.status}`)
  return resp.json()
}

async function fetchGoogleUserInfo(accessToken: string): Promise<any> {
  const resp = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) throw new Error(`Google userinfo error: ${resp.status}`)
  return resp.json()
}

export async function loginWithGoogle(): Promise<LauncherUser> {
  const code = await openGoogleAuthWindow()
  const tokens = await exchangeGoogleCode(code)
  const userInfo = await fetchGoogleUserInfo(tokens.access_token)

  const launcherUser: LauncherUser = {
    id: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  }
  saveLauncherUser(launcherUser)
  return launcherUser
}

export function logoutFromLauncher(): void {
  deleteLauncherUser()
}

// Client ID público usado por launchers de la comunidad (MultiMC, etc.)
const CLIENT_ID = '00000000402b5328'
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf'
const SCOPE = 'XboxLive.signin offline_access'

// Este client ID usa los endpoints LIVE (no Azure AD)
const MSA_AUTH_URL = 'https://login.live.com/oauth20_authorize.srf'
const MSA_TOKEN_URL = 'https://login.live.com/oauth20_token.srf'
const XBL_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_AUTH_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'

// Namespace UUID para modo offline (UUID v5 determinístico)
const OFFLINE_NAMESPACE = '00000000-0000-0000-0000-000000000000'

async function openMsaAuthWindow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 520,
      height: 680,
      title: 'Iniciar sesión con Microsoft',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'auth-msa',   // sesión aislada para evitar caché de logins fallidos
      },
    })

    const url = new URL(MSA_AUTH_URL)
    url.searchParams.set('client_id', CLIENT_ID)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', REDIRECT_URI)
    url.searchParams.set('scope', 'service::user.auth.xboxlive.com::MBI_SSL')
    url.searchParams.set('prompt', 'select_account')

    authWindow.loadURL(url.toString())

    const handleRedirect = (_: any, redirectUrl: string) => {
      if (!redirectUrl.startsWith(REDIRECT_URI)) return
      const params = new URL(redirectUrl).searchParams
      const code = params.get('code')
      const error = params.get('error')
      authWindow.close()
      if (code) resolve(code)
      else reject(new Error(error ?? 'Autenticación cancelada'))
    }

    authWindow.webContents.on('will-redirect', handleRedirect)
    authWindow.webContents.on('will-navigate', handleRedirect)
    authWindow.on('closed', () => reject(new Error('Ventana de auth cerrada por el usuario')))
  })
}

async function exchangeMsaCode(code: string): Promise<any> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    scope: 'service::user.auth.xboxlive.com::MBI_SSL',
  })
  const resp = await fetch(MSA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!resp.ok) throw new Error(`MSA token exchange error: ${resp.status}`)
  return (await resp.json()) as any
}

async function refreshMsaToken(refreshToken: string): Promise<any> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPE,
  })
  const resp = await fetch(MSA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!resp.ok) throw new Error(`MSA token refresh error: ${resp.status}`)
  return resp.json() as Promise<any>
}

async function authenticateXboxLive(msaAccessToken: string): Promise<any> {
  const resp = await fetch(XBL_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `t=${msaAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  })
  if (!resp.ok) throw new Error(`XBL auth error: ${resp.status}`)
  return resp.json() as Promise<any>
}

async function getXstsToken(xblToken: string): Promise<any> {
  const resp = await fetch(XSTS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  })
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as any
    if (err.XErr === 2148916233) throw new Error('Esta cuenta de Microsoft no tiene una cuenta de Xbox. Crea una primero.')
    if (err.XErr === 2148916238) throw new Error('Cuentas de menores no están permitidas sin supervisión parental.')
    throw new Error(`XSTS auth error: ${resp.status}`)
  }
  return resp.json() as Promise<any>
}

async function getMinecraftToken(userHash: string, xstsToken: string): Promise<any> {
  const resp = await fetch(MC_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` }),
  })
  if (!resp.ok) throw new Error(`Minecraft auth error: ${resp.status}`)
  return resp.json() as Promise<any>
}

async function getMinecraftProfile(mcAccessToken: string): Promise<any> {
  const resp = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  })
  if (resp.status === 404) throw new Error('Esta cuenta de Microsoft no tiene Minecraft Java Edition.')
  if (!resp.ok) throw new Error(`MC profile error: ${resp.status}`)
  return resp.json() as Promise<any>
}

export async function loginWithMicrosoft(): Promise<Account> {
  const code = await openMsaAuthWindow()
  const msaTokens = await exchangeMsaCode(code)
  const xbl = await authenticateXboxLive(msaTokens.access_token)
  const xsts = await getXstsToken(xbl.Token)
  const mcToken = await getMinecraftToken(xsts.DisplayClaims.xui[0].uhs, xsts.Token)
  const profile = await getMinecraftProfile(mcToken.access_token)

  const account: Account = {
    type: 'msa',
    username: profile.name,
    uuid: profile.id,
    accessToken: mcToken.access_token,
    refreshToken: msaTokens.refresh_token,
    expiresAt: Date.now() + (msaTokens.expires_in ?? 86400) * 1000,
    skinUrl: profile.skins?.[0]?.url,
  }

  saveAccount(profile.id, account)
  if (!getSettings().activeAccountId) {
    saveSettings({ activeAccountId: profile.id })
  }
  return account
}

export function loginOffline(username: string): Account {
  const uuid = uuidV5(username, OFFLINE_NAMESPACE)
  const account: Account = {
    type: 'offline',
    username,
    uuid,
    accessToken: 'offline',
    refreshToken: '',
    expiresAt: 0,
  }
  saveAccount(uuid, account)
  if (!getSettings().activeAccountId) {
    saveSettings({ activeAccountId: uuid })
  }
  return account
}

export async function refreshAccountIfNeeded(accountId: string): Promise<Account | null> {
  const accounts = getAccounts()
  const account = accounts[accountId]
  if (!account || account.type === 'offline') return account ?? null

  // Refrescar si expira en menos de 5 minutos
  if (account.expiresAt - Date.now() > 5 * 60 * 1000) return account

  try {
    const msaTokens = await refreshMsaToken(account.refreshToken)
    const xbl = await authenticateXboxLive(msaTokens.access_token)
    const xsts = await getXstsToken(xbl.Token)
    const mcToken = await getMinecraftToken(xsts.DisplayClaims.xui[0].uhs, xsts.Token)

    const updated: Account = {
      ...account,
      accessToken: mcToken.access_token,
      refreshToken: msaTokens.refresh_token,
      expiresAt: Date.now() + (msaTokens.expires_in ?? 86400) * 1000,
    }
    saveAccount(accountId, updated)
    return updated
  } catch (err: any) {
    console.error('Error refrescando token MSA:', err.message)
    return null
  }
}
