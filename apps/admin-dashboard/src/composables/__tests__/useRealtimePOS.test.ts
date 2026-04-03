/**
 * useRealtimePOS Composable Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockSubscribe = vi.hoisted(() => vi.fn(() => "sub_pos_123"));
const mockUnsubscribe = vi.hoisted(() => vi.fn());
const mockConnect = vi.hoisted(() => vi.fn());
const mockConnectionStatus = vi.hoisted(() => ({ value: "connected" }));

vi.mock("@/services/realtimeService", () => ({
  useRealtime: () => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    connect: mockConnect,
    connectionStatus: mockConnectionStatus,
  }),
  REALTIME_EVENTS: {
    POS_TRANSACTION: "pos_transaction",
    CASH_MOVEMENT: "cash_movement",
    SHIFT_STARTED: "shift_started",
    SHIFT_ENDED: "shift_ended",
    REGISTER_STATUS_CHANGED: "register_status_changed",
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, restaurantId: "r1" },
  }),
}));

// Mock lifecycle hooks
vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    onMounted: vi.fn((fn: any) => fn()),
    onUnmounted: vi.fn(),
  };
});

import { useRealtimePOS } from "../useRealtimePOS";

describe("useRealtimePOS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus.value = "connected";
  });

  it("should return expected reactive state", () => {
    const result = useRealtimePOS();

    expect(result.isConnected).toBeDefined();
    expect(result.transactions).toBeDefined();
    expect(result.cashMovements).toBeDefined();
    expect(result.shiftEvents).toBeDefined();
    expect(result.registerStatuses).toBeDefined();
    expect(result.posStats).toBeDefined();
  });

  it("should subscribe to 4 event groups on mount", () => {
    useRealtimePOS();

    // Should subscribe: transactions, cash movements, shifts, register status
    expect(mockSubscribe).toHaveBeenCalledTimes(4);

    // POS transactions
    expect(mockSubscribe).toHaveBeenCalledWith(
      ["pos_transaction"],
      expect.any(Function),
      "r1",
    );

    // Cash movements
    expect(mockSubscribe).toHaveBeenCalledWith(
      ["cash_movement"],
      expect.any(Function),
      "r1",
    );

    // Shift events
    expect(mockSubscribe).toHaveBeenCalledWith(
      ["shift_started", "shift_ended"],
      expect.any(Function),
      "r1",
    );

    // Register status
    expect(mockSubscribe).toHaveBeenCalledWith(
      ["register_status_changed"],
      expect.any(Function),
      "r1",
    );
  });

  describe("stopListening", () => {
    it("should unsubscribe all 4 subscriptions", () => {
      const { stopListening } = useRealtimePOS();

      stopListening();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(4);
    });
  });

  describe("clearUpdates", () => {
    it("should clear all data arrays", () => {
      const { clearUpdates, transactions, cashMovements, shiftEvents, registerStatuses } =
        useRealtimePOS();

      transactions.value.push({
        transactionId: "t1",
        registerId: "r1",
        type: "sale",
        amount: 100,
        description: "Test",
        operatorId: 1,
        timestamp: new Date().toISOString(),
      });

      clearUpdates();

      expect(transactions.value).toEqual([]);
      expect(cashMovements.value).toEqual([]);
      expect(shiftEvents.value).toEqual([]);
      expect(registerStatuses.value.size).toBe(0);
    });
  });

  describe("resetStats", () => {
    it("should reset all POS stats to zero", () => {
      const { resetStats, posStats } = useRealtimePOS();

      posStats.value.todayTransactions = 10;
      posStats.value.todayRevenue = 5000;
      posStats.value.activeRegisters = 2;

      resetStats();

      expect(posStats.value.todayTransactions).toBe(0);
      expect(posStats.value.todayRevenue).toBe(0);
      expect(posStats.value.activeRegisters).toBe(0);
      expect(posStats.value.currentShifts).toBe(0);
      expect(posStats.value.lastTransactionTime).toBeNull();
    });
  });

  describe("getRecentTransactions", () => {
    it("should return limited number of transactions", () => {
      const { getRecentTransactions, transactions } = useRealtimePOS();

      for (let i = 0; i < 25; i++) {
        transactions.value.push({
          transactionId: `t${i}`,
          registerId: "r1",
          type: "sale",
          amount: 100,
          description: `TX ${i}`,
          operatorId: 1,
          timestamp: new Date().toISOString(),
        });
      }

      expect(getRecentTransactions(5)).toHaveLength(5);
      expect(getRecentTransactions()).toHaveLength(20); // default limit
    });
  });

  describe("getTransactionsByRegister", () => {
    it("should filter transactions by register id", () => {
      const { getTransactionsByRegister, transactions } = useRealtimePOS();

      transactions.value.push(
        {
          transactionId: "t1",
          registerId: "r1",
          type: "sale",
          amount: 100,
          description: "",
          operatorId: 1,
          timestamp: new Date().toISOString(),
        },
        {
          transactionId: "t2",
          registerId: "r2",
          type: "sale",
          amount: 200,
          description: "",
          operatorId: 1,
          timestamp: new Date().toISOString(),
        },
      );

      const result = getTransactionsByRegister("r1");
      expect(result).toHaveLength(1);
      expect(result[0].transactionId).toBe("t1");
    });
  });

  describe("getTransactionsByType", () => {
    it("should filter transactions by type", () => {
      const { getTransactionsByType, transactions } = useRealtimePOS();

      transactions.value.push(
        {
          transactionId: "t1",
          registerId: "r1",
          type: "sale",
          amount: 100,
          description: "",
          operatorId: 1,
          timestamp: new Date().toISOString(),
        },
        {
          transactionId: "t2",
          registerId: "r1",
          type: "refund",
          amount: -50,
          description: "",
          operatorId: 1,
          timestamp: new Date().toISOString(),
        },
      );

      const sales = getTransactionsByType("sale");
      expect(sales).toHaveLength(1);

      const refunds = getTransactionsByType("refund");
      expect(refunds).toHaveLength(1);
    });
  });

  describe("getRegisterStatus / getAllRegisterStatuses", () => {
    it("should return register status by id", () => {
      const { getRegisterStatus, registerStatuses } = useRealtimePOS();

      registerStatuses.value.set("r1", {
        registerId: "r1",
        status: "active",
        currentBalance: 1000,
        lastActivity: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });

      const status = getRegisterStatus("r1");
      expect(status).toBeDefined();
      expect(status!.status).toBe("active");

      expect(getRegisterStatus("r999")).toBeUndefined();
    });

    it("should return all register statuses as array", () => {
      const { getAllRegisterStatuses, registerStatuses } = useRealtimePOS();

      registerStatuses.value.set("r1", {
        registerId: "r1",
        status: "active",
        currentBalance: 1000,
        lastActivity: "",
        timestamp: "",
      });
      registerStatuses.value.set("r2", {
        registerId: "r2",
        status: "inactive",
        currentBalance: 0,
        lastActivity: "",
        timestamp: "",
      });

      const all = getAllRegisterStatuses();
      expect(all).toHaveLength(2);
    });
  });

  describe("getTodaySalesTotal / getTodayRefundsTotal", () => {
    it("should calculate today sales total", () => {
      const { getTodaySalesTotal, transactions } = useRealtimePOS();

      const now = new Date().toISOString();
      transactions.value.push(
        { transactionId: "t1", registerId: "r1", type: "sale", amount: 100, description: "", operatorId: 1, timestamp: now },
        { transactionId: "t2", registerId: "r1", type: "sale", amount: 200, description: "", operatorId: 1, timestamp: now },
        { transactionId: "t3", registerId: "r1", type: "refund", amount: -50, description: "", operatorId: 1, timestamp: now },
      );

      expect(getTodaySalesTotal()).toBe(300);
    });

    it("should calculate today refunds total", () => {
      const { getTodayRefundsTotal, transactions } = useRealtimePOS();

      const now = new Date().toISOString();
      transactions.value.push(
        { transactionId: "t1", registerId: "r1", type: "refund", amount: -50, description: "", operatorId: 1, timestamp: now },
        { transactionId: "t2", registerId: "r1", type: "refund", amount: -30, description: "", operatorId: 1, timestamp: now },
      );

      expect(getTodayRefundsTotal()).toBe(80);
    });
  });
});
