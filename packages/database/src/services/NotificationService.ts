/**
 * Notification Service
 * Handles email and SMS notifications for leave and scheduling events
 */

import { BaseService, type CloudflareEnv } from './base'
import type { D1Database } from '@cloudflare/workers-types'

// ========================================
// Types
// ========================================

export type NotificationType = 'email' | 'sms' | 'push'

export type NotificationCategory =
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'leave_request_rejected'
  | 'leave_request_cancelled'
  | 'schedule_created'
  | 'schedule_updated'
  | 'schedule_cancelled'
  | 'swap_request_created'
  | 'swap_request_accepted'
  | 'swap_request_approved'
  | 'swap_request_rejected'
  | 'shift_reminder'

export interface NotificationTemplate {
  category: NotificationCategory
  type: NotificationType
  subject?: string // For email
  body: string
  variables: string[] // Placeholders like {{employeeName}}, {{startDate}}
}

export interface NotificationPayload {
  recipientId: number
  recipientEmail?: string
  recipientPhone?: string
  category: NotificationCategory
  type: NotificationType
  data: Record<string, any> // Variable values
  priority?: 'low' | 'normal' | 'high'
  scheduledAt?: Date // For scheduled notifications
}

export interface NotificationRecord {
  id: number
  restaurantId: number
  recipientId: number
  category: NotificationCategory
  type: NotificationType
  subject: string | null
  body: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sentAt: number | null
  failureReason: string | null
  retryCount: number
  metadata: string | null
  createdAt: Date
  updatedAt: Date
}

// ========================================
// Email Provider Interface
// ========================================

export interface EmailProvider {
  sendEmail(params: {
    to: string
    subject: string
    html: string
    text?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
}

// ========================================
// SMS Provider Interface
// ========================================

export interface SMSProvider {
  sendSMS(params: {
    to: string
    body: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
}

// ========================================
// Resend Email Provider (Cloudflare recommended)
// ========================================

export class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private fromEmail: string = 'notifications@makanmakan.com') {}

  async sendEmail(params: { to: string; subject: string; html: string; text?: string }) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text || params.html.replace(/<[^>]*>/g, ''),
        }),
      })

      const data = await response.json() as { message?: string; id?: string }

      if (!response.ok) {
        return { success: false, error: data.message || 'Email send failed' }
      }

      return { success: true, messageId: data.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

// ========================================
// Twilio SMS Provider
// ========================================

export class TwilioSMSProvider implements SMSProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromPhone: string
  ) {}

  async sendSMS(params: { to: string; body: string }) {
    try {
      const auth = btoa(`${this.accountSid}:${this.authToken}`)

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: params.to,
            From: this.fromPhone,
            Body: params.body,
          }),
        }
      )

      const data = await response.json() as { message?: string; sid?: string }

      if (!response.ok) {
        return { success: false, error: data.message || 'SMS send failed' }
      }

      return { success: true, messageId: data.sid }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

// ========================================
// Notification Templates
// ========================================

export const notificationTemplates: Record<NotificationCategory, Partial<NotificationTemplate>> = {
  leave_request_submitted: {
    subject: 'Leave Request Submitted - {{leaveType}}',
    body: `
      <h2>Leave Request Submitted</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your leave request has been submitted successfully.</p>
      <ul>
        <li><strong>Type:</strong> {{leaveType}}</li>
        <li><strong>Period:</strong> {{startDate}} to {{endDate}}</li>
        <li><strong>Days:</strong> {{totalDays}}</li>
        <li><strong>Status:</strong> Pending Approval</li>
      </ul>
      <p>You will be notified once your request is reviewed.</p>
    `,
    variables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'totalDays'],
  },
  leave_request_approved: {
    subject: 'Leave Request Approved - {{leaveType}}',
    body: `
      <h2>Leave Request Approved ✅</h2>
      <p>Dear {{employeeName}},</p>
      <p>Good news! Your leave request has been approved.</p>
      <ul>
        <li><strong>Type:</strong> {{leaveType}}</li>
        <li><strong>Period:</strong> {{startDate}} to {{endDate}}</li>
        <li><strong>Days:</strong> {{totalDays}}</li>
        <li><strong>Approved by:</strong> {{approverName}}</li>
        {{#if approverNotes}}
        <li><strong>Notes:</strong> {{approverNotes}}</li>
        {{/if}}
      </ul>
      <p>Enjoy your time off!</p>
    `,
    variables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'totalDays', 'approverName', 'approverNotes'],
  },
  leave_request_rejected: {
    subject: 'Leave Request Not Approved - {{leaveType}}',
    body: `
      <h2>Leave Request Update</h2>
      <p>Dear {{employeeName}},</p>
      <p>We regret to inform you that your leave request could not be approved at this time.</p>
      <ul>
        <li><strong>Type:</strong> {{leaveType}}</li>
        <li><strong>Period:</strong> {{startDate}} to {{endDate}}</li>
        <li><strong>Reason:</strong> {{rejectionReason}}</li>
      </ul>
      <p>Please contact your manager if you have any questions.</p>
    `,
    variables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'rejectionReason'],
  },
  leave_request_cancelled: {
    subject: 'Leave Request Cancelled - {{leaveType}}',
    body: `
      <h2>Leave Request Cancelled</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your leave request has been cancelled.</p>
      <ul>
        <li><strong>Type:</strong> {{leaveType}}</li>
        <li><strong>Period:</strong> {{startDate}} to {{endDate}}</li>
      </ul>
    `,
    variables: ['employeeName', 'leaveType', 'startDate', 'endDate'],
  },
  schedule_created: {
    subject: 'New Schedule Assignment - {{shiftName}}',
    body: `
      <h2>New Shift Assigned</h2>
      <p>Dear {{employeeName}},</p>
      <p>You have been assigned a new shift:</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Shift:</strong> {{shiftName}}</li>
        <li><strong>Time:</strong> {{startTime}} - {{endTime}}</li>
        {{#if notes}}
        <li><strong>Notes:</strong> {{notes}}</li>
        {{/if}}
      </ul>
    `,
    variables: ['employeeName', 'scheduleDate', 'shiftName', 'startTime', 'endTime', 'notes'],
  },
  schedule_updated: {
    subject: 'Schedule Updated - {{shiftName}}',
    body: `
      <h2>Shift Schedule Updated</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your shift schedule has been updated:</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Shift:</strong> {{shiftName}}</li>
        <li><strong>Time:</strong> {{startTime}} - {{endTime}}</li>
      </ul>
    `,
    variables: ['employeeName', 'scheduleDate', 'shiftName', 'startTime', 'endTime'],
  },
  schedule_cancelled: {
    subject: 'Schedule Cancelled - {{shiftName}}',
    body: `
      <h2>Shift Cancelled</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your scheduled shift has been cancelled:</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Shift:</strong> {{shiftName}}</li>
        {{#if reason}}
        <li><strong>Reason:</strong> {{reason}}</li>
        {{/if}}
      </ul>
    `,
    variables: ['employeeName', 'scheduleDate', 'shiftName', 'reason'],
  },
  swap_request_created: {
    subject: 'Swap Request Received - {{shiftName}}',
    body: `
      <h2>Shift Swap Request</h2>
      <p>Dear {{employeeName}},</p>
      <p>{{requesterName}} would like to swap shifts with you:</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Shift:</strong> {{shiftName}}</li>
        <li><strong>Reason:</strong> {{reason}}</li>
      </ul>
      <p>Please review and respond to this request in the system.</p>
    `,
    variables: ['employeeName', 'requesterName', 'scheduleDate', 'shiftName', 'reason'],
  },
  swap_request_accepted: {
    subject: 'Swap Request Accepted - {{shiftName}}',
    body: `
      <h2>Swap Request Accepted</h2>
      <p>Dear {{employeeName}},</p>
      <p>{{accepterName}} has accepted your shift swap request.</p>
      <p>The swap is now pending manager approval.</p>
    `,
    variables: ['employeeName', 'accepterName', 'shiftName'],
  },
  swap_request_approved: {
    subject: 'Swap Request Approved - {{shiftName}}',
    body: `
      <h2>Swap Request Approved ✅</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your shift swap has been approved by management.</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Swapped with:</strong> {{otherEmployeeName}}</li>
      </ul>
    `,
    variables: ['employeeName', 'scheduleDate', 'otherEmployeeName'],
  },
  swap_request_rejected: {
    subject: 'Swap Request Not Approved - {{shiftName}}',
    body: `
      <h2>Swap Request Update</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your shift swap request could not be approved.</p>
      <ul>
        <li><strong>Reason:</strong> {{rejectionReason}}</li>
      </ul>
    `,
    variables: ['employeeName', 'rejectionReason'],
  },
  shift_reminder: {
    subject: 'Shift Reminder - {{shiftName}} Tomorrow',
    body: `
      <h2>Shift Reminder</h2>
      <p>Dear {{employeeName}},</p>
      <p>This is a reminder that you have a shift tomorrow:</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Shift:</strong> {{shiftName}}</li>
        <li><strong>Time:</strong> {{startTime}} - {{endTime}}</li>
      </ul>
      <p>See you tomorrow!</p>
    `,
    variables: ['employeeName', 'scheduleDate', 'shiftName', 'startTime', 'endTime'],
  },
}

// ========================================
// Notification Service
// ========================================

export class NotificationService extends BaseService {
  private emailProvider: EmailProvider | null = null
  private smsProvider: SMSProvider | null = null

  constructor(d1: D1Database, env: CloudflareEnv) {
    super(d1, env)
    this.initializeProviders(env)
  }

  private initializeProviders(env: CloudflareEnv) {
    // Initialize email provider (Resend)
    if (env.RESEND_API_KEY) {
      this.emailProvider = new ResendEmailProvider(
        env.RESEND_API_KEY,
        env.NOTIFICATION_FROM_EMAIL || 'notifications@makanmakan.com'
      )
    }

    // Initialize SMS provider (Twilio)
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
      this.smsProvider = new TwilioSMSProvider(
        env.TWILIO_ACCOUNT_SID,
        env.TWILIO_AUTH_TOKEN,
        env.TWILIO_PHONE_NUMBER
      )
    }
  }

  /**
   * Send notification (email, SMS, or both)
   */
  async sendNotification(payload: NotificationPayload): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // Get template
      const template = notificationTemplates[payload.category]
      if (!template) {
        return { success: false, errors: [`Template not found for category: ${payload.category}`] }
      }

      // Render content
      const subject = this.renderTemplate(template.subject || '', payload.data)
      const body = this.renderTemplate(template.body || '', payload.data)

      // Send based on type
      if (payload.type === 'email' && payload.recipientEmail) {
        if (!this.emailProvider) {
          errors.push('Email provider not configured')
        } else {
          const result = await this.emailProvider.sendEmail({
            to: payload.recipientEmail,
            subject,
            html: body,
          })

          if (!result.success) {
            errors.push(`Email failed: ${result.error}`)
          }
        }
      }

      if (payload.type === 'sms' && payload.recipientPhone) {
        if (!this.smsProvider) {
          errors.push('SMS provider not configured')
        } else {
          // Strip HTML for SMS
          const smsBody = body.replace(/<[^>]*>/g, '').trim()
          const result = await this.smsProvider.sendSMS({
            to: payload.recipientPhone,
            body: smsBody,
          })

          if (!result.success) {
            errors.push(`SMS failed: ${result.error}`)
          }
        }
      }

      return { success: errors.length === 0, errors }
    } catch (error) {
      console.error('Notification send error:', error)
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Simple template renderer (replaces {{variable}} with values)
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template

    // Replace {{variable}} placeholders
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(placeholder, String(value || ''))
    }

    // Handle {{#if variable}} conditionals (simple implementation)
    result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, key, content) => {
      return data[key] ? content : ''
    })

    return result.trim()
  }

  /**
   * Send bulk notifications (for batch operations)
   */
  async sendBulkNotifications(payloads: NotificationPayload[]): Promise<{
    successCount: number
    failureCount: number
    errors: Array<{ payload: NotificationPayload; errors: string[] }>
  }> {
    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as Array<{ payload: NotificationPayload; errors: string[] }>,
    }

    for (const payload of payloads) {
      const result = await this.sendNotification(payload)
      if (result.success) {
        results.successCount++
      } else {
        results.failureCount++
        results.errors.push({ payload, errors: result.errors })
      }
    }

    return results
  }

  /**
   * Test notification (for configuration verification)
   */
  async sendTestNotification(
    type: NotificationType,
    recipient: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (type === 'email') {
        if (!this.emailProvider) {
          return { success: false, error: 'Email provider not configured' }
        }
        return await this.emailProvider.sendEmail({
          to: recipient,
          subject: 'Test Notification from MakanMakan',
          html: '<h2>Test Email</h2><p>Your notification system is working correctly!</p>',
        })
      }

      if (type === 'sms') {
        if (!this.smsProvider) {
          return { success: false, error: 'SMS provider not configured' }
        }
        return await this.smsProvider.sendSMS({
          to: recipient,
          body: 'Test SMS from MakanMakan. Your notification system is working!',
        })
      }

      return { success: false, error: 'Invalid notification type' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
