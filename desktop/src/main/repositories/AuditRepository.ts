import type Database from 'better-sqlite3'
import type { AuditLog, AuditFilters } from '../ipc/types'

export class AuditRepository {
  constructor(private db: Database.Database) {}

  list(filters?: AuditFilters): AuditLog[] {
    let sql = 'SELECT * FROM audit_log WHERE 1=1'
    const params: unknown[] = []

    if (filters?.entity_type) {
      sql += ' AND entity_type = ?'
      params.push(filters.entity_type)
    }
    if (filters?.action) {
      sql += ' AND action = ?'
      params.push(filters.action)
    }
    if (filters?.from_date) {
      sql += ' AND timestamp >= ?'
      params.push(filters.from_date)
    }
    if (filters?.to_date) {
      sql += ' AND timestamp <= ?'
      params.push(filters.to_date)
    }

    sql += ' ORDER BY timestamp DESC'
    sql += ` LIMIT ${filters?.limit ?? 500}`

    return this.db.prepare(sql).all(...params) as AuditLog[]
  }

  log(entry: Omit<AuditLog, 'audit_id' | 'timestamp'>): void {
    this.db
      .prepare(`
        INSERT INTO audit_log
          (audit_id, institution_id, user_id, user_role, action, entity_type,
           entity_id, old_value, new_value, reason, device_id)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.institution_id ?? null,
        entry.user_id ?? null,
        entry.user_role ?? null,
        entry.action,
        entry.entity_type,
        entry.entity_id ?? null,
        entry.old_value ?? null,
        entry.new_value ?? null,
        entry.reason ?? null,
        entry.device_id ?? null
      )
  }
}
