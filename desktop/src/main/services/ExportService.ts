import ExcelJS from 'exceljs'
import { dialog, BrowserWindow } from 'electron'
import fs from 'fs'

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '-'
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export class ExportService {
  /**
   * Exports dataset to Excel file with auto-styling and prompt save dialog
   */
  static async exportToExcel(
    title: string,
    columns: Array<{ header: string; key: string; width?: number }>,
    rows: any[],
    defaultFileName: string
  ): Promise<{ success: boolean; filePath?: string; message?: string }> {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: `Export ${title}`,
        defaultPath: defaultFileName,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      })

      if (canceled || !filePath) {
        return { success: false, message: 'Export cancelled' }
      }

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Teli Attendance System'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet(title)

      // Add columns
      sheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || 18,
      }))

      // Style header row
      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate 800
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Add data rows
      rows.forEach((rowData) => {
        sheet.addRow(rowData)
      })

      // Zebra striping & cell styling
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        row.alignment = { vertical: 'middle' }
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }, // Slate 50
          }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      fs.writeFileSync(filePath, Buffer.from(buffer))

      return { success: true, filePath, message: 'Export successful' }
    } catch (err) {
      console.error('Export error:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to export excel',
      }
    }
  }

  /**
   * Exports dataset to PDF file using offscreen printToPDF with prompt save dialog
   */
  static async exportToPdf(
    title: string,
    columns: Array<{ header: string; key: string }>,
    rows: any[],
    defaultFileName: string
  ): Promise<{ success: boolean; filePath?: string; message?: string }> {
    let win: BrowserWindow | null = null
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: `Export ${title}`,
        defaultPath: defaultFileName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) {
        return { success: false, message: 'Export cancelled' }
      }

      const generatedAt = new Date().toLocaleString()

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10px;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      margin-bottom: 14px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .header .meta {
      font-size: 9px;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }
    th {
      background-color: #1e293b !important;
      color: #ffffff !important;
      text-align: left;
      padding: 6px 8px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid #1e293b;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
      font-size: 9.5px;
      vertical-align: middle;
      word-break: break-word;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc !important;
    }
    .footer {
      margin-top: 14px;
      font-size: 8.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated: ${escapeHtml(generatedAt)} &bull; Total Records: ${rows.length}</div>
  </div>
  <table>
    <thead>
      <tr>
        ${columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          ${columns
            .map((c) => {
              const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '-'
              return `<td>${escapeHtml(val)}</td>`
            })
            .join('')}
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="footer">
    <span>Teli Attendance Management System</span>
    <span>Page 1</span>
  </div>
</body>
</html>`

      win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        landscape: true,
        pageSize: 'A4',
      })

      win.destroy()
      win = null

      fs.writeFileSync(filePath, pdfBuffer)

      return { success: true, filePath, message: 'Export successful' }
    } catch (err) {
      if (win) {
        try {
          win.destroy()
        } catch {
          // ignore
        }
      }
      console.error('PDF Export error:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to export PDF',
      }
    }
  }
}

