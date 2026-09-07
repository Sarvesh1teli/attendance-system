import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { ConfigEntry } from '../ipc/types'

export class ConfigRepository {
  constructor(private db: Database.Database) {}

  getAll(): ConfigEntry[] {
    return this.db
      .prepare('SELECT * FROM institution_configuration ORDER BY config_key')
      .all() as ConfigEntry[]
  }

  get(key: string): string | null {
    const row = this.db
      .prepare('SELECT config_value FROM institution_configuration WHERE config_key = ?')
      .get(key) as { config_value: string } | undefined
    return row?.config_value ?? null
  }

  set(key: string, value: string, label?: string): void {
    const institutionRow = this.db
      .prepare('SELECT id FROM institution LIMIT 1')
      .get() as { id: string } | undefined
    if (!institutionRow) throw new Error('Institution not configured')

    const existing = this.db
      .prepare('SELECT config_id FROM institution_configuration WHERE config_key = ?')
      .get(key)

    if (existing) {
      this.db
        .prepare(`
          UPDATE institution_configuration
          SET config_value = ?, display_label = ?, updated_at = datetime('now')
          WHERE config_key = ?
        `)
        .run(value, label ?? null, key)
    } else {
      this.db
        .prepare(`
          INSERT INTO institution_configuration
            (config_id, institution_id, config_key, config_value, display_label)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(uuidv4(), institutionRow.id, key, value, label ?? null)
    }
  }
}
