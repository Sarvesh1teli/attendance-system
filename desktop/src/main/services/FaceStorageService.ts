import path from 'path'
import fs from 'fs'
import { app } from 'electron'

/**
 * FaceStorageService
 *
 * Manages local filesystem storage for face enrollment photos.
 *
 * Storage layout:
 *   <faceSamplesDir>/<institution_id>/<entity_type>/<entity_id>/<sample_type>_<timestamp>.jpg
 *
 * Rules:
 * - Photos are stored as JPEG.
 * - Photos are NEVER uploaded to the cloud.
 * - The file path is stored in face_sample.file_path.
 * - On revocation, photos are NOT automatically deleted (audit trail).
 */
export class FaceStorageService {
  static getFaceSamplesDir(): string {
    if (app.isPackaged) {
      if (process.platform === 'win32') {
        const programData = process.env['PROGRAMDATA'] || 'C:\\ProgramData'
        return path.join(programData, 'TeliAttendance', 'face-samples')
      }
      return path.join(app.getPath('userData'), 'face-samples')
    }
    // Development: store next to the data directory
    return path.join(app.getAppPath(), '../../data', 'face-samples')
  }

  /**
   * Save a face photo buffer to the filesystem.
   * @returns Absolute file path where the image was written.
   */
  static saveFacePhoto(
    institutionId: string,
    entityType: 'STUDENT' | 'FACULTY',
    entityId: string,
    sampleType: 'FRONT' | 'LEFT' | 'RIGHT' | 'OTHER',
    imageBuffer: Buffer
  ): string {
    const dir = path.join(
      this.getFaceSamplesDir(),
      institutionId,
      entityType.toLowerCase(),
      entityId
    )

    fs.mkdirSync(dir, { recursive: true })

    const timestamp = Date.now()
    const filename = `${sampleType.toLowerCase()}_${timestamp}.jpg`
    const fullPath = path.join(dir, filename)

    fs.writeFileSync(fullPath, imageBuffer)
    return fullPath
  }

  /**
   * Delete a face photo from the filesystem.
   * Safe — does not throw if file doesn't exist.
   */
  static deleteFacePhoto(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (err) {
      console.warn(`[FaceStorage] Could not delete ${filePath}:`, err)
    }
  }

  /**
   * List all sample file paths for an entity.
   */
  static listEntitySamples(
    institutionId: string,
    entityType: 'STUDENT' | 'FACULTY',
    entityId: string
  ): string[] {
    const dir = path.join(
      this.getFaceSamplesDir(),
      institutionId,
      entityType.toLowerCase(),
      entityId
    )
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => path.join(dir, f))
  }
}
