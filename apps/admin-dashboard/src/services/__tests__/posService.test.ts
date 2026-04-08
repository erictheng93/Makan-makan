/**
 * POS Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "@/services/api";
import { posService } from "../posService";

describe("posService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Registers", () => {
    it("should get all registers", async () => {
      const registers = [{ id: "r1", name: "Register 1" }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: registers },
      });

      const result = await posService.getRegisters();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/pos/registers");
      expect(result).toEqual(registers);
    });

    it("should create a register", async () => {
      const register = { id: "r1", name: "New Register" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: register },
      });

      const data = {
        name: "New Register",
        status: "active" as const,
        currentBalance: 0,
        location: "Front",
      };
      const result = await posService.createRegister(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/registers",
        data,
      );
      expect(result).toEqual(register);
    });

    it("should update a register", async () => {
      const updated = { id: "r1", name: "Updated" };
      vi.mocked(apiClient.put).mockResolvedValue({
        data: { data: updated },
      });

      const result = await posService.updateRegister("r1", {
        name: "Updated",
      });

      expect(apiClient.put).toHaveBeenCalledWith("/api/v1/pos/registers/r1", {
        name: "Updated",
      });
      expect(result).toEqual(updated);
    });

    it("should activate a register", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

      await posService.activateRegister("r1");

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/registers/r1/activate",
      );
    });

    it("should deactivate a register", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

      await posService.deactivateRegister("r1");

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/registers/r1/deactivate",
      );
    });
  });

  describe("Shifts", () => {
    it("should start a shift", async () => {
      const shift = { id: "s1", status: "active" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: shift },
      });

      const data = { registerId: "r1", startingCash: 500, operatorId: 1 };
      const result = await posService.startShift(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/shifts/start",
        data,
      );
      expect(result).toEqual(shift);
    });

    it("should end a shift", async () => {
      const shift = { id: "s1", status: "ended" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: shift },
      });

      const result = await posService.endShift("s1", { endingCash: 1500 });

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/pos/shifts/s1/end", {
        endingCash: 1500,
      });
      expect(result).toEqual(shift);
    });

    it("should get current shift", async () => {
      const shift = { id: "s1", status: "active" };
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: shift },
      });

      const result = await posService.getCurrentShift("r1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/pos/registers/r1/current-shift",
      );
      expect(result).toEqual(shift);
    });

    it("should return null when no current shift", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Not found"));

      const result = await posService.getCurrentShift("r1");

      expect(result).toBeNull();
    });

    it("should get shift report", async () => {
      const report = { shift: {}, sales: 5000, orders: 20 };
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: report },
      });

      const result = await posService.getShiftReport("s1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/pos/shifts/s1/report",
      );
      expect(result).toEqual(report);
    });
  });

  describe("Cash Movements", () => {
    it("should create a cash movement", async () => {
      const movement = { id: "m1", type: "cash_in", amount: 100 };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: movement },
      });

      const data = {
        registerId: "r1",
        type: "cash_in" as const,
        amount: 100,
        description: "Opening float",
        operatorId: 1,
      };
      const result = await posService.createCashMovement(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/cash-movements",
        data,
      );
      expect(result).toEqual(movement);
    });

    it("should get cash movements for register", async () => {
      const movements = [{ id: "m1" }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: movements },
      });

      const result = await posService.getCashMovements("r1", {
        type: "cash_in",
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/pos/registers/r1/cash-movements",
        { params: { type: "cash_in" } },
      );
      expect(result).toEqual(movements);
    });
  });

  describe("Receipts", () => {
    it("should print a receipt", async () => {
      const receipt = { id: "rc1", receiptNumber: "R001" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: receipt },
      });

      const data = {
        orderId: "o1",
        registerId: "r1",
        items: [],
        totalAmount: 100,
        paymentMethod: "cash",
      };
      const result = await posService.printReceipt(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/receipts/print",
        data,
      );
      expect(result).toEqual(receipt);
    });

    it("should get receipts for register", async () => {
      const receipts = [{ id: "rc1" }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: receipts },
      });

      const result = await posService.getReceipts("r1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/pos/registers/r1/receipts",
        { params: undefined },
      );
      expect(result).toEqual(receipts);
    });
  });

  describe("Refunds", () => {
    it("should process a refund", async () => {
      const refund = { id: "ref1", status: "approved" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: refund },
      });

      const data = {
        orderId: "o1",
        registerId: "r1",
        amount: 50,
        reason: "Wrong item",
        operatorId: 1,
      };
      const result = await posService.processRefund(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/refunds/create",
        data,
      );
      expect(result).toEqual(refund);
    });
  });

  describe("Promotions", () => {
    it("should get promotions", async () => {
      const promos = [{ id: "p1", title: "10% Off" }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: promos },
      });

      const result = await posService.getPromotions();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/pos/promotions");
      expect(result).toEqual(promos);
    });

    it("should create a promotion", async () => {
      const promo = { id: "p1", title: "New Promo" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: promo },
      });

      const data = {
        title: "New Promo",
        description: "Test",
        discountType: "percentage" as const,
        discountValue: 10,
        isActive: true,
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      };
      const result = await posService.createPromotion(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/promotions",
        data,
      );
      expect(result).toEqual(promo);
    });

    it("should delete a promotion", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      await posService.deletePromotion("p1");

      expect(apiClient.delete).toHaveBeenCalledWith(
        "/api/v1/pos/promotions/p1",
      );
    });
  });

  describe("Statistics", () => {
    it("should get daily stats", async () => {
      const stats = { totalSales: 5000, totalOrders: 20 };
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: stats },
      });

      const result = await posService.getDailyStats("r1", "2026-04-03");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/pos/registers/r1/stats/daily",
        { params: { date: "2026-04-03" } },
      );
      expect(result).toEqual(stats);
    });
  });

  describe("Quick Payment", () => {
    it("should process quick payment", async () => {
      const payment = { id: "pay1", status: "completed" };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: payment },
      });

      const data = {
        orderId: "o1",
        registerId: "r1",
        amount: 100,
        paymentMethod: "cash",
        operatorId: 1,
      };
      const result = await posService.processQuickPayment(data);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/pos/quick-payment",
        data,
      );
      expect(result).toEqual(payment);
    });
  });
});
