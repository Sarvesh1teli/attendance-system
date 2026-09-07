import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type Database from 'better-sqlite3'
import { GoogleOAuthService } from './GoogleOAuthService'

const FOLDER_NAME = 'Teli-Attendance-Backups'

export interface BackupResult {
  success: boolean
  fileId?: string
  name?: string
  size?: number
  time?: string
  accountEmail?: string
  message?: string
}

export interface BackupSettings {
  autoBackupEnabled: boolean
  scheduleTime: string // HH:mm 24-hr format, e.g. "23:00"
}

export interface LastBackupRecord {
  time: string
  status: 'success' | 'failed'
  name?: string
  size?: number
  fileId?: string
  accountEmail?: string
  error?: string
}

export class GoogleDriveBackupService {
  constructor(
    private db: Database.Database,
    private oauthService: GoogleOAuthService
  ) {}

  private getInstitutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? 'inst-default'
  }

  private getConfig(key: string): string | null {
    const instId = this.getInstitutionId()
    const row = this.db
      .prepare('SELECT config_value FROM institution_configuration WHERE institution_id = ? AND config_key = ?')
      .get(instId, key) as { config_value: string } | undefined
    return row?.config_value ?? null
  }

  private setConfig(key: string, value: string, label = ''): void {
    const instId = this.getInstitutionId()
    this.db
      .prepare(`
        INSERT INTO institution_configuration (config_id, institution_id, config_key, config_value, display_label, updated_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(institution_id, config_key) DO UPDATE SET
          config_value = excluded.config_value,
          display_label = excluded.display_label,
          updated_at = datetime('now')
      `)
      .run(instId, key, value, label)
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  getBackupSettings(): BackupSettings {
    const enabled = this.getConfig('backup_auto_enabled') === 'true'
    const scheduleTime = this.getConfig('backup_auto_schedule_time') || '23:00'
    return {
      autoBackupEnabled: enabled,
      scheduleTime,
    }
  }

  saveBackupSettings(settings: Partial<BackupSettings>): BackupSettings {
    if (settings.autoBackupEnabled !== undefined) {
      this.setConfig('backup_auto_enabled', settings.autoBackupEnabled ? 'true' : 'false', 'Auto Backup Enabled')
    }
    if (settings.scheduleTime !== undefined) {
      this.setConfig('backup_auto_schedule_time', settings.scheduleTime.trim(), 'Auto Backup Schedule Time (HH:mm)')
    }
    return this.getBackupSettings()
  }

  getLastBackupInfo(): LastBackupRecord | null {
    const raw = this.getConfig('backup_last_status')
    if (!raw) return null
    try {
      return JSON.parse(raw) as LastBackupRecord
    } catch {
      return null
    }
  }

  private recordLastBackup(record: LastBackupRecord): void {
    this.setConfig('backup_last_status', JSON.stringify(record), 'Last Backup Status')
  }

  // ─── Google Drive Folder ───────────────────────────────────────────────────

  private async getOrCreateRootFolder(drive: any): Promise<string> {
    const listRes = await drive.files.list({
      q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    })

    if (listRes.data.files && listRes.data.files.length > 0) {
      return listRes.data.files[0].id
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    })

    return createRes.data.id
  }

  // ─── Core Backup Execution ─────────────────────────────────────────────────

  async runBackup(): Promise<BackupResult> {
    const oauth2Client = this.oauthService.createOAuth2Client()
    const account = this.oauthService.getAccount()

    if (!oauth2Client || !account.connected) {
      const err = 'Google Drive account is not connected. Please connect your Gmail account in Settings.'
      this.recordLastBackup({
        time: new Date().toISOString(),
        status: 'failed',
        error: err,
      })
      throw new Error(err)
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    const rootFolderId = await this.getOrCreateRootFolder(drive)

    const timestamp = new Date()
      .toISOString()
      .replace('T', '_')
      .replace(/:/g, '-')
      .split('.')[0]
    const backupFileName = `Attendance_Backup_${timestamp}.db`
    const tempSnapshotPath = path.join(os.tmpdir(), backupFileName)

    try {
      console.log(`[Backup] Starting SQLite online snapshot to ${tempSnapshotPath}`)
      // Safe online snapshot of active SQLite database
      await this.db.backup(tempSnapshotPath)

      const fileStats = fs.statSync(tempSnapshotPath)
      const fileSize = fileStats.size

      console.log(`[Backup] Uploading ${backupFileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB) to Google Drive...`)

      const uploadRes = await drive.files.create({
        requestBody: {
          name: backupFileName,
          parents: [rootFolderId],
        },
        media: {
          mimeType: 'application/x-sqlite3',
          body: fs.createReadStream(tempSnapshotPath),
        },
        fields: 'id, name, size, createdTime',
      })

      const result: BackupResult = {
        success: true,
        fileId: uploadRes.data.id || '',
        name: uploadRes.data.name || backupFileName,
        size: fileSize,
        time: uploadRes.data.createdTime || new Date().toISOString(),
        accountEmail: account.userEmail,
        message: 'Backup completed and uploaded successfully to Google Drive',
      }

      this.recordLastBackup({
        time: result.time || new Date().toISOString(),
        status: 'success',
        name: result.name,
        size: result.size,
        fileId: result.fileId,
        accountEmail: account.userEmail,
      })

      return result
    } catch (err: any) {
      console.error('[Backup] Backup error:', err)
      const errMessage = err instanceof Error ? err.message : String(err)
      this.recordLastBackup({
        time: new Date().toISOString(),
        status: 'failed',
        error: errMessage,
      })
      throw new Error(errMessage)
    } finally {
      // Clean up temp snapshot file
      try {
        if (fs.existsSync(tempSnapshotPath)) {
          fs.unlinkSync(tempSnapshotPath)
        }
      } catch {
        // ignore
      }
    }
  }
}
