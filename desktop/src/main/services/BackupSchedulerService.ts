import cron, { ScheduledTask } from 'node-cron'
import { GoogleDriveBackupService } from './GoogleDriveBackupService'
import { Notification as ElectronNotification } from 'electron'

export class BackupSchedulerService {
  private static task: ScheduledTask | null = null
  private static backupService: GoogleDriveBackupService | null = null

  static init(service: GoogleDriveBackupService): void {
    this.backupService = service
    this.refreshSchedule()
  }

  static refreshSchedule(): void {
    if (!this.backupService) return

    // Stop current job if any
    this.stop()

    const settings = this.backupService.getBackupSettings()
    if (!settings.autoBackupEnabled || !settings.scheduleTime) {
      console.log('[BackupScheduler] Automatic backup is disabled.')
      return
    }

    const [hours, minutes] = settings.scheduleTime.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('[BackupScheduler] Invalid schedule time format:', settings.scheduleTime)
      return
    }

    // Cron expression: minute hour * * * (runs daily at specified time)
    const cronExpr = `${minutes} ${hours} * * *`
    console.log(`[BackupScheduler] Scheduled daily Google Drive backup at ${settings.scheduleTime} (cron: ${cronExpr})`)

    this.task = cron.schedule(cronExpr, async () => {
      console.log('[BackupScheduler] Triggering scheduled Google Drive backup...')
      try {
        const res = await this.backupService!.runBackup()
        console.log('[BackupScheduler] Scheduled backup completed successfully:', res.name)

        if (ElectronNotification.isSupported()) {
          new ElectronNotification({
            title: 'Cloud Backup Completed',
            body: `Database snapshot was safely backed up to Google Drive (${res.name}).`,
          }).show()
        }
      } catch (err: any) {
        console.error('[BackupScheduler] Scheduled backup failed:', err)
        if (ElectronNotification.isSupported()) {
          new ElectronNotification({
            title: 'Cloud Backup Failed',
            body: err instanceof Error ? err.message : 'Automatic backup failed.',
          }).show()
        }
      }
    })
  }

  static stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      console.log('[BackupScheduler] Schedule stopped.')
    }
  }
}
