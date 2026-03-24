/**
 * Notification Service
 * Handles email and SMS notifications for leave and scheduling events
 */

import { BaseService, type CloudflareEnv } from "./base";
import type { D1Database } from "@cloudflare/workers-types";

/** Strip all HTML tags from a string, looping until stable to handle nested fragments */
function stripHtmlTags(html: string): string {
  let result = html;
  let prev;
  do {
    prev = result;
    result = result.replaceAll(/<[^>]*>/g, "");
  } while (result !== prev);
  return result;
}

// ========================================
// Types
// ========================================

export type NotificationType = "email" | "sms" | "push";

export type NotificationCategory =
  | "leave_request_submitted"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_request_cancelled"
  | "schedule_created"
  | "schedule_updated"
  | "schedule_cancelled"
  | "swap_request_created"
  | "swap_request_accepted"
  | "swap_request_approved"
  | "swap_request_rejected"
  | "shift_reminder"
  // Waiting list notifications
  | "waiting_list_confirmed"
  | "waiting_list_called"
  | "waiting_list_expired"
  // Verification and authentication
  | "password_reset_request"
  | "password_reset_success"
  | "email_verification"
  | "email_verification_success"
  | "phone_verification"
  | "phone_verification_success";

export interface NotificationTemplate {
  category: NotificationCategory;
  type: NotificationType;
  subject?: string; // For email
  body: string;
  variables: string[]; // Placeholders like {{employeeName}}, {{startDate}}
}

export interface NotificationPayload {
  recipientId: number;
  recipientEmail?: string;
  recipientPhone?: string;
  category: NotificationCategory;
  type: NotificationType;
  data: Record<string, any>; // Variable values
  priority?: "low" | "normal" | "high";
  scheduledAt?: Date; // For scheduled notifications
}

export interface NotificationRecord {
  id: number;
  restaurantId: string;
  recipientId: number;
  category: NotificationCategory;
  type: NotificationType;
  subject: string | null;
  body: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  sentAt: number | null;
  failureReason: string | null;
  retryCount: number;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Email Provider Interface
// ========================================

export interface EmailProvider {
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// ========================================
// SMS Provider Interface
// ========================================

export interface SMSProvider {
  sendSMS(params: {
    to: string;
    body: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// ========================================
// MailChannels Email Provider (Cloudflare Official Recommendation)
// ========================================

export class MailChannelsEmailProvider implements EmailProvider {
  constructor(
    private fromEmail: string = "notifications@makanmakan.com",
    private fromName: string = "MakanMakan",
  ) {}

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: params.to }],
            },
          ],
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          subject: params.subject,
          content: [
            {
              type: "text/html",
              value: params.html,
            },
            ...(params.text
              ? [
                  {
                    type: "text/plain",
                    value: params.text,
                  },
                ]
              : []),
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `MailChannels error: ${errorText}` };
      }

      // MailChannels returns 202 Accepted with no body on success
      return { success: true, messageId: "mailchannels-sent" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ========================================
// Resend Email Provider (Alternative)
// ========================================

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private apiKey: string,
    private fromEmail: string = "notifications@makanmakan.com",
  ) {}

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text || stripHtmlTags(params.html),
        }),
      });

      const data = (await response.json()) as { message?: string; id?: string };

      if (!response.ok) {
        return { success: false, error: data.message || "Email send failed" };
      }

      return { success: true, messageId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
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
    private fromPhone: string,
  ) {}

  async sendSMS(params: { to: string; body: string }) {
    try {
      const auth = btoa(`${this.accountSid}:${this.authToken}`);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: params.to,
            From: this.fromPhone,
            Body: params.body,
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        sid?: string;
      };

      if (!response.ok) {
        return { success: false, error: data.message || "SMS send failed" };
      }

      return { success: true, messageId: data.sid };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ========================================
// Notification Templates
// ========================================

export const notificationTemplates: Record<
  NotificationCategory,
  Partial<NotificationTemplate>
> = {
  leave_request_submitted: {
    subject: "Leave Request Submitted - {{leaveType}}",
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
    variables: [
      "employeeName",
      "leaveType",
      "startDate",
      "endDate",
      "totalDays",
    ],
  },
  leave_request_approved: {
    subject: "Leave Request Approved - {{leaveType}}",
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
    variables: [
      "employeeName",
      "leaveType",
      "startDate",
      "endDate",
      "totalDays",
      "approverName",
      "approverNotes",
    ],
  },
  leave_request_rejected: {
    subject: "Leave Request Not Approved - {{leaveType}}",
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
    variables: [
      "employeeName",
      "leaveType",
      "startDate",
      "endDate",
      "rejectionReason",
    ],
  },
  leave_request_cancelled: {
    subject: "Leave Request Cancelled - {{leaveType}}",
    body: `
      <h2>Leave Request Cancelled</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your leave request has been cancelled.</p>
      <ul>
        <li><strong>Type:</strong> {{leaveType}}</li>
        <li><strong>Period:</strong> {{startDate}} to {{endDate}}</li>
      </ul>
    `,
    variables: ["employeeName", "leaveType", "startDate", "endDate"],
  },
  schedule_created: {
    subject: "New Schedule Assignment - {{shiftName}}",
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
    variables: [
      "employeeName",
      "scheduleDate",
      "shiftName",
      "startTime",
      "endTime",
      "notes",
    ],
  },
  schedule_updated: {
    subject: "Schedule Updated - {{shiftName}}",
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
    variables: [
      "employeeName",
      "scheduleDate",
      "shiftName",
      "startTime",
      "endTime",
    ],
  },
  schedule_cancelled: {
    subject: "Schedule Cancelled - {{shiftName}}",
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
    variables: ["employeeName", "scheduleDate", "shiftName", "reason"],
  },
  swap_request_created: {
    subject: "Swap Request Received - {{shiftName}}",
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
    variables: [
      "employeeName",
      "requesterName",
      "scheduleDate",
      "shiftName",
      "reason",
    ],
  },
  swap_request_accepted: {
    subject: "Swap Request Accepted - {{shiftName}}",
    body: `
      <h2>Swap Request Accepted</h2>
      <p>Dear {{employeeName}},</p>
      <p>{{accepterName}} has accepted your shift swap request.</p>
      <p>The swap is now pending manager approval.</p>
    `,
    variables: ["employeeName", "accepterName", "shiftName"],
  },
  swap_request_approved: {
    subject: "Swap Request Approved - {{shiftName}}",
    body: `
      <h2>Swap Request Approved ✅</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your shift swap has been approved by management.</p>
      <ul>
        <li><strong>Date:</strong> {{scheduleDate}}</li>
        <li><strong>Swapped with:</strong> {{otherEmployeeName}}</li>
      </ul>
    `,
    variables: ["employeeName", "scheduleDate", "otherEmployeeName"],
  },
  swap_request_rejected: {
    subject: "Swap Request Not Approved - {{shiftName}}",
    body: `
      <h2>Swap Request Update</h2>
      <p>Dear {{employeeName}},</p>
      <p>Your shift swap request could not be approved.</p>
      <ul>
        <li><strong>Reason:</strong> {{rejectionReason}}</li>
      </ul>
    `,
    variables: ["employeeName", "rejectionReason"],
  },
  shift_reminder: {
    subject: "Shift Reminder - {{shiftName}} Tomorrow",
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
    variables: [
      "employeeName",
      "scheduleDate",
      "shiftName",
      "startTime",
      "endTime",
    ],
  },

  // ============================================
  // Waiting List Notification Templates (SMS)
  // ============================================

  waiting_list_confirmed: {
    body: "【MakanMakan】{{customerName}} 您好，您已成功加入候位。排隊號碼：{{queueNumber}}，預計等待 {{estimatedWait}} 分鐘。",
    variables: ["customerName", "queueNumber", "estimatedWait"],
  },
  waiting_list_called: {
    body: "【MakanMakan】{{customerName}} 您好，輪到您了！請於 5 分鐘內至櫃檯報到，桌號：{{tableNumber}}。逾時將自動取消。",
    variables: ["customerName", "tableNumber"],
  },
  waiting_list_expired: {
    body: "【MakanMakan】{{customerName}} 您好，您的候位號碼 {{queueNumber}} 已過號。如需重新排隊，請至現場取號。",
    variables: ["customerName", "queueNumber"],
  },

  // ============================================
  // Verification and Authentication Templates
  // ============================================

  password_reset_request: {
    subject: "MakanMakan - 密碼重設請求",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">MakanMakan - 密碼重設</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">親愛的 <strong>{{userName}}</strong>，</p>

          <p style="font-size: 14px; line-height: 1.6;">
            我們收到了您的密碼重設請求。請點擊下方按鈕重設您的密碼：
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetLink}}"
               style="display: inline-block; padding: 12px 30px; background: #4F46E5; color: white;
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              重設密碼
            </a>
          </div>

          <p style="font-size: 12px; color: #6B7280;">
            或複製以下連結到瀏覽器：<br>
            <code style="background: #E5E7EB; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px;">{{resetLink}}</code>
          </p>

          <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #DC2626;">
              ⚠️ 此連結將在 <strong>15 分鐘</strong>後失效。
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">

          <p style="font-size: 13px; color: #6B7280;"><strong>安全提示：</strong></p>
          <ul style="font-size: 13px; color: #6B7280; line-height: 1.6;">
            <li>如果您沒有請求重設密碼，請忽略此郵件</li>
            <li>請勿將此連結分享給任何人</li>
            <li>請求來源 IP: {{ipAddress}}</li>
            <li>請求時間: {{requestTime}}</li>
          </ul>
        </div>

        <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
          <p>此郵件由系統自動發送，請勿直接回覆</p>
          <p>&copy; 2025 MakanMakan. All rights reserved.</p>
        </div>
      </div>
    `,
    variables: ["userName", "resetLink", "ipAddress", "requestTime"],
  },

  password_reset_success: {
    subject: "MakanMakan - 密碼已成功變更",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">✅ 密碼已成功變更</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">親愛的 <strong>{{userName}}</strong>，</p>

          <p style="font-size: 14px; line-height: 1.6;">
            您的帳號密碼已於 <strong>{{changeTime}}</strong> 成功變更。
          </p>

          <div style="background: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #047857;">
              您現在可以使用新密碼登入系統。
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">

          <p style="font-size: 13px; color: #6B7280;"><strong>變更資訊：</strong></p>
          <ul style="font-size: 13px; color: #6B7280; line-height: 1.6;">
            <li>變更時間: {{changeTime}}</li>
            <li>變更方式: {{changeMethod}}</li>
            <li>來源 IP: {{ipAddress}}</li>
          </ul>

          <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #DC2626;">
              <strong>⚠️ 重要：</strong>如果這不是您本人的操作，請立即聯繫客服或再次重設密碼。
            </p>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
          <p>此郵件由系統自動發送，請勿直接回覆</p>
          <p>&copy; 2025 MakanMakan. All rights reserved.</p>
        </div>
      </div>
    `,
    variables: ["userName", "changeTime", "changeMethod", "ipAddress"],
  },

  email_verification: {
    subject: "🎉 歡迎加入 MakanMakan - 請驗證您的 Email",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🎉 歡迎加入 MakanMakan！</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">親愛的 <strong>{{userName}}</strong>，</p>

          <p style="font-size: 14px; line-height: 1.6;">
            感謝您註冊 MakanMakan！請點擊下方按鈕驗證您的 Email 地址：
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{verificationLink}}"
               style="display: inline-block; padding: 12px 30px; background: #10B981; color: white;
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              驗證 Email
            </a>
          </div>

          <p style="font-size: 12px; color: #6B7280;">
            或複製以下連結到瀏覽器：<br>
            <code style="background: #E5E7EB; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px;">{{verificationLink}}</code>
          </p>

          <p style="font-size: 13px; color: #6B7280; margin-top: 20px;">
            <strong>此連結將在 24 小時後失效。</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">

          <p style="font-size: 14px; color: #374151;"><strong>驗證後您將享有：</strong></p>
          <ul style="font-size: 13px; color: #6B7280; line-height: 1.8;">
            <li>✅ 完整的訂餐功能</li>
            <li>✅ 訂單追蹤和歷史記錄</li>
            <li>✅ 專屬優惠和積分獎勵</li>
            <li>✅ 優先客服支援</li>
          </ul>
        </div>

        <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
          <p>如果您沒有註冊此帳號，請忽略此郵件</p>
          <p>&copy; 2025 MakanMakan. All rights reserved.</p>
        </div>
      </div>
    `,
    variables: ["userName", "verificationLink"],
  },

  email_verification_success: {
    subject: "✅ Email 驗證成功 - MakanMakan",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">✅ Email 驗證成功！</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">親愛的 <strong>{{userName}}</strong>，</p>

          <p style="font-size: 14px; line-height: 1.6;">
            您的 Email 地址已成功驗證！現在您可以享受 MakanMakan 的完整功能了。
          </p>

          <div style="background: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #047857;">
              立即開始探索美食，享受優質的用餐體驗！
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{appLink}}"
               style="display: inline-block; padding: 12px 30px; background: #10B981; color: white;
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              開始訂餐
            </a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
          <p>&copy; 2025 MakanMakan. All rights reserved.</p>
        </div>
      </div>
    `,
    variables: ["userName", "appLink"],
  },

  phone_verification: {
    subject: "MakanMakan - 手機驗證碼",
    body: `【MakanMakan】您的驗證碼：{{otpCode}}。有效期限 5 分鐘。請勿將驗證碼分享給任何人。`,
    variables: ["otpCode"],
  },

  phone_verification_success: {
    subject: "MakanMakan - 手機驗證成功",
    body: `【MakanMakan】您的手機號碼 {{phone}} 已成功驗證！感謝您使用 MakanMakan。`,
    variables: ["phone"],
  },
};

// ========================================
// Notification Service
// ========================================

export class NotificationService extends BaseService {
  private emailProvider: EmailProvider | null = null;
  private smsProvider: SMSProvider | null = null;

  constructor(d1: D1Database, env: CloudflareEnv) {
    super(d1, env);
    this.initializeProviders(env);
  }

  private initializeProviders(env: CloudflareEnv) {
    // Initialize email provider
    // Priority: MailChannels (Cloudflare official) > Resend (alternative)
    if (env.USE_MAILCHANNELS !== "false") {
      // MailChannels is enabled by default (no API key needed!)
      this.emailProvider = new MailChannelsEmailProvider(
        env.NOTIFICATION_FROM_EMAIL || "notifications@makanmakan.com",
        "MakanMakan",
      );
    } else if (env.RESEND_API_KEY) {
      // Fallback to Resend if explicitly disabled MailChannels
      this.emailProvider = new ResendEmailProvider(
        env.RESEND_API_KEY,
        env.NOTIFICATION_FROM_EMAIL || "notifications@makanmakan.com",
      );
    }

    // Initialize SMS provider (Twilio)
    if (
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_PHONE_NUMBER
    ) {
      this.smsProvider = new TwilioSMSProvider(
        env.TWILIO_ACCOUNT_SID,
        env.TWILIO_AUTH_TOKEN,
        env.TWILIO_PHONE_NUMBER,
      );
    }
  }

  /**
   * Send notification (email, SMS, or both)
   */
  async sendNotification(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Get template
      const template = notificationTemplates[payload.category];
      if (!template) {
        return {
          success: false,
          errors: [`Template not found for category: ${payload.category}`],
        };
      }

      // Render content
      const subject = this.renderTemplate(template.subject || "", payload.data);
      const body = this.renderTemplate(template.body || "", payload.data);

      // Send based on type
      if (payload.type === "email" && payload.recipientEmail) {
        if (!this.emailProvider) {
          errors.push("Email provider not configured");
        } else {
          const result = await this.emailProvider.sendEmail({
            to: payload.recipientEmail,
            subject,
            html: body,
          });

          if (!result.success) {
            errors.push(`Email failed: ${result.error}`);
          }
        }
      }

      if (payload.type === "sms" && payload.recipientPhone) {
        if (!this.smsProvider) {
          errors.push("SMS provider not configured");
        } else {
          // Strip HTML for SMS
          const smsBody = stripHtmlTags(body).trim();
          const result = await this.smsProvider.sendSMS({
            to: payload.recipientPhone,
            body: smsBody,
          });

          if (!result.success) {
            errors.push(`SMS failed: ${result.error}`);
          }
        }
      }

      return { success: errors.length === 0, errors };
    } catch (error) {
      console.error("Notification send error:", error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Simple template renderer (replaces {{variable}} with values)
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template;

    // Replace {{variable}} placeholders
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      result = result.replace(placeholder, String(value || ""));
    }

    // Handle {{#if variable}} conditionals (simple implementation)
    result = result.replace(
      /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
      (match, key, content) => {
        return data[key] ? content : "";
      },
    );

    // Clean up any remaining unresolved placeholders (missing variables)
    result = result.replace(/{{(\w+)}}/g, "");

    return result.trim();
  }

  /**
   * Send bulk notifications (for batch operations)
   */
  async sendBulkNotifications(payloads: NotificationPayload[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: Array<{ payload: NotificationPayload; errors: string[] }>;
  }> {
    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as Array<{ payload: NotificationPayload; errors: string[] }>,
    };

    for (const payload of payloads) {
      const result = await this.sendNotification(payload);
      if (result.success) {
        results.successCount++;
      } else {
        results.failureCount++;
        results.errors.push({ payload, errors: result.errors });
      }
    }

    return results;
  }

  /**
   * Test notification (for configuration verification)
   */
  async sendTestNotification(
    type: NotificationType,
    recipient: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (type === "email") {
        if (!this.emailProvider) {
          return { success: false, error: "Email provider not configured" };
        }
        return await this.emailProvider.sendEmail({
          to: recipient,
          subject: "Test Notification from MakanMakan",
          html: "<h2>Test Email</h2><p>Your notification system is working correctly!</p>",
        });
      }

      if (type === "sms") {
        if (!this.smsProvider) {
          return { success: false, error: "SMS provider not configured" };
        }
        return await this.smsProvider.sendSMS({
          to: recipient,
          body: "Test SMS from MakanMakan. Your notification system is working!",
        });
      }

      return { success: false, error: "Invalid notification type" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
