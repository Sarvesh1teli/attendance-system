import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { TimetableSlot, CreateTimetableSlotInput, UpdateTimetableSlotInput } from '../ipc/types'

export class TimetableRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  private readonly JOIN_SQL = `
    SELECT
      ts.slot_id,
      ts.institution_id,
      ts.subject_id,
      sub.subject_name,
      sub.subject_code,
      ts.batch_id,
      b.batch_name,
      ts.group_id,
      sg.group_name,
      ts.faculty_id,
      f.name          AS faculty_name,
      ts.room,
      ts.day_of_week,
      ts.start_time,
      ts.end_time,
      ts.effective_from,
      ts.effective_until,
      ts.active,
      ts.created_at,
      ts.updated_at
    FROM timetable_slot ts
    JOIN subject sub ON sub.subject_id = ts.subject_id
    JOIN batch b     ON b.batch_id = ts.batch_id
    LEFT JOIN student_group sg ON sg.student_group_id = ts.group_id
    LEFT JOIN faculty f        ON f.faculty_id = ts.faculty_id
  `

  list(filters: { day_of_week?: number; active_only?: boolean } = {}): TimetableSlot[] {
    const institutionId = this.institutionId()
    const conditions = [`ts.institution_id = ?`]
    const params: (string | number)[] = [institutionId]

    if (filters.day_of_week !== undefined) {
      conditions.push('ts.day_of_week = ?')
      params.push(filters.day_of_week)
    }
    if (filters.active_only) {
      conditions.push('ts.active = 1')
    }

    const rows = this.db.prepare(`
      ${this.JOIN_SQL}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ts.day_of_week ASC, ts.start_time ASC
    `).all(...params) as any[]

    return rows.map(this.mapRow)
  }

  getById(id: string): TimetableSlot | null {
    const row = this.db.prepare(`${this.JOIN_SQL} WHERE ts.slot_id = ?`).get(id) as any
    return row ? this.mapRow(row) : null
  }

  /**
   * Returns all active, in-effect slots for a given day-of-week and date.
   * Used by TimetableService.generateTodaySessions().
   */
  getSlotsForDate(dayOfWeek: number, date: string): TimetableSlot[] {
    const institutionId = this.institutionId()
    const rows = this.db.prepare(`
      ${this.JOIN_SQL}
      WHERE ts.institution_id = ?
        AND ts.day_of_week = ?
        AND ts.active = 1
        AND (ts.effective_from IS NULL OR ts.effective_from <= ?)
        AND (ts.effective_until IS NULL OR ts.effective_until >= ?)
      ORDER BY ts.start_time ASC
    `).all(institutionId, dayOfWeek, date, date) as any[]

    return rows.map(this.mapRow)
  }

  create(data: CreateTimetableSlotInput): TimetableSlot {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db.prepare(`
      INSERT INTO timetable_slot
        (slot_id, institution_id, subject_id, batch_id, group_id,
         faculty_id, room, day_of_week, start_time, end_time,
         effective_from, effective_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, institutionId, data.subject_id, data.batch_id,
      data.group_id ?? null, data.faculty_id ?? null,
      data.room ?? null, data.day_of_week,
      data.start_time, data.end_time,
      data.effective_from ?? null, data.effective_until ?? null
    )
    return this.getById(id)!
  }

  update(id: string, data: UpdateTimetableSlotInput): TimetableSlot {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.subject_id !== undefined)     { sets.push('subject_id = ?');     params.push(data.subject_id) }
    if (data.batch_id !== undefined)       { sets.push('batch_id = ?');       params.push(data.batch_id) }
    if (data.group_id !== undefined)       { sets.push('group_id = ?');       params.push(data.group_id ?? null) }
    if (data.faculty_id !== undefined)     { sets.push('faculty_id = ?');     params.push(data.faculty_id ?? null) }
    if (data.room !== undefined)           { sets.push('room = ?');           params.push(data.room ?? null) }
    if (data.day_of_week !== undefined)    { sets.push('day_of_week = ?');    params.push(data.day_of_week) }
    if (data.start_time !== undefined)     { sets.push('start_time = ?');     params.push(data.start_time) }
    if (data.end_time !== undefined)       { sets.push('end_time = ?');       params.push(data.end_time) }
    if (data.effective_from !== undefined) { sets.push('effective_from = ?'); params.push(data.effective_from ?? null) }
    if (data.effective_until !== undefined){ sets.push('effective_until = ?'); params.push(data.effective_until ?? null) }
    if (data.active !== undefined)         { sets.push('active = ?');         params.push(data.active ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)!
    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.db.prepare(`UPDATE timetable_slot SET ${sets.join(', ')} WHERE slot_id = ?`).run(...params)
    return this.getById(id)!
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM timetable_slot WHERE slot_id = ?').run(id)
  }

  private mapRow(row: any): TimetableSlot {
    return { ...row, active: !!row.active }
  }
}
