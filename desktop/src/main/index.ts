import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDb, initializeDatabase } from './database/db'
import { registerIpcHandlers } from './ipc/handlers'
import { AuthService } from './services/AuthService'
import { EncryptionService } from './services/EncryptionService'
import { ConfigRepository } from './repositories/ConfigRepository'

// Auto-updater — only active in production builds
let autoUpdater: any = null
if (app.isPackaged) {
  try {
    const { autoUpdater: updater } = require('electron-updater')
    autoUpdater = updater
    autoUpdater.logger = require('electron').app  // use app's logger
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
  } catch {
    // electron-updater not available in this build
  }
}

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function getPreloadPath(): string {
  const candidates = [
    path.join(__dirname, '../preload/preload.js'),
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, 'preload.js'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return path.join(__dirname, '../preload/preload.js')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Teli Attendance',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(process.env.VITE_PUBLIC!, 'icon.png'),
    show: true,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
    // Check for updates after window is shown (production only)
    if (app.isPackaged && autoUpdater) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
          console.warn('[AutoUpdate] Check failed:', err.message)
        })
      }, 5000) // wait 5s after launch before checking
    }
  })

  // Open external links in browser, not in Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    // Initialize SQLite database (runs migrations automatically)
    await initializeDatabase()

    const db = getDb()
    AuthService.initialize(db)

    const configRepo = new ConfigRepository(db)
    const inst = db.prepare('SELECT id FROM institution LIMIT 1').get()
    if (inst) {
      try {
        await EncryptionService.initialize(
          (k: string) => configRepo.get(k),
          (k: string, v: string, l?: string) => configRepo.set(k, v, l)
        )
        await AuthService.createFirstAdminIfNeeded()
      } catch (e) {
        console.warn('[Startup] Encryption/admin init deferred:', e)
      }
    }

    // Register all IPC handlers
    registerIpcHandlers(ipcMain)

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (error) {
    console.error('Failed to initialize application:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
