import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { FaceEnrollment, FaceSample } from '../ipc/types'

export class FaceEnrollmentRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  getByEntity(entityType: 'STUDENT' | 'FACULTY', entityId: string): FaceEnrollment | null {
    return this.db.prepare(`
      SELECT * FROM face_enrollment
      WHERE institution_id = ? AND entity_type = ? AND entity_id = ?
      ORDER BY COALESCE(created_at, last_updated) DESC LIMIT 1
    `).get(this.institutionId(), entityType, entityId) as FaceEnrollment | null
  }

  getById(enrollmentId: string): FaceEnrollment | null {
    return this.db.prepare('SELECT * FROM face_enrollment WHERE enrollment_id = ?')
      .get(enrollmentId) as FaceEnrollment | null
  }

  listByInstitution(entityType?: 'STUDENT' | 'FACULTY'): FaceEnrollment[] {
    if (entityType) {
      return this.db.prepare(`
        SELECT * FROM face_enrollment WHERE institution_id = ? AND entity_type = ?
        ORDER BY COALESCE(created_at, last_updated) DESC
      `).all(this.institutionId(), entityType) as FaceEnrollment[]
    }
    return this.db.prepare(`
      SELECT * FROM face_enrollment WHERE institution_id = ? ORDER BY COALESCE(created_at, last_updated) DESC
    `).all(this.institutionId()) as FaceEnrollment[]
  }

  create(entityType: 'STUDENT' | 'FACULTY', entityId: string, enrolledBy: string): FaceEnrollment {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db.prepare(`
      INSERT INTO face_enrollment
        (enrollment_id, institution_id, entity_type, entity_id, status, enrolled_by, created_at, updated_at, last_updated)
      VALUES (?, ?, ?, ?, 'PENDING', ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(id, institutionId, entityType, entityId, enrolledBy)
    return this.getById(id)!
  }

  updateStatus(
    enrollmentId: string,
    status: 'PENDING' | 'ENROLLED' | 'REVOKED',
    revokedBy?: string
  ): FaceEnrollment {
    if (status === 'ENROLLED') {
      this.db.prepare(`
        UPDATE face_enrollment
        SET status = 'ENROLLED', enrolled_at = datetime('now'),
            updated_at = datetime('now'), last_updated = datetime('now')
        WHERE enrollment_id = ?
      `).run(enrollmentId)
    } else if (status === 'REVOKED') {
      this.db.prepare(`
        UPDATE face_enrollment
        SET status = 'REVOKED', revoked_at = datetime('now'),
            revoked_by = ?, updated_at = datetime('now'), last_updated = datetime('now')
        WHERE enrollment_id = ?
      `).run(revokedBy ?? null, enrollmentId)
    } else {
      this.db.prepare(`
        UPDATE face_enrollment
        SET status = ?, updated_at = datetime('now'), last_updated = datetime('now')
        WHERE enrollment_id = ?
      `).run(status, enrollmentId)
    }
    return this.getById(enrollmentId)!
  }

  saveDescriptor(enrollmentId: string, descriptorJson: string): void {
    // Accumulate descriptors as a JSON array instead of overwriting.
    // This preserves angle-specific descriptors (FRONT/LEFT/RIGHT) for multi-sample matching.
    const existing = this.db.prepare(
      `SELECT face_descriptor FROM face_enrollment WHERE enrollment_id = ?`
    ).get(enrollmentId) as { face_descriptor?: string } | undefined

    let descriptors: string[] = []
    if (existing?.face_descriptor) {
      try {
        const parsed = JSON.parse(existing.face_descriptor)
        if (Array.isArray(parsed)) {
          descriptors = parsed
        } else if (typeof parsed === 'string') {
          descriptors = [parsed]
        }
      } catch {
        // Single legacy descriptor — keep it as first entry
        descriptors = [existing.face_descriptor]
      }
    }

    // Avoid adding duplicate descriptors (same sample re-captured)
    if (!descriptors.includes(descriptorJson)) {
      descriptors.push(descriptorJson)
    }

    this.db.prepare(`
      UPDATE face_enrollment
      SET face_descriptor = ?, updated_at = datetime('now'), last_updated = datetime('now')
      WHERE enrollment_id = ?
    `).run(JSON.stringify(descriptors), enrollmentId)
  }

  // ── Samples ────────────────────────────────────────────────────────────

  getSamples(enrollmentId: string): FaceSample[] {
    return this.db.prepare(`
      SELECT * FROM face_sample WHERE enrollment_id = ? AND is_active = 1
      ORDER BY COALESCE(created_at, captured_at) ASC
    `).all(enrollmentId) as FaceSample[]
  }

  countActiveSamples(enrollmentId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as c FROM face_sample WHERE enrollment_id = ? AND is_active = 1
    `).get(enrollmentId) as { c: number }
    return row.c
  }

  createSample(
    enrollmentId: string,
    sampleType: 'FRONT' | 'LEFT' | 'RIGHT' | 'OTHER',
    filePath: string,
    capturedBy: string
  ): FaceSample {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db.prepare(`
      INSERT INTO face_sample
        (sample_id, institution_id, enrollment_id, sample_type, file_path, is_active, captured_by, created_at, updated_at, captured_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(id, institutionId, enrollmentId, sampleType, filePath, capturedBy)
    return this.db.prepare('SELECT * FROM face_sample WHERE sample_id = ?')
      .get(id) as FaceSample
  }

  deactivateSamples(enrollmentId: string): void {
    this.db.prepare(`
      UPDATE face_sample SET is_active = 0, updated_at = datetime('now')
      WHERE enrollment_id = ?
    `).run(enrollmentId)
  }
}
