import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null

/**
 * Returns the single shared SQLite connection.
 * Must be called only from the main process.
 * The renderer process must never access the DB directly — use IPC.
 */
export function getDb(): Database.Database {
  if (!_db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() before getDb().'
    )
  }
  return _db
}

/**
 * Initializes the SQLite database.
 * - Determines the correct data path
 * - Creates the directory if needed
 * - Opens the connection
 * - Applies pragmas
 * - Runs pending migrations
 */
export async function initializeDatabase(): Promise<void> {
  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  const dbPath = path.join(dataDir, 'attendance.db')
  console.log(`[DB] Opening database at: ${dbPath}`)

  _db = new Database(dbPath, {
    // verbose: console.log, // Uncomment for SQL logging during development
  })

  // Apply mandatory pragmas
  _db.pragma('foreign_keys = ON')
  _db.pragma('journal_mode = WAL')
  _db.pragma('busy_timeout = 5000')
  _db.pragma('synchronous = NORMAL') // Safe with WAL mode, better performance
  _db.pragma('temp_store = MEMORY')
  _db.pragma('mmap_size = 268435456') // 256 MB memory-mapped I/O

  console.log('[DB] Pragmas applied')

  // Run migrations
  await runMigrations(_db)

  console.log('[DB] Database ready')
}

/**
 * Performs a safe online backup of the SQLite database.
 * Uses better-sqlite3's .backup() which uses the SQLite Online Backup API.
 * Safe to run while the database is active.
 */
export async function backupDatabase(destinationPath: string): Promise<void> {
  const db = getDb()
  await db.backup(destinationPath)
  console.log(`[DB] Backup created at: ${destinationPath}`)
}

/**
 * Closes the database connection gracefully.
 * Called on app exit.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close()
    _db = null
    console.log('[DB] Database connection closed')
  }
}

/**
 * Returns the writable data directory for the application.
 * On Windows: C:\ProgramData\TeliAttendance\data
 * Falls back to Electron userData if ProgramData is unavailable.
 */
function getDataDir(): string {
  if (process.env.NODE_ENV === 'development') {
    // In development, store DB next to the project
    return path.join(app.getAppPath(), '../../data')
  }

  // In production: use ProgramData on Windows, or userData elsewhere
  if (process.platform === 'win32') {
    const programData = process.env['PROGRAMDATA'] || 'C:\\ProgramData'
    return path.join(programData, 'TeliAttendance', 'data')
  }

  // macOS / Linux
  return path.join(app.getPath('userData'), 'data')
}
