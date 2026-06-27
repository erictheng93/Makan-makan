import type { D1Database } from "@cloudflare/workers-types";
import {
  NotificationService,
  type NotificationCategory,
  type NotificationPayload,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";

type ServiceBookingNotificationType =
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

interface ServiceBookingNotificationEvent {
  type: ServiceBookingNotificationType;
  booking: {
    id: string;
    customerId?: string | null;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    restaurantId: string;
    bookingDate: string;
    bookingTime: string;
    partySize?: number | null;
    confirmationCode: string;
  };
}

const categoryByType: Record<
  ServiceBookingNotificationType,
  NotificationCategory
> = {
  confirmed: "service_booking_confirmed",
  cancelled: "service_booking_cancelled",
  completed: "service_booking_completed",
  no_show: "service_booking_no_show",
};

export class ServiceBookingNotificationService {
  private readonly notificationService: NotificationService;

  constructor(d1: D1Database, env: Env) {
    this.notificationService = new NotificationService(d1, env);
  }

  async send(event: ServiceBookingNotificationEvent): Promise<void> {
    const { booking } = event;
    const category = categoryByType[event.type];
    const data = {
      customerName: booking.customerName,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      partySize: String(booking.partySize ?? 1),
      confirmationCode: booking.confirmationCode,
      restaurantId: booking.restaurantId,
    };
    const recipientId = this.getRecipientId(booking.customerId);
    const payloads: NotificationPayload[] = [];

    if (booking.customerEmail) {
      payloads.push({
        recipientId,
        recipientEmail: booking.customerEmail,
        category,
        type: "email",
        data,
        priority: "normal",
      });
    }

    if (booking.customerPhone) {
      payloads.push({
        recipientId,
        recipientPhone: booking.customerPhone,
        category,
        type: "sms",
        data,
        priority: "normal",
      });
    }

    if (payloads.length === 0) return;

    const results = await Promise.all(
      payloads.map((payload) =>
        this.notificationService.sendNotification(payload),
      ),
    );
    const errors = results.flatMap((result, index) =>
      result.success
        ? []
        : result.errors.map((error) => `${payloads[index].type}: ${error}`),
    );

    if (errors.length > 0) {
      console.error("Service booking notification send failed:", errors);
    }
  }

  private getRecipientId(customerId: string | null | undefined): string {
    return customerId?.trim() || "service-booking-customer";
  }
}
