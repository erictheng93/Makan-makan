/**
 * Export Service
 * Handles exporting leave and scheduling data to various formats
 */

import type { D1Database } from '@cloudflare/workers-types'

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf'
  startDate?: string
  endDate?: string
  employeeIds?: number[]
  leaveTypeIds?: number[]
}

export interface ExportResult {
  success: boolean
  data?: string | ArrayBuffer
  filename: string
  mimeType: string
  error?: string
}

export class ExportService {
  constructor(private db: D1Database) {}

  /**
   * Export leave requests
   */
  async exportLeaveRequests(
    restaurantId: number,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Build query
      let query = `
        SELECT
          lr.id,
          u.full_name as employee_name,
          u.email as employee_email,
          lt.name as leave_type,
          lr.start_date,
          lr.end_date,
          lr.start_period,
          lr.end_period,
          lr.total_days,
          lr.reason,
          lr.status,
          lr.created_at,
          approver.full_name as approver_name,
          lr.approved_at,
          lr.rejection_reason
        FROM leave_requests lr
        JOIN users u ON lr.employee_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN users approver ON lr.approved_by = approver.id
        WHERE lr.restaurant_id = ?
      `
      const params: any[] = [restaurantId]

      if (options.startDate) {
        query += ' AND lr.start_date >= ?'
        params.push(options.startDate)
      }

      if (options.endDate) {
        query += ' AND lr.end_date <= ?'
        params.push(options.endDate)
      }

      if (options.employeeIds && options.employeeIds.length > 0) {
        query += ` AND lr.employee_id IN (${options.employeeIds.map(() => '?').join(',')})`
        params.push(...options.employeeIds)
      }

      if (options.leaveTypeIds && options.leaveTypeIds.length > 0) {
        query += ` AND lr.leave_type_id IN (${options.leaveTypeIds.map(() => '?').join(',')})`
        params.push(...options.leaveTypeIds)
      }

      query += ' ORDER BY lr.created_at DESC'

      const results = await this.db.prepare(query).bind(...params).all<any>()
      const records = results.results || []

      // Generate export based on format
      switch (options.format) {
        case 'csv':
          return this.generateCSV(records, 'leave_requests')
        case 'excel':
          return this.generateExcel(records, 'leave_requests')
        case 'pdf':
          return this.generatePDF(records, 'leave_requests', 'Leave Requests Report')
        default:
          throw new Error(`Unsupported format: ${options.format}`)
      }
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  /**
   * Export leave balances
   */
  async exportLeaveBalances(
    restaurantId: number,
    year: number,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    try {
      let query = `
        SELECT
          u.full_name as employee_name,
          u.email as employee_email,
          u.role,
          lt.name as leave_type,
          lb.year,
          lb.total_days,
          lb.used_days,
          lb.pending_days,
          lb.remaining_days,
          lb.carryover_days
        FROM employee_leave_balances lb
        JOIN users u ON lb.employee_id = u.id
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE u.restaurant_id = ? AND lb.year = ?
      `
      const params: any[] = [restaurantId, year]

      if (options.employeeIds && options.employeeIds.length > 0) {
        query += ` AND lb.employee_id IN (${options.employeeIds.map(() => '?').join(',')})`
        params.push(...options.employeeIds)
      }

      query += ' ORDER BY u.full_name, lt.name'

      const results = await this.db.prepare(query).bind(...params).all<any>()
      const records = results.results || []

      switch (options.format || 'csv') {
        case 'csv':
          return this.generateCSV(records, 'leave_balances')
        case 'excel':
          return this.generateExcel(records, 'leave_balances')
        case 'pdf':
          return this.generatePDF(records, 'leave_balances', `Leave Balances ${year}`)
        default:
          throw new Error(`Unsupported format: ${options.format}`)
      }
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  /**
   * Export employee schedules
   */
  async exportSchedules(
    restaurantId: number,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      let query = `
        SELECT
          es.id,
          u.full_name as employee_name,
          u.email as employee_email,
          st.name as shift_name,
          es.work_date,
          st.start_time,
          st.end_time,
          st.duration_minutes / 60.0 as hours,
          es.status,
          es.actual_start_time,
          es.actual_end_time,
          es.actual_duration_minutes / 60.0 as actual_hours,
          es.notes
        FROM employee_schedules es
        JOIN users u ON es.employee_id = u.id
        LEFT JOIN shift_templates st ON es.shift_template_id = st.id
        WHERE es.restaurant_id = ?
      `
      const params: any[] = [restaurantId]

      if (options.startDate) {
        query += ' AND es.work_date >= ?'
        params.push(options.startDate)
      }

      if (options.endDate) {
        query += ' AND es.work_date <= ?'
        params.push(options.endDate)
      }

      if (options.employeeIds && options.employeeIds.length > 0) {
        query += ` AND es.employee_id IN (${options.employeeIds.map(() => '?').join(',')})`
        params.push(...options.employeeIds)
      }

      query += ' ORDER BY es.work_date DESC, u.full_name'

      const results = await this.db.prepare(query).bind(...params).all<any>()
      const records = results.results || []

      switch (options.format) {
        case 'csv':
          return this.generateCSV(records, 'schedules')
        case 'excel':
          return this.generateExcel(records, 'schedules')
        case 'pdf':
          return this.generatePDF(records, 'schedules', 'Employee Schedules')
        default:
          throw new Error(`Unsupported format: ${options.format}`)
      }
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  /**
   * Generate CSV format
   */
  private generateCSV(records: any[], filename: string): ExportResult {
    if (records.length === 0) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        error: 'No data to export'
      }
    }

    // Get headers from first record
    const headers = Object.keys(records[0])
    const csvHeaders = headers.join(',')

    // Convert records to CSV rows
    const csvRows = records.map(record => {
      return headers.map(header => {
        const value = record[header]
        // Escape commas and quotes
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    })

    const csv = [csvHeaders, ...csvRows].join('\n')

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF'
    const data = bom + csv

    return {
      success: true,
      data,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv;charset=utf-8'
    }
  }

  /**
   * Generate Excel format (using CSV for now, can be enhanced with xlsx library)
   */
  private generateExcel(records: any[], filename: string): ExportResult {
    // For now, use CSV format which Excel can open
    // TODO: Integrate with xlsx library for proper .xlsx format
    const result = this.generateCSV(records, filename)
    if (result.success) {
      result.filename = result.filename.replace('.csv', '.xlsx')
      result.mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    return result
  }

  /**
   * Generate PDF format (simple HTML table for now)
   */
  private generatePDF(records: any[], filename: string, title: string): ExportResult {
    if (records.length === 0) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        error: 'No data to export'
      }
    }

    const headers = Object.keys(records[0])

    // Generate HTML table
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #3B82F6;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background-color: #3B82F6;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    tr:hover {
      background-color: #f3f4f6;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated on: ${new Date().toLocaleString()}</p>
  <p>Total Records: ${records.length}</p>

  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${this.formatHeader(h)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${records.map(record => `
        <tr>
          ${headers.map(h => `<td>${this.formatValue(record[h])}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>MakanMakan Restaurant Management System</p>
    <p>&copy; ${new Date().getFullYear()} All rights reserved</p>
  </div>
</body>
</html>
    `.trim()

    return {
      success: true,
      data: html,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.html`,
      mimeType: 'text/html;charset=utf-8'
    }
  }

  /**
   * Format header for display
   */
  private formatHeader(header: string): string {
    return header
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Format value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
  }
}

/**
 * Helper function to trigger browser download
 * Use this in frontend to download exported data
 * Note: This function is only available in browser environments
 */
export function downloadExportedFile(
  data: string | ArrayBuffer,
  filename: string,
  mimeType: string
): void {
  // Type assertion for browser environment check
  const global = globalThis as any

  // Check if we're in a browser environment
  if (typeof global.window === 'undefined' || typeof global.document === 'undefined') {
    throw new Error('downloadExportedFile is only available in browser environments')
  }

  const blob = new Blob([data], { type: mimeType })
  const url = global.window.URL.createObjectURL(blob)
  const link = global.document.createElement('a')
  link.href = url
  link.download = filename
  global.document.body.appendChild(link)
  link.click()
  global.document.body.removeChild(link)
  global.window.URL.revokeObjectURL(url)
}
