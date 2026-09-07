import type Database from 'better-sqlite3'

export type NotificationType =
  | 'SHORTAGE_ALERT'
  | 'SESSION_REMINDER'
  | 'SYNC_SUCCESS'
  | 'SYNC_FAILED'
  | 'PARENT_ALERT'
  | 'SYSTEM'

export type NotificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

export interface AppNotification {
  notification_id: string
  institution_id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

export interface CreateNotificationInput {
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  message: string
  entity_type?: string
  entity_id?: string
  action_url?: string
}

export interface NotificationFilters {
  unread_only?: boolean
  type?: NotificationType
  severity?: NotificationSeverity
  limit?: number
}

export class NotificationRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  create(input: CreateNotificationInput): AppNotification {
    const institutionId = this.institutionId()
    const row = this.db.prepare(`
      INSERT INTO notification
        (institution_id, type, severity, title, message, entity_type, entity_id, action_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      institutionId,
      input.type,
      input.severity ?? 'INFO',
      input.title,
      input.message,
      input.entity_type ?? null,
      input.entity_id ?? null,
      input.action_url ?? null
    ) as any
    return this.map(row)
  }

  list(filters: NotificationFilters = {}): AppNotification[] {
    const institutionId = this.institutionId()
    const conditions = ['institution_id = ?']
    const params: (string | number)[] = [institutionId]

    if (filters.unread_only) { conditions.push('is_read = 0') }
    if (filters.type) { conditions.push('type = ?'); params.push(filters.type) }
    if (filters.severity) { conditions.push('severity = ?'); params.push(filters.severity) }

    const limit = filters.limit ?? 200
    const sql = `
      SELECT * FROM notification
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(this.map)
  }

  getUnreadCount(): number {
    const institutionId = this.institutionId()
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM notification WHERE institution_id = ? AND is_read = 0'
    ).get(institutionId) as { cnt: number }
    return row.cnt
  }

  markRead(notificationId: string): void {
    this.db.prepare(
      `UPDATE notification SET is_read = 1 WHERE notification_id = ?`
    ).run(notificationId)
  }

  markAllRead(): void {
    const institutionId = this.institutionId()
    this.db.prepare(
      `UPDATE notification SET is_read = 1 WHERE institution_id = ? AND is_read = 0`
    ).run(institutionId)
  }

  delete(notificationId: string): void {
    this.db.prepare('DELETE FROM notification WHERE notification_id = ?').run(notificationId)
  }

  deleteAll(): void {
    const institutionId = this.institutionId()
    this.db.prepare('DELETE FROM notification WHERE institution_id = ?').run(institutionId)
  }

  /** Prevent duplicate shortage alerts per student per day */
  hasRecentShortageAlert(studentId: string, hoursBack = 24): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM notification
      WHERE entity_type = 'STUDENT'
        AND entity_id = ?
        AND type = 'SHORTAGE_ALERT'
        AND created_at >= datetime('now', ? || ' hours')
      LIMIT 1
    `).get(studentId, `-${hoursBack}`) as unknown
    return !!row
  }

  private map(row: any): AppNotification {
    return {
      ...row,
      is_read: !!row.is_read,
    }
  }
}
