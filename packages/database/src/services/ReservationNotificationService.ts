import type { D1Database } from "@cloudflare/workers-types";
import type { ReservationResponse } from "@makanmakan/shared-types";
import type { CloudflareEnv } from "./base";
import {
  NotificationService,
  type NotificationCategory,
  type NotificationPayload,
} from "./NotificationService";

export type ReservationNotificationType = "confirmed" | "cancelled" | "no_show";

export interface ReservationNotificationEvent {
  type: ReservationNotificationType;
  reservationId: string;
  reservation: ReservationResponse;
  reason?: string;
}

export interface ReservationNotifier {
  send(event: ReservationNotificationEvent): Promise<void>;
}

const categoryByType: Record<
  ReservationNotificationType,
  NotificationCategory
> = {
  confirmed: "reservation_confirmed",
  cancelled: "reservation_cancelled",
  no_show: "reservation_no_show",
};

export class ReservationNotificationService implements ReservationNotifier {
  private notificationService: NotificationService;

  constructor(d1: D1Database, env: CloudflareEnv) {
    this.notificationService = new NotificationService(d1, env);
  }

  async send(event: ReservationNotificationEvent): Promise<void> {
    const { reservation } = event;
    const category = categoryByType[event.type];
    const data = {
      customerName: reservation.customerName,
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      partySize: reservation.partySize.toString(),
      confirmationCode: reservation.confirmationCode,
      restaurantId: reservation.restaurantId,
      reason: event.reason || "",
    };
    const recipientId = this.getRecipientId(reservation);
    const payloads: NotificationPayload[] = [];

    if (reservation.customerEmail) {
      payloads.push({
        recipientId,
        recipientEmail: reservation.customerEmail,
        category,
        type: "email",
        data,
        priority: "normal",
      });
    }

    if (reservation.customerPhone) {
      payloads.push({
        recipientId,
        recipientPhone: reservation.customerPhone,
        category,
        type: "sms",
        data,
        priority: "normal",
      });
    }

    if (payloads.length === 0) {
      return;
    }

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
      console.error("Reservation notification send failed:", errors);
    }
  }

  private getRecipientId(reservation: ReservationResponse): string {
    return reservation.customerId || reservation.id;
  }
}
