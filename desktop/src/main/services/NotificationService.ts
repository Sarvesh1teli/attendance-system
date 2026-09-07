import { Notification as ElectronNotification } from 'electron'
import type Database from 'better-sqlite3'
import {
  NotificationRepository,
  type CreateNotificationInput,
  type AppNotification,
} from '../repositories/NotificationRepository'
import ExcelJS from 'exceljs'
import { dialog } from 'electron'
import path from 'path'

/**
 * NotificationService (Main Process)
 *
 * Central service for:
 *  - Creating in-app notifications (stored in SQLite)
 *  - Firing Electron OS desktop notifications
 *  - Scanning for attendance shortage alerts
 *  - Exporting parent shortage letters as styled Excel
 */
export class NotificationService {
  private repo: NotificationRepository

  constructor(private db: Database.Database) {
    this.repo = new NotificationRepository(db)
  }

  // ─── Core Notify ──────────────────────────────────────────────────────────

  /**
   * Create an in-app notification AND optionally fire an OS desktop notification.
   */
  notify(
    input: CreateNotificationInput,
    opts: { osNotify?: boolean } = {}
  ): AppNotification {
    const record = this.repo.create(input)

    if (opts.osNotify !== false && ElectronNotification.isSupported()) {
      try {
        const n = new ElectronNotification({
          title: input.title,
          body: input.message,
          silent: input.severity === 'INFO',
        })
        n.show()
      } catch {
        // OS notifications are best-effort
      }
    }

    return record
  }

  // ─── Repository Delegates ─────────────────────────────────────────────────

  list(filters = {}) { return this.repo.list(filters) }
  getUnreadCount() { return this.repo.getUnreadCount() }
  markRead(id: string) { return this.repo.markRead(id) }
  markAllRead() { return this.repo.markAllRead() }
  delete(id: string) { return this.repo.delete(id) }
  deleteAll() { return this.repo.deleteAll() }

  // ─── Shortage Alert Scanner ───────────────────────────────────────────────

  /**
   * Scan all students and create SHORTAGE_ALERT notifications for those below threshold.
   * Skips students who already have a recent alert (last 24h).
   * @returns Number of new alerts created
   */
  scanShortageAlerts(threshold = 75): number {
    // Query shortage from attendance data, joined with batch to get notify_parents flag
    const rows = this.db.prepare(`
      SELECT
        s.student_id,
        s.name        AS student_name,
        s.phone       AS student_phone,
        s.parent_phone,
        sub.subject_name,
        sub.subject_id,
        COALESCE(b.notify_parents, 1) AS notify_parents,
        COUNT(DISTINCT ar.record_id)                                    AS total_sessions,
        SUM(CASE WHEN ar.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END) AS attended,
        ROUND(
          100.0 * SUM(CASE WHEN ar.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END)
          / NULLIF(COUNT(DISTINCT ar.record_id), 0),
          1
        ) AS pct
      FROM attendance_record ar
      JOIN attendance_session sess ON sess.session_id = ar.session_id
        AND sess.status IN ('SUBMITTED','LOCKED')
      JOIN student s ON s.student_id = ar.student_id
      JOIN subject sub ON sub.subject_id = sess.subject_id
      LEFT JOIN student_admission sa ON sa.student_id = s.student_id
      LEFT JOIN batch b ON b.batch_id = sa.batch_id
      GROUP BY ar.student_id, sess.subject_id
      HAVING pct IS NOT NULL AND pct < ?
      ORDER BY pct ASC
    `).all(threshold) as any[]

    let created = 0

    for (const row of rows) {
      if (this.repo.hasRecentShortageAlert(row.student_id, 24)) continue

      const pct = Math.round(row.pct)
      const severity = pct < 65 ? 'CRITICAL' : pct < 70 ? 'ERROR' : 'WARNING'
      const notifyParents = !!row.notify_parents

      // Core shortage alert (always created regardless of notify_parents)
      this.notify(
        {
          type: 'SHORTAGE_ALERT',
          severity,
          title: `Shortage: ${row.student_name}`,
          message: `${row.student_name} has only ${pct}% attendance in ${row.subject_name}. Minimum required: ${threshold}%.`,
          entity_type: 'STUDENT',
          entity_id: row.student_id,
          action_url: `/people/students`,
        },
        { osNotify: severity === 'CRITICAL' }  // OS notification only for critical
      )
      created++

      // Parent alert — only if batch has notify_parents enabled
      if (notifyParents && (row.student_phone || row.parent_phone)) {
        this.repo.create({
          type: 'PARENT_ALERT',
          severity,
          title: `Parent Alert: ${row.student_name}`,
          message:
            `Parent alert pending for ${row.student_name} — ${pct}% in ${row.subject_name}. ` +
            `SMS will be sent via Teli Gateway when configured.`,
          entity_type: 'STUDENT',
          entity_id: row.student_id,
        })
      }
    }

    return created
  }

  // ─── Parent Shortage Letter Export ────────────────────────────────────────

  /**
   * Generate a styled Excel workbook with one row per student-subject shortage.
   * Saves via Electron dialog → user picks destination.
   */
  async exportShortageLetters(threshold = 75, batchId?: string): Promise<void> {
    // Build query
    let sql = `
      SELECT
        s.student_id,
        s.name        AS student_name,
        s.phone       AS student_phone,
        s.parent_phone,
        b.batch_name,
        sub.subject_name,
        sub.subject_code,
        COUNT(DISTINCT ar.record_id)                                     AS total_sessions,
        SUM(CASE WHEN ar.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END) AS attended,
        ROUND(
          100.0 * SUM(CASE WHEN ar.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END)
          / NULLIF(COUNT(DISTINCT ar.record_id), 0),
          1
        ) AS pct,
        CEIL(
          (? / 100.0 * COUNT(DISTINCT ar.record_id) - SUM(CASE WHEN ar.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END))
          / (1 - ? / 100.0)
        ) AS classes_needed
      FROM attendance_record ar
      JOIN attendance_session sess ON sess.session_id = ar.session_id
        AND sess.status IN ('SUBMITTED','LOCKED')
      JOIN student s ON s.student_id = ar.student_id
      JOIN student_admission sa ON sa.student_id = s.student_id
      JOIN batch b ON b.batch_id = sa.batch_id
      JOIN subject sub ON sub.subject_id = sess.subject_id
      WHERE 1=1
    `
    const params: (number | string)[] = [threshold, threshold]
    if (batchId) { sql += ' AND sa.batch_id = ?'; params.push(batchId) }
    sql += ' GROUP BY ar.student_id, sess.subject_id HAVING pct < ? ORDER BY s.name, pct ASC'
    params.push(threshold)

    const rows = this.db.prepare(sql).all(...params) as any[]

    if (rows.length === 0) {
      this.notify({
        type: 'SYSTEM', severity: 'INFO',
        title: 'No Shortage Students',
        message: `All students meet the ${threshold}% attendance requirement.`,
      })
      return
    }

    // Build Excel workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Teli Attendance System'
    wb.created = new Date()

    const ws = wb.addWorksheet('Shortage Report', { pageSetup: { orientation: 'landscape' } })

    // Title row
    ws.mergeCells('A1:J1')
    const titleCell = ws.getCell('A1')
    titleCell.value = `Attendance Shortage Report (Below ${threshold}%) — Generated: ${new Date().toLocaleDateString('en-IN')}`
    titleCell.font = { bold: true, size: 13 }
    titleCell.alignment = { horizontal: 'center' }

    // Header row
    ws.addRow([])
    const headerRow = ws.addRow([
      'Student Name', 'Batch', 'Subject', 'Code',
      'Total Sessions', 'Attended', 'Attendance %',
      'Classes Needed', 'Student Phone', 'Parent Phone',
    ])
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
      cell.alignment = { horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      }
    })

    // Column widths
    ws.columns = [
      { key: 'name', width: 22 }, { key: 'batch', width: 16 },
      { key: 'subject', width: 22 }, { key: 'code', width: 10 },
      { key: 'total', width: 14 }, { key: 'attended', width: 12 },
      { key: 'pct', width: 14 }, { key: 'needed', width: 14 },
      { key: 'phone', width: 15 }, { key: 'parent', width: 15 },
    ]

    // Data rows
    for (const r of rows) {
      const pct = Number(r.pct)
      const needed = Math.max(0, Number(r.classes_needed))
      const dataRow = ws.addRow([
        r.student_name, r.batch_name, r.subject_name, r.subject_code,
        r.total_sessions, r.attended,
        `${pct}%`, needed > 0 ? needed : '—',
        r.student_phone ?? '—', r.parent_phone ?? '—',
      ])
      // Color-code by severity
      const pctCell = dataRow.getCell(7)
      pctCell.font = {
        bold: true,
        color: { argb: pct < 65 ? 'FFDC2626' : pct < 70 ? 'FFEA580C' : 'FFD97706' },
      }
      dataRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        }
      })
    }

    // Summary
    ws.addRow([])
    ws.addRow([`Total students with shortage: ${new Set(rows.map(r => r.student_id)).size}`, '', '', '', '', '', '', '', '', ''])

    // Save dialog
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Shortage Report',
      defaultPath: path.join(
        require('os').homedir(),
        `Shortage_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
      ),
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    })

    if (filePath) {
      await wb.xlsx.writeFile(filePath)
      this.notify({
        type: 'SYSTEM', severity: 'INFO',
        title: 'Export Complete',
        message: `Shortage letters exported to ${path.basename(filePath)} (${rows.length} entries).`,
      })
    }
  }
}
