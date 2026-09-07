import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

export interface CreateSessionInput {
  faculty_id: string
  subject_id: string
  batch_id: string
  academic_year_id: string
  student_group_id?: string
  topic_id?: string
  topic_notes?: string
  session_date: string
  start_time: string
  device_id?: string
  location?: string
}

export interface AttendanceSessionDto {
  session_id: string
  institution_id: string
  faculty_id: string
  faculty_name?: string
  subject_id: string
  subject_name?: string
  subject_code?: string
  department_id?: string
  department_name?: string
  batch_id: string
  batch_name?: string
  academic_year_id: string
  student_group_id?: string
  topic_id?: string
  topic_name?: string
  custom_topic?: string
  topic_notes?: string
  sync_status?: string
  session_date: string
  start_time: string
  end_time?: string
  duration_minutes?: number
  status: string
  total_students: number
  present_count: number
  absent_count: number
  late_count: number
  created_at: string
}

export interface SessionStudentAttendanceRecord {
  record_id: string
  session_id: string
  student_id: string
  student_name: string
  admission_number: string
  gender?: string
  face_enrolled: boolean
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'MEDICAL_LEAVE' | 'OFFICIAL_DUTY'
  recognition_method: string
  confidence_score?: number
  recognized_at?: string
  manually_corrected: boolean
  correction_reason?: string
}

export class AttendanceSessionRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? 'inst-001'
  }

  /**
   * Enforces Option A:
   * 1. Inserts attendance_session
   * 2. Snapshots all eligible students based on subject/batch enrollment into attendance_session_student
   * 3. Pre-creates attendance_record for every eligible student with status = 'ABSENT'
   */
  createSession(input: CreateSessionInput): AttendanceSessionDto {
    const instId = this.institutionId()
    const sessionId = uuidv4()

    const createTransaction = this.db.transaction(() => {
      // 1. Insert session
      this.db
        .prepare(`
          INSERT INTO attendance_session (
            session_id, institution_id, faculty_id, subject_id, batch_id,
            academic_year_id, student_group_id, topic_id, topic_notes,
            session_date, start_time, status, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'DESKTOP')
        `)
        .run(
          sessionId,
          instId,
          input.faculty_id,
          input.subject_id,
          input.batch_id,
          input.academic_year_id,
          input.student_group_id ?? null,
          input.topic_id ?? null,
          input.topic_notes ?? null,
          input.session_date,
          input.start_time
        )

      // 2. Query eligible students
      // If student_group_id is present, get students from group
      let eligibleStudents: Array<{ student_id: string }> = []
      if (input.student_group_id) {
        eligibleStudents = this.db
          .prepare(`
            SELECT student_id FROM student_group_membership
            WHERE student_group_id = ? AND status = 'ACTIVE'
          `)
          .all(input.student_group_id) as Array<{ student_id: string }>
      } else {
        // Find students enrolled in this subject, or students in this batch
        eligibleStudents = this.db
          .prepare(`
            SELECT DISTINCT s.student_id
            FROM student s
            JOIN student_admission sa ON s.student_id = sa.student_id
            WHERE s.institution_id = ? AND sa.batch_id = ? AND s.current_status = 'ACTIVE'
          `)
          .all(instId, input.batch_id) as Array<{ student_id: string }>
      }

      // If no admission record found, fallback to all active students in institution
      if (eligibleStudents.length === 0) {
        eligibleStudents = this.db
          .prepare(`SELECT student_id FROM student WHERE institution_id = ? AND current_status = 'ACTIVE'`)
          .all(instId) as Array<{ student_id: string }>
      }

      // 3. Snapshot into attendance_session_student AND attendance_record with ABSENT
      const insertSnapshotStmt = this.db.prepare(`
        INSERT INTO attendance_session_student (
          session_id, institution_id, student_id, eligibility_source
        ) VALUES (?, ?, ?, ?)
      `)

      const insertRecordStmt = this.db.prepare(`
        INSERT INTO attendance_record (
          record_id, institution_id, session_id, student_id, status,
          recognition_method, record_state
        ) VALUES (?, ?, ?, ?, 'ABSENT', 'SYSTEM_DEFAULT', 'ACTIVE')
      `)

      for (const stu of eligibleStudents) {
        insertSnapshotStmt.run(
          sessionId,
          instId,
          stu.student_id,
          input.student_group_id ? 'GROUP_MEMBERSHIP' : 'SUBJECT_ENROLLMENT'
        )
        insertRecordStmt.run(uuidv4(), instId, sessionId, stu.student_id)
      }
    })

    createTransaction()
    return this.getSession(sessionId)!
  }

  listSessions(filters?: {
    date?: string
    faculty_id?: string
    batch_id?: string
    department_id?: string
    subject_id?: string
  }): AttendanceSessionDto[] {
    const instId = this.institutionId()
    let query = `
      SELECT
        s.session_id,
        s.institution_id,
        s.faculty_id,
        f.name as faculty_name,
        s.subject_id,
        sub.subject_name,
        sub.subject_code,
        COALESCE(sub.department_id, f.department_id, b.department_id) as department_id,
        d.department_name,
        s.batch_id,
        b.batch_name,
        s.academic_year_id,
        s.student_group_id,
        s.topic_id,
        t.topic_name,
        s.custom_topic,
        s.topic_notes,
        s.sync_status,
        s.session_date,
        s.start_time,
        s.end_time,
        s.duration_minutes,
        s.status,
        s.created_at,
        COUNT(r.record_id) as total_students,
        SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN r.status = 'LATE' THEN 1 ELSE 0 END) as late_count
      FROM attendance_session s
      LEFT JOIN faculty f ON s.faculty_id = f.faculty_id
      LEFT JOIN subject sub ON s.subject_id = sub.subject_id
      LEFT JOIN batch b ON s.batch_id = b.batch_id
      LEFT JOIN department d ON d.department_id = COALESCE(sub.department_id, f.department_id, b.department_id)
      LEFT JOIN topic t ON s.topic_id = t.topic_id
      LEFT JOIN attendance_record r ON s.session_id = r.session_id
      WHERE s.institution_id = ?
    `
    const params: unknown[] = [instId]

    if (filters?.date) {
      query += ` AND s.session_date = ?`
      params.push(filters.date)
    }
    if (filters?.faculty_id) {
      query += ` AND s.faculty_id = ?`
      params.push(filters.faculty_id)
    }
    if (filters?.batch_id) {
      query += ` AND s.batch_id = ?`
      params.push(filters.batch_id)
    }
    if (filters?.subject_id) {
      query += ` AND s.subject_id = ?`
      params.push(filters.subject_id)
    }
    if (filters?.department_id) {
      query += ` AND (sub.department_id = ? OR f.department_id = ? OR b.department_id = ?)`
      params.push(filters.department_id, filters.department_id, filters.department_id)
    }

    query += ` GROUP BY s.session_id ORDER BY s.session_date DESC, s.start_time DESC`

    return this.db.prepare(query).all(...params) as AttendanceSessionDto[]
  }

  getSession(sessionId: string): (AttendanceSessionDto & { records: SessionStudentAttendanceRecord[] }) | null {
    const instId = this.institutionId()
    const sessionRow = this.db
      .prepare(`
        SELECT
          s.session_id,
          s.institution_id,
          s.faculty_id,
          f.name as faculty_name,
          s.subject_id,
          sub.subject_name,
          sub.subject_code,
          s.batch_id,
          b.batch_name,
          s.academic_year_id,
          s.student_group_id,
          s.topic_id,
          t.topic_name,
          s.topic_notes,
          s.session_date,
          s.start_time,
          s.end_time,
          s.duration_minutes,
          s.status,
          s.created_at,
          COUNT(r.record_id) as total_students,
          SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN r.status = 'LATE' THEN 1 ELSE 0 END) as late_count
        FROM attendance_session s
        LEFT JOIN faculty f ON s.faculty_id = f.faculty_id
        LEFT JOIN subject sub ON s.subject_id = sub.subject_id
        LEFT JOIN batch b ON s.batch_id = b.batch_id
        LEFT JOIN topic t ON s.topic_id = t.topic_id
        LEFT JOIN attendance_record r ON s.session_id = r.session_id
        WHERE s.session_id = ? AND s.institution_id = ?
        GROUP BY s.session_id
      `)
      .get(sessionId, instId) as AttendanceSessionDto | undefined

    if (!sessionRow) return null

    const records = this.db
      .prepare(`
        SELECT
          r.record_id,
          r.session_id,
          r.student_id,
          s.name as student_name,
          COALESCE(sa.admission_number, 'N/A') as admission_number,
          s.gender,
          s.face_enrolled,
          r.status,
          r.recognition_method,
          r.confidence_score,
          r.recognized_at,
          r.manually_corrected,
          r.correction_reason
        FROM attendance_record r
        JOIN student s ON r.student_id = s.student_id
        LEFT JOIN student_admission sa ON s.student_id = sa.student_id
        WHERE r.session_id = ?
        ORDER BY sa.admission_number ASC, s.name ASC
      `)
      .all(sessionId) as SessionStudentAttendanceRecord[]

    return {
      ...sessionRow,
      records,
    }
  }

  updateRecord(recordId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED', reason?: string, userId?: string): boolean {
    const instId = this.institutionId()
    const record = this.db.prepare('SELECT * FROM attendance_record WHERE record_id = ?').get(recordId) as
      | { session_id: string; student_id: string; status: string }
      | undefined

    if (!record) return false

    const oldStatus = record.status
    const updateTx = this.db.transaction(() => {
      this.db
        .prepare(`
          UPDATE attendance_record
          SET status = ?,
              manually_corrected = 1,
              corrected_by = ?,
              corrected_at = datetime('now'),
              correction_reason = ?,
              recognition_method = 'MANUAL',
              updated_at = datetime('now')
          WHERE record_id = ?
        `)
        .run(status, userId ?? 'ADMIN', reason ?? 'Manual override from desktop', recordId)

      // Audit log
      this.db
        .prepare(`
          INSERT INTO audit_log (
            institution_id, user_id, action, entity_type, entity_id,
            old_value, new_value, reason, timestamp
          ) VALUES (?, ?, 'UPDATE_ATTENDANCE_RECORD', 'ATTENDANCE_RECORD', ?, ?, ?, ?, datetime('now'))
        `)
        .run(
          instId,
          userId ?? 'ADMIN',
          recordId,
          JSON.stringify({ status: oldStatus }),
          JSON.stringify({ status }),
          reason ?? 'Desktop manual adjustment'
        )
    })

    updateTx()
    return true
  }

  closeSession(sessionId: string): boolean {
    const session = this.db.prepare('SELECT start_time, session_date FROM attendance_session WHERE session_id = ?').get(sessionId) as
      | { start_time: string; session_date: string }
      | undefined

    if (!session) return false

    const now = new Date()
    const endTime = now.toTimeString().split(' ')[0]

    this.db
      .prepare(`
        UPDATE attendance_session
        SET status = 'SUBMITTED',
            end_time = ?,
            duration_minutes = 60,
            submitted_at = datetime('now'),
            updated_at = datetime('now')
        WHERE session_id = ?
      `)
      .run(endTime, sessionId)

    return true
  }
}
