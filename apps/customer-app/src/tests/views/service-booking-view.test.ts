import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServiceBookingView from "@/views/ServiceBookingView.vue";
import { restaurantContactApi } from "@/services/restaurantContactApi";
import { serviceBookingsApi } from "@/services/serviceBookingsApi";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@/services/restaurantContactApi", () => ({
  restaurantContactApi: {
    listServiceItems: vi.fn(),
  },
}));

vi.mock("@/services/serviceBookingsApi", () => ({
  serviceBookingsApi: {
    getAvailability: vi.fn(),
    createBooking: vi.fn(),
    payWithCredits: vi.fn(),
    verify: vi.fn(),
    cancelByCode: vi.fn(),
  },
}));

const serviceItem = {
  id: 10,
  restaurantId: "restaurant-1",
  name: "彩繪體驗",
  description: "夜市手作活動",
  serviceType: "activity" as const,
  priceCents: 12000,
  durationMinutes: 60,
  requiresBooking: true,
  sortOrder: 0,
  isActive: true,
  isPublic: true,
  createdAt: "",
  updatedAt: "",
};

const pendingBooking = {
  id: "booking-1",
  restaurantId: "restaurant-1",
  serviceItemId: 10,
  serviceNameSnapshot: "彩繪體驗",
  priceCentsSnapshot: 12000,
  customerName: "王小明",
  customerPhone: "0911222333",
  bookingDate: "2026-06-10",
  bookingTime: "10:00",
  partySize: 2,
  status: "pending" as const,
  confirmationCode: "ABC123",
  voucherDiscountCents: 0,
  amountDueCents: 12000,
  amountPaidCents: 0,
  paymentStatus: "unpaid" as const,
  paymentMethod: "none" as const,
};

function mountView() {
  return mount(ServiceBookingView, {
    props: {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
    },
  });
}

describe("ServiceBookingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerPush.mockReset();
    vi.mocked(restaurantContactApi.listServiceItems).mockResolvedValue([
      serviceItem,
    ]);
    vi.mocked(serviceBookingsApi.getAvailability).mockResolvedValue([
      { timeSlot: "10:00", remaining: 2, isAvailable: true },
      { timeSlot: "11:00", remaining: 0, isAvailable: false },
    ]);
    vi.mocked(serviceBookingsApi.createBooking).mockResolvedValue(
      pendingBooking,
    );
    vi.mocked(serviceBookingsApi.payWithCredits).mockResolvedValue({
      ...pendingBooking,
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "credits",
      amountPaidCents: 12000,
    });
    vi.mocked(serviceBookingsApi.verify).mockResolvedValue({
      ...pendingBooking,
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "credits",
    });
    vi.mocked(serviceBookingsApi.cancelByCode).mockResolvedValue({
      ...pendingBooking,
      status: "cancelled",
    });
  });

  it("loads service details and availability slots", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(restaurantContactApi.listServiceItems).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(serviceBookingsApi.getAvailability).toHaveBeenCalledWith({
      serviceItemId: 10,
      date: expect.any(String),
    });
    expect(wrapper.text()).toContain("彩繪體驗");
    expect(
      wrapper.findAll('[data-testid="service-booking-slot"]'),
    ).toHaveLength(2);
  });

  it("creates, pays, verifies, and cancels a service booking", async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper
      .get('[data-testid="service-booking-name"]')
      .setValue("王小明");
    await wrapper
      .get('[data-testid="service-booking-phone"]')
      .setValue("0911222333");
    await wrapper
      .get('[data-testid="service-booking-email"]')
      .setValue("guest@example.test");
    await wrapper.get('[data-testid="service-booking-party-size"]').setValue(2);
    await wrapper
      .get('[data-testid="service-booking-create"]')
      .trigger("submit");
    await flushPromises();

    expect(serviceBookingsApi.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        serviceItemId: 10,
        customerName: "王小明",
        customerPhone: "0911222333",
        customerEmail: "guest@example.test",
        bookingTime: "10:00",
        partySize: 2,
      }),
    );
    expect(
      wrapper.get('[data-testid="service-booking-confirmation"]').text(),
    ).toContain("ABC123");

    await wrapper
      .get('[data-testid="service-booking-credit-id"]')
      .setValue("credit-public-1");
    await wrapper
      .get('[data-testid="service-booking-credit-pin"]')
      .setValue("1234");
    await wrapper.get('[data-testid="service-booking-pay"]').trigger("click");
    await flushPromises();

    expect(serviceBookingsApi.payWithCredits).toHaveBeenCalledWith({
      bookingId: "booking-1",
      creditCardPublicId: "credit-public-1",
      pin: "1234",
    });
    expect(wrapper.text()).toContain("代幣付款完成");

    await wrapper
      .get('[data-testid="service-booking-verify-code"]')
      .setValue("ABC123");
    await wrapper
      .get('[data-testid="service-booking-verify"]')
      .trigger("click");
    await flushPromises();

    expect(serviceBookingsApi.verify).toHaveBeenCalledWith("ABC123");
    expect(
      wrapper.get('[data-testid="service-booking-verified"]').text(),
    ).toContain("已確認");

    await wrapper
      .get('[data-testid="service-booking-cancel"]')
      .trigger("click");
    await flushPromises();

    expect(serviceBookingsApi.cancelByCode).toHaveBeenCalledWith("ABC123");
    expect(wrapper.text()).toContain("預約已取消");
  });
});
