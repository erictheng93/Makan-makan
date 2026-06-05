import { apiClient } from "./api";

export type ServiceBookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface ServiceBookingAvailabilitySlot {
  timeSlot: string;
  remaining: number | null;
  isAvailable: boolean;
}

export interface ServiceBooking {
  id: string;
  restaurantId: string;
  serviceItemId: number;
  serviceNameSnapshot: string;
  durationMinutesSnapshot?: number | null;
  priceCentsSnapshot: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  bookingDate: string;
  bookingTime: string;
  partySize: number;
  status: ServiceBookingStatus;
  confirmationCode: string;
  specialRequests?: string | null;
  voucherDiscountCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  paymentStatus: "unpaid" | "paid" | "refunded";
  paymentMethod: "none" | "credits" | "cash";
}

export interface CreateServiceBookingInput {
  restaurantId: string;
  serviceItemId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  bookingDate: string;
  bookingTime: string;
  partySize?: number;
  employeeId?: number;
  specialRequests?: string;
  voucherCode?: string;
}

export interface ServiceBookingContactProof {
  requireContact?: boolean;
  customerPhone?: string;
  customerEmail?: string;
}

export const serviceBookingsApi = {
  async getAvailability(input: {
    serviceItemId: number;
    date: string;
  }): Promise<ServiceBookingAvailabilitySlot[]> {
    const response = await apiClient.get<{
      slots: ServiceBookingAvailabilitySlot[];
    }>("/service-bookings/availability", input);
    return response.slots;
  },

  async createBooking(
    input: CreateServiceBookingInput,
  ): Promise<ServiceBooking> {
    const response = await apiClient.post<{ booking: ServiceBooking }>(
      "/service-bookings",
      input,
    );
    return response.booking;
  },

  async payWithCredits(input: {
    bookingId: string;
    creditCardPublicId: string;
    pin?: string;
  }): Promise<ServiceBooking> {
    const response = await apiClient.post<{ booking: ServiceBooking }>(
      `/service-bookings/${input.bookingId}/pay`,
      {
        creditCardPublicId: input.creditCardPublicId,
        pin: input.pin,
      },
    );
    return response.booking;
  },

  async verify(
    code: string,
    contactProof?: ServiceBookingContactProof,
  ): Promise<ServiceBooking> {
    const response = await apiClient.get<{ booking: ServiceBooking }>(
      `/service-bookings/verify/${encodeURIComponent(code)}`,
      contactProof,
    );
    return response.booking;
  },

  async cancelByCode(
    code: string,
    contactProof?: ServiceBookingContactProof,
  ): Promise<ServiceBooking> {
    const response = await apiClient.post<{ booking: ServiceBooking }>(
      `/service-bookings/verify/${encodeURIComponent(code)}/cancel`,
      contactProof,
    );
    return response.booking;
  },
};
