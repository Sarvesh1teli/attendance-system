import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

export interface FacultyDailyLogDto {
  log_id: string
  institution_id: string
  faculty_id: string
  faculty_name: string
  employee_id: string
  department_name?: string
  log_date: string
  check_in_time: string
  check_out_time?: string
  total_minutes: number
  status: 'PRESENT' | 'HALF_DAY' | 'LATE' | 'ON_DUTY' | 'ABSENT'
  verification_method: 'FACE' | 'MANUAL' | 'ADMIN' | 'SYSTEM'
  notes?: string
}

export class FacultyDailyLogRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? 'inst-001'
  }

  checkIn(facultyId: string, method: 'FACE' | 'MANUAL' | 'ADMIN' = 'MANUAL', notes?: string): FacultyDailyLogDto {
    const instId = this.institutionId()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0]

    const existing = this.db
      .prepare('SELECT * FROM faculty_daily_log WHERE institution_id = ? AND faculty_id = ? AND log_date = ?')
      .get(instId, facultyId, today) as FacultyDailyLogDto | undefined

    if (existing) {
      return existing
    }

    const logId = uuidv4()
    this.db
      .prepare(`
        INSERT INTO faculty_daily_log (
          log_id, institution_id, faculty_id, log_date,
          check_in_time, status, verification_method, notes
        ) VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, ?)
      `)
      .run(logId, instId, facultyId, today, timeStr, method, notes ?? null)

    return this.getLogById(logId)!
  }

  checkOut(facultyId: string): FacultyDailyLogDto | null {
    const instId = this.institutionId()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0]

    const existing = this.db
      .prepare('SELECT * FROM faculty_daily_log WHERE institution_id = ? AND faculty_id = ? AND log_date = ?')
      .get(instId, facultyId, today) as (FacultyDailyLogDto & { check_in_time: string }) | undefined

    if (!existing) {
      return null
    }

    // Calculate total minutes
    const [inHours, inMins] = existing.check_in_time.split(':').map(Number)
    const [outHours, outMins] = timeStr.split(':').map(Number)
    const diffMins = Math.max(0, (outHours * 60 + outMins) - (inHours * 60 + inMins))

    const status = diffMins >= 240 ? 'PRESENT' : 'HALF_DAY'

    this.db
      .prepare(`
        UPDATE faculty_daily_log
        SET check_out_time = ?,
            total_minutes = ?,
            status = ?,
            updated_at = datetime('now')
        WHERE log_id = ?
      `)
      .run(timeStr, diffMins, status, existing.log_id)

    return this.getLogById(existing.log_id)
  }

  getDailyLogs(date: string): FacultyDailyLogDto[] {
    const instId = this.institutionId()
    return this.db
      .prepare(`
        SELECT
          l.log_id,
          l.institution_id,
          l.faculty_id,
          f.name as faculty_name,
          f.employee_id,
          d.department_name,
          l.log_date,
          l.check_in_time,
          l.check_out_time,
          l.total_minutes,
          l.status,
          l.verification_method,
          l.notes
        FROM faculty_daily_log l
        JOIN faculty f ON l.faculty_id = f.faculty_id
        LEFT JOIN department d ON f.department_id = d.department_id
        WHERE l.institution_id = ? AND l.log_date = ?
        ORDER BY l.check_in_time DESC
      `)
      .all(instId, date) as FacultyDailyLogDto[]
  }

  getFacultyHistory(facultyId: string, limit: number = 30): FacultyDailyLogDto[] {
    const instId = this.institutionId()
    return this.db
      .prepare(`
        SELECT
          l.log_id,
          l.institution_id,
          l.faculty_id,
          f.name as faculty_name,
          f.employee_id,
          d.department_name,
          l.log_date,
          l.check_in_time,
          l.check_out_time,
          l.total_minutes,
          l.status,
          l.verification_method,
          l.notes
        FROM faculty_daily_log l
        JOIN faculty f ON l.faculty_id = f.faculty_id
        LEFT JOIN department d ON f.department_id = d.department_id
        WHERE l.institution_id = ? AND l.faculty_id = ?
        ORDER BY l.log_date DESC
        LIMIT ?
      `)
      .all(instId, facultyId, limit) as FacultyDailyLogDto[]
  }

  private getLogById(logId: string): FacultyDailyLogDto | null {
    const row = this.db
      .prepare(`
        SELECT
          l.log_id,
          l.institution_id,
          l.faculty_id,
          f.name as faculty_name,
          f.employee_id,
          d.department_name,
          l.log_date,
          l.check_in_time,
          l.check_out_time,
          l.total_minutes,
          l.status,
          l.verification_method,
          l.notes
        FROM faculty_daily_log l
        JOIN faculty f ON l.faculty_id = f.faculty_id
        LEFT JOIN department d ON f.department_id = d.department_id
        WHERE l.log_id = ?
      `)
      .get(logId) as FacultyDailyLogDto | undefined

    return row ?? null
  }
}
