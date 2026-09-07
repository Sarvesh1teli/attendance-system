import type { IpcMain } from 'electron'
import { app } from 'electron'
import { getDb } from '../database/db'
import { InstitutionRepository } from '../repositories/InstitutionRepository'
import { ConfigRepository } from '../repositories/ConfigRepository'
import { CourseProgramRepository } from '../repositories/CourseProgramRepository'
import { DepartmentRepository } from '../repositories/DepartmentRepository'
import { BatchRepository } from '../repositories/BatchRepository'
import { AcademicYearRepository } from '../repositories/AcademicYearRepository'
import { SubjectRepository } from '../repositories/SubjectRepository'
import { FacultyRepository } from '../repositories/FacultyRepository'
import { StudentRepository } from '../repositories/StudentRepository'
import { StudentGroupRepository } from '../repositories/StudentGroupRepository'
import { TopicRepository } from '../repositories/TopicRepository'
import { AppUserRepository } from '../repositories/AppUserRepository'
import { AuditRepository } from '../repositories/AuditRepository'
import { AuthService } from '../services/AuthService'
import { FaceEnrollmentService } from '../services/FaceEnrollmentService'
import { EncryptionService } from '../services/EncryptionService'
import { DesktopSyncService } from '../sync/DesktopSyncService'
import { AttendanceSessionRepository } from '../repositories/AttendanceSessionRepository'
import { FacultyDailyLogRepository } from '../repositories/FacultyDailyLogRepository'
import { ReportRepository } from '../repositories/ReportRepository'
import { ExportService } from '../services/ExportService'
import { NotificationService } from '../services/NotificationService'
import { TimetableRepository } from '../repositories/TimetableRepository'
import { TimetableService } from '../services/TimetableService'
import { GoogleOAuthService } from '../services/GoogleOAuthService'
import { GoogleDriveBackupService } from '../services/GoogleDriveBackupService'
import { BackupSchedulerService } from '../services/BackupSchedulerService'

/**
 * Registers all IPC handlers on the main process.
 * Each handler maps to a channel defined in preload.ts / ipc/types.ts.
 *
 * Error handling: every handler is wrapped — if it throws, IPC returns
 * a serialized error object that the renderer can detect.
 */
export function registerIpcHandlers(ipcMain: IpcMain): void {
  const db = getDb()

  const institution = new InstitutionRepository(db)
  const config = new ConfigRepository(db)
  const courseProgram = new CourseProgramRepository(db)
  const department = new DepartmentRepository(db)
  const batch = new BatchRepository(db)
  const academicYear = new AcademicYearRepository(db)
  const subject = new SubjectRepository(db)
  const faculty = new FacultyRepository(db)
  const student = new StudentRepository(db)
  const studentGroup = new StudentGroupRepository(db)
  const topic = new TopicRepository(db)
  const appUser = new AppUserRepository(db)
  const audit = new AuditRepository(db)
  const faceEnrollment = new FaceEnrollmentService(db)
  const notificationSvc = new NotificationService(db)
  const timetableRepo = new TimetableRepository(db)
  const timetableSvc = new TimetableService(db)

  // ─── Institution ──────────────────────────────────────────────────────────
  ipcMain.handle('institution:get', () => institution.get())
  ipcMain.handle('institution:upsert', async (_e, data) => {
    const res = institution.upsert(data)
    try {
      await EncryptionService.initialize(
        (k: string) => config.get(k),
        (k: string, v: string, l?: string) => config.set(k, v, l)
      )
      await AuthService.createFirstAdminIfNeeded()
    } catch (err) {
      console.warn('[Institution] Post-upsert init warning:', err)
    }
    return res
  })

  // ─── Config ───────────────────────────────────────────────────────────────
  ipcMain.handle('config:getAll', () => config.getAll())
  ipcMain.handle('config:get', (_e, key) => config.get(key))
  ipcMain.handle('config:set', (_e, key, value, label) => config.set(key, value, label))

  // ─── Course / Program ─────────────────────────────────────────────────────
  ipcMain.handle('courseProgram:list', () => courseProgram.list())
  ipcMain.handle('courseProgram:create', (_e, data) => courseProgram.create(data))
  ipcMain.handle('courseProgram:update', (_e, id, data) => courseProgram.update(id, data))
  ipcMain.handle('courseProgram:delete', (_e, id) => courseProgram.delete(id))

  // ─── Department ───────────────────────────────────────────────────────────
  ipcMain.handle('department:list', () => department.list())
  ipcMain.handle('department:create', (_e, data) => department.create(data))
  ipcMain.handle('department:update', (_e, id, data) => department.update(id, data))
  ipcMain.handle('department:delete', (_e, id) => department.delete(id))

  // ─── Batch ────────────────────────────────────────────────────────────────
  ipcMain.handle('batch:list', () => batch.list())
  ipcMain.handle('batch:create', (_e, data) => batch.create(data))
  ipcMain.handle('batch:update', (_e, id, data) => batch.update(id, data))

  // ─── Academic Year ────────────────────────────────────────────────────────
  ipcMain.handle('academicYear:list', () => academicYear.list())
  ipcMain.handle('academicYear:create', (_e, data) => academicYear.create(data))
  ipcMain.handle('academicYear:update', (_e, id, data) => academicYear.update(id, data))

  // ─── Subject ──────────────────────────────────────────────────────────────
  ipcMain.handle('subject:list', (_e, filters) => subject.list(filters))
  ipcMain.handle('subject:create', (_e, data) => subject.create(data))
  ipcMain.handle('subject:update', (_e, id, data) => subject.update(id, data))

  // ─── Faculty ──────────────────────────────────────────────────────────────
  ipcMain.handle('faculty:list', (_e, filters) => faculty.list(filters))
  ipcMain.handle('faculty:getById', (_e, id) => faculty.getById(id))
  ipcMain.handle('faculty:create', (_e, data) => faculty.create(data))
  ipcMain.handle('faculty:update', (_e, id, data) => faculty.update(id, data))

  // ─── Student ──────────────────────────────────────────────────────────────
  ipcMain.handle('student:list', (_e, filters) => student.list(filters))
  ipcMain.handle('student:getById', (_e, id) => student.getById(id))
  ipcMain.handle('student:create', (_e, data) => student.create(data))
  ipcMain.handle('student:update', (_e, id, data) => student.update(id, data))
  ipcMain.handle('student:delete', (_e, id) => student.delete(id))
  ipcMain.handle('student:enroll', (_e, data) => student.enroll(data))

  // ─── Student Groups ───────────────────────────────────────────────────────
  ipcMain.handle('studentGroup:list', (_e, filters) => studentGroup.list(filters))
  ipcMain.handle('studentGroup:getById', (_e, id) => studentGroup.getById(id))
  ipcMain.handle('studentGroup:create', (_e, data) => studentGroup.create(data))
  ipcMain.handle('studentGroup:update', (_e, id, data) => studentGroup.update(id, data))
  ipcMain.handle('studentGroup:delete', (_e, id) => studentGroup.delete(id))
  ipcMain.handle('studentGroup:addMembers', (_e, groupId, memberData) => studentGroup.addMembers(groupId, memberData))
  ipcMain.handle('studentGroup:removeMember', (_e, membershipId) => studentGroup.removeMember(membershipId))
  ipcMain.handle('studentGroup:getAvailableStudents', (_e, groupId) => studentGroup.getAvailableStudents(groupId))

  // ─── Topics ───────────────────────────────────────────────────────────────
  ipcMain.handle('topic:list', (_e, subjectId) => topic.list(subjectId))
  ipcMain.handle('topic:create', (_e, data) => topic.create(data))
  ipcMain.handle('topic:update', (_e, id, data) => topic.update(id, data))

  // ─── App Users ────────────────────────────────────────────────────────────
  ipcMain.handle('appUser:list', () => appUser.list())
  ipcMain.handle('appUser:create', (_e, data) => appUser.create(data))
  ipcMain.handle('appUser:update', (_e, id, data) => appUser.update(id, data))

  // ─── Audit ────────────────────────────────────────────────────────────────
  ipcMain.handle('audit:list', (_e, filters) => audit.list(filters))

  // ─── Auth ─────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', (_e, username, password) => AuthService.login(username, password))
  ipcMain.handle('auth:logout', () => AuthService.logout())
  ipcMain.handle('auth:getCurrentUser', () => AuthService.getCurrentUser())

  // ─── Face Enrollment ──────────────────────────────────────────────────────
  ipcMain.handle('faceEnrollment:getByEntity', (_e, entityType, entityId) =>
    faceEnrollment.getEnrollment(entityType, entityId)
  )
  ipcMain.handle('faceEnrollment:getOrCreate', (_e, entityType, entityId) => {
    const user = AuthService.getCurrentUser()
    return faceEnrollment.getOrCreateEnrollment(entityType, entityId, user?.username ?? 'system')
  })
  ipcMain.handle('faceEnrollment:list', (_e, entityType) => faceEnrollment.listEnrollments(entityType))
  ipcMain.handle('faceEnrollment:getSamples', (_e, enrollmentId) => faceEnrollment.getSamples(enrollmentId))
  ipcMain.handle('faceEnrollment:saveSample', (_e, enrollmentId, sampleType, imageBase64) => {
    const user = AuthService.getCurrentUser()
    return faceEnrollment.saveSample(enrollmentId, sampleType, imageBase64, user?.username ?? 'system')
  })
  ipcMain.handle('faceEnrollment:saveDescriptor', (_e, enrollmentId, descriptorJson) =>
    faceEnrollment.saveDescriptor(enrollmentId, descriptorJson)
  )
  ipcMain.handle('faceEnrollment:complete', (_e, enrollmentId) => faceEnrollment.completeEnrollment(enrollmentId))
  ipcMain.handle('faceEnrollment:revoke', (_e, enrollmentId) => {
    const user = AuthService.getCurrentUser()
    return faceEnrollment.revokeEnrollment(enrollmentId, user?.username ?? 'system')
  })

  // ─── Cloud Sync ───────────────────────────────────────────────────────────
  const syncService = new DesktopSyncService(db)
  ipcMain.handle('sync:pushMasterData', () => syncService.pushMasterData())
  ipcMain.handle('sync:pullCompletedSessions', (_e, options) => syncService.pullCompletedSessions(options))
  ipcMain.handle('sync:getStatus', () => syncService.getStatus())

  // ─── Attendance Session ───────────────────────────────────────────────────
  const attendanceRepo = new AttendanceSessionRepository(db)
  ipcMain.handle('attendance:createSession', (_e, data) => attendanceRepo.createSession(data))
  ipcMain.handle('attendance:listSessions', (_e, filters) => attendanceRepo.listSessions(filters))
  ipcMain.handle('attendance:getSession', (_e, sessionId) => attendanceRepo.getSession(sessionId))
  ipcMain.handle('attendance:updateRecord', (_e, recordId, status, reason) => {
    const user = AuthService.getCurrentUser()
    return attendanceRepo.updateRecord(recordId, status, reason, user?.username ?? 'ADMIN')
  })
  ipcMain.handle('attendance:closeSession', (_e, sessionId) => attendanceRepo.closeSession(sessionId))

  // ─── Faculty Daily Log ────────────────────────────────────────────────────
  const facultyLogRepo = new FacultyDailyLogRepository(db)
  ipcMain.handle('facultyDailyLog:checkIn', (_e, facultyId, method, notes) =>
    facultyLogRepo.checkIn(facultyId, method, notes)
  )
  ipcMain.handle('facultyDailyLog:checkOut', (_e, facultyId) => facultyLogRepo.checkOut(facultyId))
  ipcMain.handle('facultyDailyLog:getDailyLogs', (_e, date) => facultyLogRepo.getDailyLogs(date))
  ipcMain.handle('facultyDailyLog:getFacultyHistory', (_e, facultyId, limit) =>
    facultyLogRepo.getFacultyHistory(facultyId, limit)
  )

  // ─── Reports & Analytics ──────────────────────────────────────────────────
  const reportRepo = new ReportRepository(db)
  ipcMain.handle('report:getStudentSummary', (_e, filters) =>
    reportRepo.getStudentAttendanceSummary(filters)
  )
  ipcMain.handle('report:getShortageReport', (_e, batchId, subjectId, threshold) =>
    reportRepo.getShortageList(batchId, subjectId, threshold)
  )
  ipcMain.handle('report:getFacultyWorkload', (_e, filters) =>
    reportRepo.getFacultyWorkloadSummary(filters)
  )
  ipcMain.handle('report:exportToExcel', (_e, title, columns, rows, filename) =>
    ExportService.exportToExcel(title, columns, rows, filename)
  )
  ipcMain.handle('report:exportToPdf', (_e, title, columns, rows, filename) =>
    ExportService.exportToPdf(title, columns, rows, filename)
  )

  // ─── Google Drive Backup ──────────────────────────────────────────────────
  const oauthService = new GoogleOAuthService(db)
  const backupService = new GoogleDriveBackupService(db, oauthService)
  BackupSchedulerService.init(backupService)

  ipcMain.handle('backup:getOAuthConfig', () => oauthService.getOAuthConfig())
  ipcMain.handle('backup:saveOAuthConfig', (_e, clientId, clientSecret) =>
    oauthService.saveOAuthConfig(clientId, clientSecret)
  )
  ipcMain.handle('backup:getAccount', () => oauthService.getAccount())
  ipcMain.handle('backup:connectAccount', () => oauthService.connectAccount())
  ipcMain.handle('backup:disconnectAccount', () => {
    oauthService.disconnectAccount()
    BackupSchedulerService.refreshSchedule()
  })
  ipcMain.handle('backup:getSettings', () => backupService.getBackupSettings())
  ipcMain.handle('backup:saveSettings', (_e, settings) => {
    const res = backupService.saveBackupSettings(settings)
    BackupSchedulerService.refreshSchedule()
    return res
  })
  ipcMain.handle('backup:getLastBackup', () => backupService.getLastBackupInfo())
  ipcMain.handle('backup:runBackupNow', () => backupService.runBackup())

  // ─── Timetable ────────────────────────────────────────────────────────────
  ipcMain.handle('timetable:list', (_e, filters?) => timetableRepo.list(filters))
  ipcMain.handle('timetable:getById', (_e, id: string) => timetableRepo.getById(id))
  ipcMain.handle('timetable:create', (_e, data) => timetableRepo.create(data))
  ipcMain.handle('timetable:update', (_e, id: string, data) => timetableRepo.update(id, data))
  ipcMain.handle('timetable:delete', (_e, id: string) => timetableRepo.delete(id))
  ipcMain.handle('timetable:generateTodaySessions', () => timetableSvc.generateTodaySessions())

  // ─── Notifications ────────────────────────────────────────────────────────
  ipcMain.handle('notification:list', (_e, filters?) => notificationSvc.list(filters))
  ipcMain.handle('notification:getUnreadCount', () => notificationSvc.getUnreadCount())
  ipcMain.handle('notification:markRead', (_e, id: string) => notificationSvc.markRead(id))
  ipcMain.handle('notification:markAllRead', () => notificationSvc.markAllRead())
  ipcMain.handle('notification:delete', (_e, id: string) => notificationSvc.delete(id))
  ipcMain.handle('notification:deleteAll', () => notificationSvc.deleteAll())
  ipcMain.handle('notification:scanShortage', (_e, threshold?: number) =>
    notificationSvc.scanShortageAlerts(threshold ?? 75)
  )
  ipcMain.handle('notification:exportShortageLetters', (_e, threshold?: number, batchId?: string) =>
    notificationSvc.exportShortageLetters(threshold ?? 75, batchId)
  )

  // ─── Face Recognition ─────────────────────────────────────────────────────
  ipcMain.handle('faceRecognition:getSessionStudents', (_e, sessionId: string) => {
    const session = db
      .prepare(`SELECT * FROM attendance_session WHERE session_id = ?`)
      .get(sessionId) as any
    if (!session) throw new Error('Session not found')

    // Get all attendance records for the session with student info
    const records = db.prepare(`
      SELECT
        ar.record_id,
        ar.student_id,
        ar.status,
        s.name      AS student_name,
        s.face_enrolled,
        COALESCE(sa.admission_number, '') AS admission_number
      FROM attendance_record ar
      JOIN student s ON s.student_id = ar.student_id
      LEFT JOIN student_admission sa
        ON sa.student_id = ar.student_id
      WHERE ar.session_id = ?
      ORDER BY s.name ASC
    `).all(sessionId) as any[]

    const institutionId = (db.prepare('SELECT id FROM institution LIMIT 1').get() as any)?.id ?? ''

    // For each enrolled student, read face sample files as base64
    const result = records.map((r: any) => {
      const samplesBase64: string[] = []

      if (r.face_enrolled) {
        // Get active sample file paths from DB
        const enrollment = db.prepare(`
          SELECT enrollment_id FROM face_enrollment
          WHERE entity_type = 'STUDENT' AND entity_id = ? AND status = 'ENROLLED'
          LIMIT 1
        `).get(r.student_id) as any

        if (enrollment) {
          const samples = db.prepare(`
            SELECT file_path FROM face_sample
            WHERE enrollment_id = ? AND is_active = 1
          `).all(enrollment.enrollment_id) as any[]

          const fs = require('fs') as typeof import('fs')
          for (const sample of samples) {
            try {
              if (fs.existsSync(sample.file_path)) {
                const buf = fs.readFileSync(sample.file_path)
                samplesBase64.push(buf.toString('base64'))
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }

      return {
        record_id: r.record_id,
        student_id: r.student_id,
        student_name: r.student_name,
        admission_number: r.admission_number,
        face_enrolled: !!r.face_enrolled,
        status: r.status,
        face_samples_base64: samplesBase64,
      }
    })

    return result
  })

  ipcMain.handle('faceRecognition:markRecognized', (_e, recordId: string, confidence: number) => {
    const confidencePct = Math.round(confidence * 100)
    db.prepare(`
      UPDATE attendance_record
      SET
        status              = 'PRESENT',
        recognition_method  = 'FACE',
        manually_corrected  = 0,
        correction_reason   = ?,
        updated_at          = datetime('now')
      WHERE record_id = ?
    `).run(`Auto-recognized by face engine (confidence ${confidencePct}%)`, recordId)
    return true
  })

  ipcMain.handle('faceRecognition:getMissingDescriptorsData', () => {
    const enrollments = db.prepare(`
      SELECT enrollment_id, entity_id FROM face_enrollment
      WHERE status = 'ENROLLED' AND (face_descriptor IS NULL OR face_descriptor = '')
    `).all() as any[]

    const fs = require('fs') as typeof import('fs')
    const result: Array<{ enrollment_id: string; sampleBase64: string }> = []

    for (const enr of enrollments) {
      const sample = db.prepare(`
        SELECT file_path FROM face_sample
        WHERE enrollment_id = ? AND is_active = 1
        ORDER BY CASE sample_type WHEN 'FRONT' THEN 1 WHEN 'LEFT' THEN 2 WHEN 'RIGHT' THEN 3 ELSE 4 END
        LIMIT 1
      `).get(enr.enrollment_id) as any

      if (sample && fs.existsSync(sample.file_path)) {
        try {
          const buf = fs.readFileSync(sample.file_path)
          result.push({
            enrollment_id: enr.enrollment_id,
            sampleBase64: buf.toString('base64'),
          })
        } catch {}
      }
    }
    return result
  })

  // ─── App Utility ──────────────────────────────────────────────────────────
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getDataPath', () => app.getPath('userData'))
}
