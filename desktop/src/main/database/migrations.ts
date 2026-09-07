import type Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * Resolve the migrations directory.
 * - Development: files live under src/main/database/migration-files/
 *   Vite bundles the main process to dist-electron/main/, so we walk
 *   up from __dirname to find the source migration-files folder.
 * - Production: migration files are copied alongside the bundle via
 *   electron-builder's extraResources config.
 */
function getMigrationsDir(): string {
  // Production: files are in resources/migration-files next to the app
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'migration-files')
  }
  // Development: walk up from dist-electron/main → project root → src/main/database
  const candidates = [
    path.join(__dirname, 'migration-files'),                                          // same dir (if copied)
    path.join(__dirname, '..', '..', 'src', 'main', 'database', 'migration-files'), // from dist-electron/main
    path.join(__dirname, '..', '..', '..', 'src', 'main', 'database', 'migration-files'), // one level deeper
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  // Fallback
  return path.join(__dirname, 'migration-files')
}

const MIGRATIONS_DIR = getMigrationsDir()

/**
 * Runs all pending SQL migration files in order.
 *
 * Strategy:
 * 1. Ensure the schema_version table exists.
 * 2. Find all .sql files in the migrations directory.
 * 3. Apply any that are not yet recorded in schema_version.
 * 4. Wrap each migration in a transaction for atomicity.
 */
export async function runMigrations(db: Database.Database): Promise<void> {
  // Ensure the schema_version tracking table exists first
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      filename    TEXT NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Get already-applied versions
  const applied = db
    .prepare('SELECT version FROM schema_version ORDER BY version')
    .all() as { version: number }[]
  const appliedVersions = new Set(applied.map((r) => r.version))

  // Read migration files
  let files: string[] = []
  try {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    console.log(`[Migrations] Directory: ${MIGRATIONS_DIR} (${files.length} files found)`)
  } catch {
    console.warn(`[Migrations] Directory not found: ${MIGRATIONS_DIR} — skipping`)
    return
  }

  let appliedCount = 0

  for (const filename of files) {
    // Extract version number from filename: e.g., 001_initial.sql → 1
    const match = filename.match(/^(\d+)_/)
    if (!match) {
      console.warn(`[Migrations] Skipping file with no version prefix: ${filename}`)
      continue
    }

    const version = parseInt(match[1], 10)

    if (appliedVersions.has(version)) {
      continue // Already applied
    }

    const filePath = path.join(MIGRATIONS_DIR, filename)
    const sql = fs.readFileSync(filePath, 'utf-8')

    console.log(`[Migrations] Applying: ${filename}`)

    // Each migration runs inside a transaction
    const applyMigration = db.transaction(() => {
      db.exec(sql)
      db.prepare(
        'INSERT INTO schema_version (version, filename) VALUES (?, ?)'
      ).run(version, filename)
    })

    applyMigration()
    appliedCount++
    console.log(`[Migrations] Applied: ${filename}`)
  }

  if (appliedCount === 0) {
    console.log('[Migrations] Database is up to date')
  } else {
    console.log(`[Migrations] Applied ${appliedCount} migration(s)`)
  }
}
