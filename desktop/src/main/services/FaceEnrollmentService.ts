import type Database from 'better-sqlite3'
import { FaceEnrollmentRepository } from '../repositories/FaceEnrollmentRepository'
import { FaceStorageService } from './FaceStorageService'

/**
 * FaceEnrollmentService
 *
 * Orchestrates the face enrollment lifecycle:
 *   1. Start enrollment  → create face_enrollment record (PENDING)
 *   2. Save sample       → save JPEG to disk + face_sample record
 *   3. Complete          → mark ENROLLED, update student/faculty.face_enrolled = 1
 *   4. Revoke            → mark REVOKED, deactivate samples
 *
 * Embedding generation is NOT here — it plugs in after model selection in Phase 2B.
 */
export class FaceEnrollmentService {
  private repo: FaceEnrollmentRepository

  constructor(private db: Database.Database) {
    this.repo = new FaceEnrollmentRepository(db)
  }

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  /**
   * Get existing PENDING/ENROLLED enrollment, or create a new one.
   */
  getOrCreateEnrollment(
    entityType: 'STUDENT' | 'FACULTY',
    entityId: string,
    enrolledBy: string
  ) {
    const existing = this.repo.getByEntity(entityType, entityId)
    if (existing && existing.status !== 'REVOKED') return existing
    return this.repo.create(entityType, entityId, enrolledBy)
  }

  getEnrollment(entityType: 'STUDENT' | 'FACULTY', entityId: string) {
    return this.repo.getByEntity(entityType, entityId)
  }

  listEnrollments(entityType?: 'STUDENT' | 'FACULTY') {
    return this.repo.listByInstitution(entityType)
  }

  getSamples(enrollmentId: string) {
    return this.repo.getSamples(enrollmentId)
  }

  /**
   * Save a photo sample — writes to filesystem AND creates face_sample record.
   * @param imageBase64 — base64-encoded JPEG from renderer camera capture
   */
  saveSample(
    enrollmentId: string,
    sampleType: 'FRONT' | 'LEFT' | 'RIGHT' | 'OTHER',
    imageBase64: string,
    capturedBy: string
  ) {
    const enrollment = this.repo.getById(enrollmentId)
    if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`)
    if (enrollment.status === 'REVOKED') throw new Error('Cannot add samples to a revoked enrollment')

    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const filePath = FaceStorageService.saveFacePhoto(
      enrollment.institution_id,
      enrollment.entity_type as 'STUDENT' | 'FACULTY',
      enrollment.entity_id,
      sampleType,
      imageBuffer
    )

    return this.repo.createSample(enrollmentId, sampleType, filePath, capturedBy)
  }

  /**
   * Mark enrollment as ENROLLED and set face_enrolled = 1 on the entity.
   * Requires at least 1 active sample.
   */
  completeEnrollment(enrollmentId: string) {
    const count = this.repo.countActiveSamples(enrollmentId)
    if (count === 0) throw new Error('Cannot complete enrollment: no samples captured')

    const enrollment = this.repo.updateStatus(enrollmentId, 'ENROLLED')

    // Update face_enrolled flag on the entity
    if (enrollment.entity_type === 'STUDENT') {
      this.db.prepare(`
        UPDATE student SET face_enrolled = 1, updated_at = datetime('now')
        WHERE student_id = ?
      `).run(enrollment.entity_id)
    } else if (enrollment.entity_type === 'FACULTY') {
      this.db.prepare(`
        UPDATE faculty SET face_enrolled = 1, updated_at = datetime('now')
        WHERE faculty_id = ?
      `).run(enrollment.entity_id)
    }

    return enrollment
  }

  saveDescriptor(enrollmentId: string, descriptorJson: string): void {
    this.repo.saveDescriptor(enrollmentId, descriptorJson)
  }

  /**
   * Revoke an enrollment. Deactivates samples but does NOT delete photos (audit trail).
   */
  revokeEnrollment(enrollmentId: string, revokedBy: string) {
    this.repo.deactivateSamples(enrollmentId)
    const enrollment = this.repo.updateStatus(enrollmentId, 'REVOKED', revokedBy)

    // Clear face_enrolled flag
    if (enrollment.entity_type === 'STUDENT') {
      this.db.prepare(`
        UPDATE student SET face_enrolled = 0, updated_at = datetime('now')
        WHERE student_id = ?
      `).run(enrollment.entity_id)
    } else if (enrollment.entity_type === 'FACULTY') {
      this.db.prepare(`
        UPDATE faculty SET face_enrolled = 0, updated_at = datetime('now')
        WHERE faculty_id = ?
      `).run(enrollment.entity_id)
    }

    return enrollment
  }
}
