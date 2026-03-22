import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipcHandlers'

// Descarga automáticamente en segundo plano, instala al cerrar o al pedir
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#0a0a14',
    icon: is.dev ? join(__dirname, '../../resources/icon.png') : join(process.resourcesPath, 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {})
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Open external links in the system browser instead of navigating inside Electron
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL'] ?? ''
    const isInternal = url.startsWith('file://') || (rendererUrl && url.startsWith(rendererUrl))
    if (!isInternal && (url.startsWith('http://') || url.startsWith('https://'))) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cubewatcher.launcher')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  registerIpcHandlers()
  createWindow()

  // ── Auto-updater ────────────────────────────────────────────────────────
  if (app.isPackaged) {
    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update:available', { version: info.version })
    })
    autoUpdater.on('download-progress', (p) => {
      mainWindow?.webContents.send('update:progress', { percent: Math.floor(p.percent) })
    })
    autoUpdater.on('update-downloaded', (info) => {
      mainWindow?.webContents.send('update:ready', { version: info.version })
    })

    ipcMain.handle('update:install', () => autoUpdater.quitAndInstall())
    ipcMain.handle('update:check', async () => {
      const result = await autoUpdater.checkForUpdates().catch(() => null)
      return result ? { hasUpdate: true, version: result.updateInfo.version } : { hasUpdate: false }
    })
  } else {
    ipcMain.handle('update:install', () => {})
    ipcMain.handle('update:check', () => ({ hasUpdate: false }))
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export function getMainWindow() {
  return mainWindow
}
