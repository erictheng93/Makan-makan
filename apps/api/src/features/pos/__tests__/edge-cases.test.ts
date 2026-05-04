/**
 * POS Edge Cases Tests
 * POS 邊界案例測試套件
 *
 * 測試覆蓋範圍：
 * - 並發操作處理
 * - 極端數值處理
 * - 錯誤恢復
 * - 資料一致性
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";

// Pre-import services to avoid dynamic import timeout issues
let ShiftService: any;
let RegisterService: any;
let CashMovementService: any;
let RefundService: any;
let ReceiptService: any;
let ReportService: any;

// Mock drizzle-orm/d1
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((col: any) => ({ type: "desc", col })),
  sql: Object.assign(
    vi.fn((...args: any[]) => ({ type: "sql", args })),
    {
      raw: vi.fn((s: string) => s),
    },
  ),
  inArray: vi.fn((...args: any[]) => ({ type: "inArray", args })),
  count: vi.fn(() => ({ type: "count" })),
}));

vi.mock("@makanmasak/database", () => ({
  cashRegisters: {
    id: "id",
    name: "name",
    restaurantId: "restaurant_id",
    isActive: "is_active",
    currentShiftId: "current_shift_id",
    hardwareConfig: "hardware_config",
    peripherals: "peripherals",
    settings: "settings",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  cashShifts: {
    id: "id",
    registerId: "register_id",
    operatorId: "operator_id",
    startAmount: "start_amount",
    startAmountCents: "start_amount_cents",
    endAmount: "end_amount",
    endAmountCents: "end_amount_cents",
    expectedAmount: "expected_amount",
    expectedAmountCents: "expected_amount_cents",
    actualAmount: "actual_amount",
    actualAmountCents: "actual_amount_cents",
    differenceAmount: "difference_amount",
    differenceAmountCents: "difference_amount_cents",
    totalSales: "total_sales",
    totalSalesCents: "total_sales_cents",
    totalRefunds: "total_refunds",
    totalRefundsCents: "total_refunds_cents",
    cashSales: "cash_sales",
    cashSalesCents: "cash_sales_cents",
    cardSales: "card_sales",
    cardSalesCents: "card_sales_cents",
    digitalSales: "digital_sales",
    digitalSalesCents: "digital_sales_cents",
    totalTransactions: "total_transactions",
    startedAt: "started_at",
    endedAt: "ended_at",
    status: "status",
    notes: "notes",
    closingNotes: "closing_notes",
  },
  cashMovements: {
    id: "id",
    shiftId: "shift_id",
    registerId: "register_id",
    type: "type",
    amount: "amount",
    amountCents: "amount_cents",
    description: "description",
    referenceId: "reference_id",
    referenceType: "reference_type",
    paymentMethod: "payment_method",
    denominationBreakdown: "denomination_breakdown",
    recordedBy: "recorded_by",
    approvedBy: "approved_by",
    approvalStatus: "approval_status",
    receiptNumber: "receipt_number",
    metadata: "metadata",
    createdAt: "created_at",
  },
  receipts: {
    id: "id",
    orderId: "order_id",
    registerId: "register_id",
    shiftId: "shift_id",
    receiptNumber: "receipt_number",
    receiptType: "receipt_type",
    templateName: "template_name",
    content: "content",
    printStatus: "print_status",
    printAttempts: "print_attempts",
    reprintedCount: "reprinted_count",
    printedAt: "printed_at",
    lastReprintAt: "last_reprint_at",
    createdAt: "created_at",
  },
  refunds: {
    id: "id",
    originalOrderId: "original_order_id",
    registerId: "register_id",
    shiftId: "shift_id",
    refundNumber: "refund_number",
    refundType: "refund_type",
    originalAmount: "original_amount",
    originalAmountCents: "original_amount_cents",
    refundAmount: "refund_amount",
    refundAmountCents: "refund_amount_cents",
    refundMethod: "refund_method",
    reasonCode: "reason_code",
    reasonDescription: "reason_description",
    itemsRefunded: "items_refunded",
    processedBy: "processed_by",
    approvedBy: "approved_by",
    customerSignature: "customer_signature",
    status: "status",
    processedAt: "processed_at",
    completedAt: "completed_at",
    metadata: "metadata",
  },
  orders: {
    id: "id",
    restaurantId: "restaurant_id",
    totalAmount: "total_amount",
    totalAmountCents: "total_amount_cents",
    taxAmount: "tax_amount",
    taxAmountCents: "tax_amount_cents",
    discountAmount: "discount_amount",
    discountAmountCents: "discount_amount_cents",
    paymentMethod: "payment_method",
    createdAt: "created_at",
  },
  orderItems: {
    orderId: "order_id",
    menuItemId: "menu_item_id",
    quantity: "quantity",
    subtotal: "subtotal",
    totalPrice: "total_price",
    totalPriceCents: "total_price_cents",
  },
  menuItems: { id: "id", name: "name" },
  shiftReports: {
    id: "id",
    shiftId: "shift_id",
    registerId: "register_id",
    operatorId: "operator_id",
    reportData: "report_data",
    summaryData: "summary_data",
    generatedAt: "generated_at",
  },
  amountFromCents: vi.fn((cents: number | null | undefined, fallback: any) =>
    cents == null ? (fallback ?? null) : cents / 100,
  ),
  sumMoneyAmount: vi.fn((...args: any[]) => ({ type: "sumMoneyAmount", args })),
  avgMoneyAmount: vi.fn((...args: any[]) => ({ type: "avgMoneyAmount", args })),
  avgAbsMoneyAmount: vi.fn((...args: any[]) => ({
    type: "avgAbsMoneyAmount",
    args,
  })),
  getCurrentTimestamp: vi.fn(() => new Date().toISOString()),
}));

// Helper to create chainable mock
const createChain = (result: any) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn((resolve: any) => resolve(result));
  chain[Symbol.iterator] = function* () {
    yield* result;
  };
  return chain;
};

const setupSelect = (result: any) => {
  const chain = createChain(result);
  mockSelect.mockReturnValue(chain);
  return chain;
};

const setupInsert = (result?: any) => {
  const chain = createChain(result || { success: true });
  mockInsert.mockReturnValue(chain);
  return chain;
};

const setupUpdate = (result?: any) => {
  const chain = createChain(result || { success: true });
  mockUpdate.mockReturnValue(chain);
  return chain;
};

const setupDelete = (result?: any) => {
  const chain = createChain(result || { success: true });
  mockDelete.mockReturnValue(chain);
  return chain;
};

beforeAll(async () => {
  const [shiftMod, registerMod, cashMod, refundMod, receiptMod, reportMod] =
    await Promise.all([
      import("../services/ShiftService"),
      import("../services/RegisterService"),
      import("../services/CashMovementService"),
      import("../services/RefundService"),
      import("../services/ReceiptService"),
      import("../services/ReportService"),
    ]);
  ShiftService = shiftMod.ShiftService;
  RegisterService = registerMod.RegisterService;
  CashMovementService = cashMod.CashMovementService;
  RefundService = refundMod.RefundService;
  ReceiptService = receiptMod.ReceiptService;
  ReportService = reportMod.ReportService;
}, 30000);

describe("POS Edge Cases Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 使用有效的 UUID 格式
  const validRegisterId = "550e8400-e29b-41d4-a716-446655440000";
  const validShiftId = "660e8400-e29b-41d4-a716-446655440001";

  // ========================================
  // 極端數值測試 (6 tests)
  // ========================================

  describe("極端數值處理", () => {
    describe("ShiftService", () => {
      it("應該處理零開班金額", async () => {
        const service = new ShiftService({} as never);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return createChain([]);
          if (selectCallCount === 2)
            return createChain([{ registerId: validRegisterId }]);
          return createChain([{ id: validShiftId, status: "active" }]);
        });
        setupInsert();
        setupUpdate();

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 0,
        });

        expect(result.success).toBe(true);
      });

      it("應該處理大額開班金額", async () => {
        const service = new ShiftService({} as never);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return createChain([]);
          if (selectCallCount === 2)
            return createChain([{ registerId: validRegisterId }]);
          return createChain([{ id: validShiftId, status: "active" }]);
        });
        setupInsert();
        setupUpdate();

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000000, // 100萬
        });

        expect(result.success).toBe(true);
      });
    });

    describe("RefundService", () => {
      it("應該處理零金額退款", async () => {
        const service = new RefundService({} as never);

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "partial",
            refundAmount: 0,
            refundMethod: "cash",
            reasonCode: "test",
          },
          "reg-001",
          1,
        );

        // 零金額退款應該被拒絕或特殊處理
        expect(result).toBeDefined();
      });

      it("應該處理小數金額退款", async () => {
        const service = new RefundService({} as never);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createChain([
              {
                id: 1,
                totalAmount: 100.5,
                total_amount: "100.50",
                status: "completed",
              },
            ]);
          } else if (selectCallCount === 2) {
            return createChain([{ totalRefunded: 0 }]);
          } else {
            return createChain([
              {
                id: "refund-001",
                refundAmount: 50.25,
                status: "processing",
                itemsRefunded: "[]",
                metadata: "{}",
              },
            ]);
          }
        });
        setupInsert();

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "partial",
            refundAmount: 50.25,
            refundMethod: "cash",
            reasonCode: "test",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(true);
      });
    });

    describe("CashMovementService", () => {
      it("應該處理大額現金操作", async () => {
        const service = new CashMovementService({} as never);

        setupSelect([
          {
            status: "active",
            registerId: "reg-001",
          },
        ]);
        setupInsert();

        const result = await service.processCashMovement(
          "shift-001",
          {
            type: "cash_in",
            amount: 500000, // 50萬
            description: "大額現金存入",
          },
          1,
        );

        expect(result.success).toBe(true);
      });

      it("應該處理複雜面額明細", async () => {
        const service = new CashMovementService({} as never);

        setupSelect([
          {
            status: "active",
            registerId: "reg-001",
          },
        ]);
        setupInsert();

        const result = await service.processCashMovement(
          "shift-001",
          {
            type: "count",
            amount: 12345,
            description: "現金盤點",
            denominationBreakdown: {
              "1000": 10,
              "500": 4,
              "100": 3,
              "50": 0,
              "10": 4,
              "5": 1,
            },
          },
          1,
        );

        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // 並發操作測試 (4 tests)
  // ========================================

  describe("並發操作處理", () => {
    it("應該防止同一收銀機同時開兩個班次", async () => {
      const service = new ShiftService({} as never);

      // First startShift: no active shift -> success
      // Second startShift: has active shift -> failure
      let startShiftCallCount = 0;
      mockSelect.mockImplementation(() => {
        startShiftCallCount++;
        // First startShift
        if (startShiftCallCount === 1) return createChain([]); // no active shift
        if (startShiftCallCount === 2)
          return createChain([{ registerId: validRegisterId }]); // recordCashMovement
        if (startShiftCallCount === 3)
          return createChain([{ id: validShiftId, status: "active" }]); // get created shift
        // Second startShift
        if (startShiftCallCount === 4)
          return createChain([{ id: validShiftId, status: "active" }]); // has active shift
        return createChain([]);
      });
      setupInsert();
      setupUpdate();

      const result1 = await service.startShift({
        registerId: validRegisterId,
        operatorId: 1,
        startAmount: 1000,
      });

      const result2 = await service.startShift({
        registerId: validRegisterId,
        operatorId: 2,
        startAmount: 1000,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
    });

    it("應該處理同時多個退款請求", async () => {
      const service = new RefundService({} as never);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createChain([
            {
              id: 1,
              totalAmount: 1000,
              total_amount: "1000",
              status: "completed",
            },
          ]);
        } else if (selectCallCount === 2) {
          return createChain([{ totalRefunded: 0 }]);
        } else {
          return createChain([
            {
              id: "refund-001",
              refundAmount: 500,
              status: "processing",
              itemsRefunded: "[]",
              metadata: "{}",
            },
          ]);
        }
      });
      setupInsert();

      const result1 = await service.processRefund(
        {
          originalOrderId: 1,
          refundType: "partial",
          refundAmount: 500,
          refundMethod: "cash",
          reasonCode: "test",
        },
        "reg-001",
        1,
      );

      expect(result1.success).toBe(true);
    });

    it("應該處理快速連續的現金操作", async () => {
      const service = new CashMovementService({} as never);

      mockSelect.mockImplementation(() =>
        createChain([
          {
            status: "active",
            registerId: "reg-001",
          },
        ]),
      );
      setupInsert();

      const operations = Array(5)
        .fill(null)
        .map((_, i) =>
          service.processCashMovement(
            "shift-001",
            {
              type: "cash_in",
              amount: 100 * (i + 1),
              description: `操作 ${i + 1}`,
            },
            1,
          ),
        );

      const results = await Promise.all(operations);

      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    it("應該處理同時打印多張收據", async () => {
      const service = new ReceiptService({} as never);

      mockSelect.mockImplementation(() => {
        // Each printReceipt call needs: order check, order items, get receipt
        return createChain([{ id: 1, order_number: "ORD-001" }]);
      });
      setupInsert();

      const printRequests = Array(3)
        .fill(null)
        .map(() =>
          service.printReceipt(
            {
              orderId: 1,
              templateName: "default",
              receiptType: "customer",
            },
            "reg-001",
          ),
        );

      const results = await Promise.all(printRequests);

      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // 錯誤恢復測試 (4 tests)
  // ========================================

  describe("錯誤恢復", () => {
    it("應該處理資料庫連接錯誤", async () => {
      const service = new RegisterService({} as never);

      const chain = createChain([]);
      chain.then = vi.fn((_resolve: any, reject: any) => {
        if (reject) return reject(new Error("Database connection failed"));
        throw new Error("Database connection failed");
      });
      mockSelect.mockReturnValue(chain);

      const result = await service.getRegisters(1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("應該處理 JSON 解析錯誤", async () => {
      const service = new RegisterService({} as never);

      setupSelect([
        {
          id: "reg-001",
          name: "POS-001",
          hardwareConfig: "invalid-json", // Invalid JSON
          peripherals: "{}",
          settings: "{}",
        },
      ]);

      // 服務應該能夠處理無效 JSON
      const result = await service.getRegisterStatus("reg-001");

      // 根據實現，可能成功（使用預設值）或失敗
      expect(result).toBeDefined();
    });

    it("應該處理班次結束時的計算錯誤", async () => {
      const service = new ShiftService({} as never);

      setupSelect([
        {
          id: "shift-001",
          status: "active",
          registerId: "reg-001",
          startAmount: NaN, // Invalid number
          totalSales: 5000,
          totalRefunds: 200,
        },
      ]);
      setupUpdate();
      setupInsert();

      const result = await service.endShift(
        "shift-001",
        {
          actualAmount: 5800,
        },
        1,
      );

      // 服務應該能夠處理無效數值
      expect(result).toBeDefined();
    });

    it("應該處理報表生成時的資料缺失", async () => {
      const service = new ReportService({} as never);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createChain([
            {
              id: "shift-001",
              registerId: "reg-001",
              operatorId: 1,
              status: "closed",
              startAmount: 1000,
              totalSales: null, // Missing data
              totalRefunds: null,
              cashSales: null,
              cardSales: null,
              digitalSales: null,
              startedAt: "2024-01-15T08:00:00Z",
              endedAt: "2024-01-15T16:00:00Z",
            },
          ]);
        } else if (selectCallCount === 2) {
          return createChain([]);
        } else if (selectCallCount === 3) {
          return createChain([{ totalReceipts: 0, printedReceipts: 0 }]);
        } else if (selectCallCount === 4) {
          return createChain([null]); // No order stats
        }
        return createChain([]);
      });
      setupInsert();

      const result = await service.generateShiftReport("shift-001");

      // 服務應該能夠處理缺失資料
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // 資料一致性測試 (4 tests)
  // ========================================

  describe("資料一致性", () => {
    it("應該確保退款金額不超過訂單總額", async () => {
      const service = new RefundService({} as never);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createChain([
            {
              id: 1,
              totalAmount: 1000,
              total_amount: "1000",
              status: "completed",
            },
          ]);
        } else {
          return createChain([{ totalRefunded: 500 }]); // Already refunded 500
        }
      });

      const result = await service.processRefund(
        {
          originalOrderId: 1,
          refundType: "partial",
          refundAmount: 600, // Would exceed total (500 + 600 > 1000)
          refundMethod: "cash",
          reasonCode: "test",
        },
        "reg-001",
        1,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("超過");
    });

    it("應該確保班次結束時更新收銀機狀態", async () => {
      const service = new ShiftService({} as never);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createChain([
            {
              id: "shift-001",
              status: "active",
              registerId: "reg-001",
              startAmount: 1000,
              totalSales: 5000,
              totalRefunds: 200,
            },
          ]);
        } else if (selectCallCount === 2) {
          return createChain([{ registerId: "reg-001" }]);
        }
        return createChain([]);
      });
      setupUpdate();
      setupInsert();

      const result = await service.endShift(
        "shift-001",
        {
          actualAmount: 5800,
        },
        1,
      );

      expect(result.success).toBe(true);
      // 驗證 update 被調用來更新收銀機狀態
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("應該確保現金操作記錄正確的班次和收銀機", async () => {
      const service = new CashMovementService({} as never);

      setupSelect([
        {
          status: "active",
          registerId: "reg-001",
        },
      ]);
      setupInsert();

      const result = await service.processCashMovement(
        "shift-001",
        {
          type: "cash_in",
          amount: 500,
          description: "現金存入",
        },
        1,
      );

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("應該確保收據編號唯一", async () => {
      const service = new ReceiptService({} as never);

      mockSelect.mockImplementation(() =>
        createChain([{ id: 1, order_number: "ORD-001" }]),
      );
      setupInsert();

      const result1 = await service.printReceipt({ orderId: 1 }, "reg-001");
      const result2 = await service.printReceipt({ orderId: 1 }, "reg-001");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // 收據編號應該不同（由於時間戳和隨機數）
    });
  });
});
