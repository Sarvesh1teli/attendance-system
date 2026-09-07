import type Database from 'better-sqlite3'

export interface StudentAttendanceSummaryDto {
  student_id: string
  name: string
  admission_number: string
  gender?: string
  batch_name?: string
  subject_name?: string
  subject_code?: string
  total_sessions: number
  attended_sessions: number // PRESENT + LATE
  present_count: number
  late_count: number
  absent_count: number
  percentage: number
  is_shortage: boolean
  classes_needed_for_75: number
}

export interface FacultyWorkloadDto {
  faculty_id: string
  employee_id: string
  name: string
  department_name?: string
  total_sessions: number
  total_minutes: number
  total_hours: string
  topics_covered_count: number
  last_session_date?: string
}

export class ReportRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? 'inst-001'
  }

  getStudentAttendanceSummary(filters?: {
    batch_id?: string
    subject_id?: string
    threshold?: number
  }): StudentAttendanceSummaryDto[] {
    const instId = this.institutionId()
    const threshold = filters?.threshold ?? 75.0

    let sql = `
      SELECT
        s.student_id,
        s.name,
        COALESCE(sa.admission_number, 'N/A') as admission_number,
        s.gender,
        b.batch_name,
        sub.subject_name,
        sub.subject_code,
        COUNT(r.record_id) as total_sessions,
        SUM(CASE WHEN r.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) as attended_sessions,
        SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN r.status = 'LATE' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count
      FROM student s
      JOIN attendance_record r ON s.student_id = r.student_id AND r.record_state = 'ACTIVE'
      JOIN attendance_session sess ON r.session_id = sess.session_id
      LEFT JOIN student_admission sa ON s.student_id = sa.student_id
      LEFT JOIN batch b ON sess.batch_id = b.batch_id
      LEFT JOIN subject sub ON sess.subject_id = sub.subject_id
      WHERE s.institution_id = ?
    `
    const params: unknown[] = [instId]

    if (filters?.batch_id) {
      sql += ' AND sess.batch_id = ?'
      params.push(filters.batch_id)
    }
    if (filters?.subject_id) {
      sql += ' AND sess.subject_id = ?'
      params.push(filters.subject_id)
    }

    sql += ' GROUP BY s.student_id, sess.subject_id ORDER BY s.name ASC'

    const rows = this.db.prepare(sql).all(...params) as any[]

    return rows.map((row) => {
      const total = Number(row.total_sessions) || 0
      const attended = Number(row.attended_sessions) || 0
      const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0.0
      const isShortage = pct < threshold

      // Calculate classes needed to reach 75%
      // (attended + X) / (total + X) >= 0.75  ==>  attended + X >= 0.75 * total + 0.75 * X
      // 0.25 * X >= 0.75 * total - attended  ==>  X >= 3 * total - 4 * attended
      let classesNeeded = 0
      if (pct < 75.0 && total > 0) {
        classesNeeded = Math.max(0, Math.ceil(3 * total - 4 * attended))
      }

      return {
        student_id: row.student_id,
        name: row.name,
        admission_number: row.admission_number,
        gender: row.gender,
        batch_name: row.batch_name,
        subject_name: row.subject_name,
        subject_code: row.subject_code,
        total_sessions: total,
        attended_sessions: attended,
        present_count: Number(row.present_count) || 0,
        late_count: Number(row.late_count) || 0,
        absent_count: Number(row.absent_count) || 0,
        percentage: pct,
        is_shortage: isShortage,
        classes_needed_for_75: classesNeeded,
      }
    })
  }

  getShortageList(batch_id?: string, subject_id?: string, threshold: number = 75.0): StudentAttendanceSummaryDto[] {
    const list = this.getStudentAttendanceSummary({ batch_id, subject_id, threshold })
    return list.filter((item) => item.is_shortage && item.total_sessions > 0)
  }

  getFacultyWorkloadSummary(filters?: { department_id?: string; from_date?: string; to_date?: string }): FacultyWorkloadDto[] {
    const instId = this.institutionId()
    let sql = `
      SELECT
        f.faculty_id,
        f.employee_id,
        f.name,
        d.department_name,
        COUNT(s.session_id) as total_sessions,
        COALESCE(SUM(s.duration_minutes), 0) as total_minutes,
        COUNT(DISTINCT s.topic_id) as topics_covered_count,
        MAX(s.session_date) as last_session_date
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.department_id
      LEFT JOIN attendance_session s ON f.faculty_id = s.faculty_id AND s.status IN ('SUBMITTED', 'LOCKED', 'SYNCED')
      WHERE f.institution_id = ?
    `
    const params: unknown[] = [instId]

    if (filters?.department_id) {
      sql += ' AND f.department_id = ?'
      params.push(filters.department_id)
    }
    if (filters?.from_date) {
      sql += ' AND s.session_date >= ?'
      params.push(filters.from_date)
    }
    if (filters?.to_date) {
      sql += ' AND s.session_date <= ?'
      params.push(filters.to_date)
    }

    sql += ' GROUP BY f.faculty_id ORDER BY f.name ASC'

    const rows = this.db.prepare(sql).all(...params) as any[]

    return rows.map((r) => {
      const mins = Number(r.total_minutes) || 0
      const hours = Math.floor(mins / 60)
      const remainderMins = mins % 60
      return {
        faculty_id: r.faculty_id,
        employee_id: r.employee_id,
        name: r.name,
        department_name: r.department_name,
        total_sessions: Number(r.total_sessions) || 0,
        total_minutes: mins,
        total_hours: `${hours}h ${remainderMins}m`,
        topics_covered_count: Number(r.topics_covered_count) || 0,
        last_session_date: r.last_session_date ?? 'N/A',
      }
    })
  }
}
