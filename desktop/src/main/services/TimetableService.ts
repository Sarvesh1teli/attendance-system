import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { TimetableRepository } from '../repositories/TimetableRepository'

export interface GenerateResult {
  created: number
  skipped: number
  details: Array<{
    slot_id: string
    subject_name: string
    batch_name: string
    start_time: string
    result: 'CREATED' | 'SKIPPED' | 'ERROR'
    reason?: string
  }>
}

export class TimetableService {
  private repo: TimetableRepository

  constructor(private db: Database.Database) {
    this.repo = new TimetableRepository(db)
  }

  /**
   * Generate attendance sessions for today based on the timetable.
   * - Reads today's day-of-week and ISO date
   * - Finds all active, in-effect timetable slots for that day
   * - Skips slots that already have a session for today (same subject + batch + date)
   * - Creates session + pre-populates all ABSENT attendance_records (Option A)
   * @returns Summary of created vs skipped
   */
  generateTodaySessions(): GenerateResult {
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10)        // 'YYYY-MM-DD'
    const dayOfWeek = today.getDay()                         // 0=Sun … 6=Sat

    const slots = this.repo.getSlotsForDate(dayOfWeek, dateStr)

    const result: GenerateResult = { created: 0, skipped: 0, details: [] }

    const institutionId = (this.db.prepare('SELECT id FROM institution LIMIT 1').get() as any)?.id ?? ''

    const currentAy = (this.db.prepare(`
      SELECT academic_year_id FROM academic_year
      WHERE institution_id = ?
      ORDER BY is_current DESC, created_at DESC
      LIMIT 1
    `).get(institutionId) as any)?.academic_year_id ?? ''

    for (const slot of slots) {
      try {
        // Check: already have a session for this subject + batch today?
        const existing = this.db.prepare(`
          SELECT session_id FROM attendance_session
          WHERE subject_id = ?
            AND batch_id   = ?
            AND (student_group_id = ? OR (student_group_id IS NULL AND ? IS NULL))
            AND session_date = ?
            AND institution_id = ?
          LIMIT 1
        `).get(
          slot.subject_id, slot.batch_id,
          slot.group_id ?? null, slot.group_id ?? null,
          dateStr, institutionId
        )

        if (existing) {
          result.skipped++
          result.details.push({ slot_id: slot.slot_id, subject_name: slot.subject_name, batch_name: slot.batch_name, start_time: slot.start_time, result: 'SKIPPED', reason: 'Session already exists for today' })
          continue
        }

        // Create session
        const sessionId = uuidv4()
        const students = this.getEligibleStudents(institutionId, slot.batch_id, slot.group_id ?? null)

        const insertSessionTx = this.db.transaction(() => {
          this.db.prepare(`
            INSERT INTO attendance_session
              (session_id, institution_id, faculty_id, subject_id, batch_id,
               academic_year_id, student_group_id, session_date, start_time,
               end_time, location, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'DESKTOP')
          `).run(
            sessionId, institutionId,
            slot.faculty_id ?? null, slot.subject_id, slot.batch_id,
            currentAy, slot.group_id ?? null,
            dateStr, slot.start_time, slot.end_time,
            slot.room ?? null
          )

          const insertSnapshot = this.db.prepare(`
            INSERT INTO attendance_session_student
              (session_id, institution_id, student_id, eligibility_source)
            VALUES (?, ?, ?, ?)
          `)

          const insertRecord = this.db.prepare(`
            INSERT INTO attendance_record
              (record_id, institution_id, session_id, student_id, status,
               recognition_method, record_state)
            VALUES (?, ?, ?, ?, 'ABSENT', 'SYSTEM_DEFAULT', 'ACTIVE')
          `)

          for (const s of students) {
            insertSnapshot.run(
              sessionId, institutionId, s.student_id,
              slot.group_id ? 'GROUP_MEMBERSHIP' : 'SUBJECT_ENROLLMENT'
            )
            insertRecord.run(uuidv4(), institutionId, sessionId, s.student_id)
          }
        })

        insertSessionTx()

        result.created++
        result.details.push({ slot_id: slot.slot_id, subject_name: slot.subject_name, batch_name: slot.batch_name, start_time: slot.start_time, result: 'CREATED' })
      } catch (err) {
        result.details.push({ slot_id: slot.slot_id, subject_name: slot.subject_name, batch_name: slot.batch_name, start_time: slot.start_time, result: 'ERROR', reason: String(err) })
      }
    }

    return result
  }

  private getEligibleStudents(institutionId: string, batchId: string, groupId: string | null): Array<{ student_id: string }> {
    if (groupId) {
      const groupStudents = this.db.prepare(`
        SELECT DISTINCT s.student_id
        FROM student_group_membership sgm
        JOIN student s ON s.student_id = sgm.student_id
        WHERE sgm.student_group_id = ? AND s.current_status = 'ACTIVE'
      `).all(groupId) as Array<{ student_id: string }>
      if (groupStudents.length > 0) return groupStudents
    }

    const batchStudents = this.db.prepare(`
      SELECT DISTINCT s.student_id
      FROM student s
      JOIN student_admission sa ON s.student_id = sa.student_id
      WHERE s.institution_id = ? AND sa.batch_id = ? AND s.current_status = 'ACTIVE'
    `).all(institutionId, batchId) as Array<{ student_id: string }>

    if (batchStudents.length > 0) return batchStudents

    return this.db.prepare(`
      SELECT student_id FROM student
      WHERE institution_id = ? AND current_status = 'ACTIVE'
    `).all(institutionId) as Array<{ student_id: string }>
  }
}
