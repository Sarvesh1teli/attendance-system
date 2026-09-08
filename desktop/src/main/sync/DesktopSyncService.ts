import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface SyncStatus {
  cloudUrl: string
  lastSyncTime: string | null
  lastSyncResult: 'SUCCESS' | 'FAILED' | 'NEVER'
  pendingOutboxCount: number
}

export class DesktopSyncService {
  private defaultCloudUrl: string = 'http://localhost:8086/api/v1/sync/desktop'
  private lastSyncTime: string | null = null
  private lastSyncResult: 'SUCCESS' | 'FAILED' | 'NEVER' = 'NEVER'

  constructor(private db: Database.Database) {}

  public getCloudUrl(): string {
    try {
      const row = this.db
        .prepare("SELECT config_value FROM institution_configuration WHERE config_key = 'cloud_sync_url' LIMIT 1")
        .get() as { config_value: string } | undefined
      if (row && row.config_value && row.config_value.trim()) {
        return row.config_value.trim().replace(/\/+$/, '')
      }
    } catch {
      // ignore
    }
    return this.defaultCloudUrl
  }

  async testConnection(customUrl?: string): Promise<{ success: boolean; message: string; status?: number }> {
    try {
      const targetUrl = (customUrl && customUrl.trim()) ? customUrl.trim().replace(/\/+$/, '') : this.getCloudUrl()
      const instId = this.institutionId()
      const res = await fetch(`${targetUrl}/pull?institutionId=${encodeURIComponent(instId)}`)
      if (res.ok) {
        return {
          success: true,
          status: res.status,
          message: `Connection successful! Cloud backend is online and responding (HTTP ${res.status}).`
        }
      } else {
        return {
          success: false,
          status: res.status,
          message: `Cloud responded with HTTP ${res.status}: ${res.statusText}`
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Cannot connect to Cloud'
      }
    }
  }

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? 'inst-001'
  }

  async pushMasterData(): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const instId = this.institutionId()

      // 1. Gather topics from local SQLite
      const topics = this.db
        .prepare('SELECT topic_id as id, subject_id as subjectId, topic_name as topicName, unit_name as unitName, sequence_number as sequenceNumber FROM topic WHERE institution_id = ?')
        .all(instId)

      // 2. Gather students (MINIMAL - NO BIOMETRIC PHOTOS - ONLY 128-D VECTOR IF ENROLLED)
      // Only ACTIVE and REPEATER students are synced to cloud/Teacher App.
      // FAILED, LEFT, DISCONTINUED, TRANSFERRED students are excluded from future rosters
      // but their historical attendance_record rows remain intact in both databases.
      const students = this.db
        .prepare(`
          SELECT
            s.student_id as id,
            s.student_id as studentId,
            sa.batch_id as batchId,
            s.name,
            sa.admission_number as admissionNumber,
            s.gender,
            s.face_enrolled as faceEnrolled,
            fe.face_descriptor as faceDescriptor
          FROM student s
          LEFT JOIN student_admission sa ON s.student_id = sa.student_id
          LEFT JOIN face_enrollment fe ON fe.entity_id = s.student_id AND fe.status = 'ENROLLED'
          WHERE s.institution_id = ?
            AND s.current_status IN ('ACTIVE', 'REPEATER')
        `)
        .all(instId)

      // 3. Gather classes / assignments
      let classes = this.db
        .prepare(`
          SELECT
            ts.slot_id as id,
            ts.faculty_id as facultyId,
            ts.batch_id as batchId,
            COALESCE(b.batch_name, 'General Batch') as batchName,
            ts.subject_id as subjectId,
            COALESCE(s.subject_name, 'General Subject') as subjectName,
            COALESCE(s.subject_code, 'SUB') as subjectCode,
            COALESCE(p.program_name, 'MBBS') as programName,
            COALESCE(
              (SELECT academic_year_id FROM academic_year WHERE institution_id = ts.institution_id AND is_current = 1 LIMIT 1),
              (SELECT academic_year_id FROM academic_year WHERE institution_id = ts.institution_id LIMIT 1),
              'ay-default'
            ) as academicYearId,
            ts.group_id as groupId,
            (SELECT group_name FROM student_group WHERE student_group_id = ts.group_id LIMIT 1) as groupName,
            (ts.start_time || ' - ' || ts.end_time) as scheduleTime,
            ts.room as room
          FROM timetable_slot ts
          LEFT JOIN batch b ON ts.batch_id = b.batch_id
          LEFT JOIN subject s ON ts.subject_id = s.subject_id
          LEFT JOIN course_program p ON b.program_id = p.program_id
          WHERE ts.institution_id = ?
        `)
        .all(instId) as any[]

      if (classes.length === 0) {
        classes = this.db
          .prepare(`
            SELECT
              fa.assignment_id as id,
              fa.faculty_id as facultyId,
              fa.batch_id as batchId,
              b.batch_name as batchName,
              fa.subject_id as subjectId,
              s.subject_name as subjectName,
              s.subject_code as subjectCode,
              p.program_name as programName,
              fa.academic_year_id as academicYearId
            FROM faculty_assignment fa
            LEFT JOIN batch b ON fa.batch_id = b.batch_id
            LEFT JOIN subject s ON fa.subject_id = s.subject_id
            LEFT JOIN course_program p ON b.program_id = p.program_id
            WHERE fa.institution_id = ?
          `)
          .all(instId) as any[]
      }

      // Fallback: pair subjects with batches under the same program
      if (classes.length === 0) {
        classes = this.db
          .prepare(`
            SELECT
              (substr(s.subject_id, 1, 28) || '-' || substr(b.batch_id, 1, 28)) as id,
              (SELECT faculty_id FROM faculty WHERE (s.department_id IS NOT NULL AND department_id = s.department_id) OR institution_id = ? LIMIT 1) as facultyId,
              b.batch_id as batchId,
              b.batch_name as batchName,
              s.subject_id as subjectId,
              s.subject_name as subjectName,
              s.subject_code as subjectCode,
              p.program_name as programName,
              COALESCE((SELECT academic_year_id FROM academic_year WHERE institution_id = ? LIMIT 1), 'ay-default') as academicYearId
            FROM subject s
            JOIN batch b ON (s.program_id IS NULL OR b.program_id IS NULL OR s.program_id = b.program_id)
            LEFT JOIN course_program p ON b.program_id = p.program_id
            WHERE s.institution_id = ?
          `)
          .all(instId, instId, instId) as any[]
      }

      const payload = {
        institutionId: instId,
        topics,
        students,
        classes,
      }

      const cloudUrl = this.getCloudUrl()

      // Reset cloud master data before push so only current desktop records exist
      try {
        await fetch(`${cloudUrl}/reset?institutionId=${encodeURIComponent(instId)}`, { method: 'POST' })
      } catch (e) {
        console.warn('Cloud reset before push skipped or failed:', e)
      }

      const res = await fetch(`${cloudUrl}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Cloud returned HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      this.lastSyncTime = new Date().toISOString()
      this.lastSyncResult = 'SUCCESS'

      return { success: true, message: 'Pushed master data to cloud', details: data }
    } catch (err) {
      this.lastSyncResult = 'FAILED'
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Push failed',
      }
    }
  }

  async pullCompletedSessions(options?: {
    incremental?: boolean
    sessionDate?: string
  }): Promise<{ success: boolean; sessionsCount: number; recordsCount: number; message?: string }> {
    try {
      const instId = this.institutionId()
      const cloudUrl = this.getCloudUrl()
      let url = `${cloudUrl}/pull?institutionId=${instId}`
      if (options?.sessionDate) {
        url += `&sessionDate=${encodeURIComponent(options.sessionDate)}`
      } else if (options?.incremental && this.lastSyncTime) {
        url += `&since=${encodeURIComponent(this.lastSyncTime)}`
      }

      const res = await fetch(url)

      if (!res.ok) {
        throw new Error(`Cloud returned HTTP ${res.status}: ${res.statusText}`)
      }

      const data = (await res.json()) as {
        sessions: Array<{
          sessionId: string
          facultyId: string
          subjectId: string
          batchId: string
          academicYearId: string
          studentGroupId?: string
          sessionDate: string
          startTime: string
          endTime?: string
          status: string
          topicId?: string
          customTopic?: string
          version: number
        }>
        records: Array<{
          recordId: string
          sessionId: string
          studentId: string
          status: string
          recognitionMethod: string
          recordState?: string
          confidenceScore?: number
          markedAt: string
          version: number
        }>
      }

      let sessionsCount = 0
      let recordsCount = 0

      // Pre-fetch valid entities to satisfy SQLite foreign keys
      const validFacultyRows = this.db.prepare('SELECT faculty_id FROM faculty').all() as { faculty_id: string }[]
      const validFacultySet = new Set(validFacultyRows.map((r) => r.faculty_id))
      const defaultFaculty = validFacultyRows[0]?.faculty_id

      const validYearRows = this.db.prepare('SELECT academic_year_id FROM academic_year').all() as { academic_year_id: string }[]
      const validYearSet = new Set(validYearRows.map((r) => r.academic_year_id))
      const defaultYear =
        (this.db.prepare('SELECT academic_year_id FROM academic_year WHERE is_current = 1 LIMIT 1').get() as { academic_year_id: string } | undefined)?.academic_year_id ||
        validYearRows[0]?.academic_year_id

      const validSubjectSet = new Set((this.db.prepare('SELECT subject_id FROM subject').all() as { subject_id: string }[]).map((r) => r.subject_id))
      const validBatchSet = new Set((this.db.prepare('SELECT batch_id FROM batch').all() as { batch_id: string }[]).map((r) => r.batch_id))
      const validTopicSet = new Set((this.db.prepare('SELECT topic_id FROM topic').all() as { topic_id: string }[]).map((r) => r.topic_id))
      const validGroupSet = new Set((this.db.prepare('SELECT student_group_id FROM student_group').all() as { student_group_id: string }[]).map((r) => r.student_group_id))
      const validStudentSet = new Set((this.db.prepare('SELECT student_id FROM student').all() as { student_id: string }[]).map((r) => r.student_id))

      const findAssignedFaculty = this.db.prepare('SELECT faculty_id FROM faculty_assignment WHERE subject_id = ? AND batch_id = ? LIMIT 1')

      // Run transactional insert / update into SQLite
      const applySync = this.db.transaction(() => {
        // Upsert sessions
        const insertSessionStmt = this.db.prepare(`
          INSERT INTO attendance_session (
            session_id, institution_id, faculty_id, subject_id, batch_id,
            academic_year_id, student_group_id, session_date, start_time,
            end_time, status, topic_id, custom_topic, topic_notes, source, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MOBILE', 'SYNCED')
          ON CONFLICT(session_id) DO UPDATE SET
            status = excluded.status,
            end_time = excluded.end_time,
            topic_id = excluded.topic_id,
            custom_topic = excluded.custom_topic,
            topic_notes = excluded.topic_notes,
            sync_status = 'SYNCED',
            updated_at = datetime('now')
        `)

        const validInsertedSessionIds = new Set<string>()

        // Prepared statement to close any OPEN session that would conflict
        // with the unique partial index uq_open_faculty_session before inserting
        const closeOpenSessionStmt = this.db.prepare(`
          UPDATE attendance_session
          SET status = 'SUBMITTED', sync_status = 'SYNCED', updated_at = datetime('now')
          WHERE institution_id = ? AND faculty_id = ? AND subject_id = ? AND batch_id = ?
            AND session_date = ? AND status = 'OPEN' AND session_id != ?
        `)

        for (const s of data.sessions || []) {
          // If subject or batch does not exist in SQLite (e.g. test dummy sessions), skip gracefully
          if (!validSubjectSet.has(s.subjectId) || !validBatchSet.has(s.batchId)) {
            console.warn(`[Sync] Skipping orphan/test session ${s.sessionId}: subject ${s.subjectId} or batch ${s.batchId} not in local database`)
            continue
          }

          // Resolve faculty
          let effectiveFacultyId = s.facultyId
          if (!effectiveFacultyId || !validFacultySet.has(effectiveFacultyId)) {
            const assigned = findAssignedFaculty.get(s.subjectId, s.batchId) as { faculty_id: string } | undefined
            effectiveFacultyId = assigned?.faculty_id || defaultFaculty
          }
          if (!effectiveFacultyId) {
            console.warn(`[Sync] Skipping session ${s.sessionId}: no valid faculty found in local database`)
            continue
          }

          // Resolve academic year
          let effectiveYearId = s.academicYearId
          if (!effectiveYearId || !validYearSet.has(effectiveYearId)) {
            effectiveYearId = defaultYear
          }
          if (!effectiveYearId) {
            console.warn(`[Sync] Skipping session ${s.sessionId}: no valid academic year found in local database`)
            continue
          }

          // Resolve topic & group
          const effectiveTopicId = (s.topicId && validTopicSet.has(s.topicId)) ? s.topicId : null
          const effectiveGroupId = (s.studentGroupId && validGroupSet.has(s.studentGroupId)) ? s.studentGroupId : null

          let sessionStatus = s.status || 'SUBMITTED'
          if (sessionStatus === 'COMPLETED') {
            sessionStatus = 'SUBMITTED'
          } else if (!['DRAFT', 'OPEN', 'SUBMITTED', 'LOCKED', 'SYNC_PENDING', 'SYNCED', 'CANCELLED', 'VOIDED', 'SYNC_CONFLICT'].includes(sessionStatus)) {
            sessionStatus = 'SUBMITTED'
          }

          // Close any conflicting OPEN session before inserting so the
          // unique partial index (uq_open_faculty_session) doesn't fire
          closeOpenSessionStmt.run(
            instId,
            effectiveFacultyId,
            s.subjectId,
            s.batchId,
            s.sessionDate,
            s.sessionId  // don't close the session we're about to upsert
          )

          insertSessionStmt.run(
            s.sessionId,
            instId,
            effectiveFacultyId,
            s.subjectId,
            s.batchId,
            effectiveYearId,
            effectiveGroupId,
            s.sessionDate,
            s.startTime || '09:00:00',
            s.endTime ?? null,
            sessionStatus,
            effectiveTopicId,
            s.customTopic ?? null,
            s.customTopic ?? null
          )
          validInsertedSessionIds.add(s.sessionId)
          sessionsCount++
        }

        // Upsert records
        const insertRecordStmt = this.db.prepare(`
          INSERT INTO attendance_record (
            record_id, institution_id, session_id, student_id, status,
            recognition_method, confidence_score, recognized_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id, student_id) DO UPDATE SET
            status = excluded.status,
            recognition_method = excluded.recognition_method,
            confidence_score = excluded.confidence_score,
            recognized_at = excluded.recognized_at,
            updated_at = datetime('now')
        `)

        for (const r of data.records || []) {
          // Ensure session exists in SQLite
          if (!validInsertedSessionIds.has(r.sessionId)) {
            const exists = this.db.prepare('SELECT 1 FROM attendance_session WHERE session_id = ?').get(r.sessionId)
            if (!exists) {
              continue
            }
          }

          // Ensure student exists in SQLite
          if (!validStudentSet.has(r.studentId)) {
            console.warn(`[Sync] Skipping orphan attendance record for student ${r.studentId}`)
            continue
          }

          let recMethod = r.recognitionMethod || 'SYSTEM_DEFAULT'
          if (recMethod.toUpperCase().includes('FACE')) {
            recMethod = 'FACE'
          } else if (recMethod.toUpperCase().includes('ADMIN')) {
            recMethod = 'ADMIN_CORRECTION'
          } else if (recMethod.toUpperCase().includes('EXCEPTION')) {
            recMethod = 'EXCEPTION'
          } else if (recMethod === 'SYSTEM_DEFAULT') {
            recMethod = 'SYSTEM_DEFAULT'
          } else {
            recMethod = 'MANUAL'
          }

          insertRecordStmt.run(
            r.recordId || randomUUID(),
            instId,
            r.sessionId,
            r.studentId,
            r.status || 'PRESENT',
            recMethod,
            r.confidenceScore ?? null,
            r.markedAt || new Date().toISOString()
          )
          recordsCount++
        }
      })

      applySync()

      this.lastSyncTime = new Date().toISOString()
      this.lastSyncResult = 'SUCCESS'

      return {
        success: true,
        sessionsCount,
        recordsCount,
      }
    } catch (err) {
      this.lastSyncResult = 'FAILED'
      return {
        success: false,
        sessionsCount: 0,
        recordsCount: 0,
        message: err instanceof Error ? err.message : 'Pull failed',
      }
    }
  }

  getStatus(): SyncStatus {
    const outboxCountRow = this.db
      .prepare('SELECT COUNT(*) as count FROM outbox_event WHERE status = ?')
      .get('PENDING') as { count: number } | undefined

    return {
      cloudUrl: this.getCloudUrl(),
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      pendingOutboxCount: outboxCountRow?.count ?? 0,
    }
  }
}
