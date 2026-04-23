/**
 * POS Services Unit Tests
 * POS 服務單元測試套件
 *
 * 測試覆蓋範圍：
 * - RegisterService (收銀機管理)
 * - ShiftService (班次管理)
 * - CashMovementService (現金操作)
 * - ReceiptService (收據管理)
 * - RefundService (退款管理)
 * - ReportService (報表統計)
 *
 * 預估測試案例：60-80 個
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
let RegisterService: any;
let ShiftService: any;
let CashMovementService: any;
let ReceiptService: any;
let RefundService: any;
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

vi.mock("@makanmakan/database", () => ({
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
    endAmount: "end_amount",
    expectedAmount: "expected_amount",
    actualAmount: "actual_amount",
    differenceAmount: "difference_amount",
    totalSales: "total_sales",
    totalRefunds: "total_refunds",
    cashSales: "cash_sales",
    cardSales: "card_sales",
    digitalSales: "digital_sales",
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
    refundAmount: "refund_amount",
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
    taxAmount: "tax_amount",
    discountAmount: "discount_amount",
    paymentMethod: "payment_method",
    createdAt: "created_at",
  },
  orderItems: {
    orderId: "order_id",
    menuItemId: "menu_item_id",
    quantity: "quantity",
    subtotal: "subtotal",
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
  // Make the chain thenable (for await)
  chain[Symbol.iterator] = function* () {
    yield* result;
  };
  return chain;
};

// Setup select to return chainable mock
const setupSelect = (result: any) => {
  const chain = createChain(result);
  mockSelect.mockReturnValue(chain);
  return chain;
};

// Setup insert to return chainable mock
const setupInsert = (result?: any) => {
  const chain = createChain(result || { success: true });
  mockInsert.mockReturnValue(chain);
  return chain;
};

// Setup update to return chainable mock
const setupUpdate = (result?: any) => {
  const chain = createChain(result || { success: true });
  mockUpdate.mockReturnValue(chain);
  return chain;
};

// Setup delete to return chainable mock
const setupDelete = (result?: any) => {
  const chain = createChain(result || { success: true });
  mockDelete.mockReturnValue(chain);
  return chain;
};

beforeAll(async () => {
  const [registerMod, shiftMod, cashMod, receiptMod, refundMod, reportMod] =
    await Promise.all([
      import("../services/RegisterService"),
      import("../services/ShiftService"),
      import("../services/CashMovementService"),
      import("../services/ReceiptService"),
      import("../services/RefundService"),
      import("../services/ReportService"),
    ]);
  RegisterService = registerMod.RegisterService;
  ShiftService = shiftMod.ShiftService;
  CashMovementService = cashMod.CashMovementService;
  ReceiptService = receiptMod.ReceiptService;
  RefundService = refundMod.RefundService;
  ReportService = reportMod.ReportService;
}, 30000);

describe("POS Services Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // RegisterService Tests (12 tests)
  // ========================================

  describe("RegisterService", () => {
    describe("createRegister", () => {
      it("應該成功創建收銀機", async () => {
        const service = new RegisterService({} as any);

        // insert().values()
        setupInsert();
        // select().from().where().limit() -> returns register
        setupSelect([
          {
            id: "reg-001",
            name: "POS-001",
            isActive: true,
            hardwareConfig: "{}",
            peripherals: "{}",
            settings: "{}",
          },
        ]);

        const result = await service.createRegister(
          {
            name: "POS-001",
            restaurantId: "rest-001",
            location: "一樓大廳",
          },
          1,
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("應該拒絕無效的收銀機名稱", async () => {
        const service = new RegisterService({} as any);

        const result = await service.createRegister(
          {
            name: "",
            restaurantId: "rest-001",
          },
          1,
        );

        expect(result.success).toBe(false);
      });
    });

    describe("getRegisters", () => {
      it("應該返回餐廳的收銀機列表", async () => {
        const service = new RegisterService({} as any);

        setupSelect([
          {
            id: "reg-001",
            name: "POS-001",
            isActive: true,
            hardwareConfig: "{}",
            peripherals: "{}",
            settings: "{}",
          },
          {
            id: "reg-002",
            name: "POS-002",
            isActive: true,
            hardwareConfig: "{}",
            peripherals: "{}",
            settings: "{}",
          },
        ]);

        const result = await service.getRegisters(1);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });

      it("應該處理空結果", async () => {
        const service = new RegisterService({} as any);

        setupSelect([]);

        const result = await service.getRegisters(1);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(0);
      });

      it("應該處理資料庫錯誤", async () => {
        const service = new RegisterService({} as any);

        const chain = createChain([]);
        chain.then = vi.fn((_resolve: any, reject: any) => {
          if (reject) return reject(new Error("Database error"));
          throw new Error("Database error");
        });
        mockSelect.mockReturnValue(chain);

        const result = await service.getRegisters(1);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("getRegisterStatus", () => {
      it("應該返回收銀機狀態", async () => {
        const service = new RegisterService({} as any);

        setupSelect([
          {
            id: "reg-001",
            name: "POS-001",
            isActive: true,
            hardwareConfig: "{}",
            peripherals: "{}",
            settings: "{}",
          },
        ]);

        const result = await service.getRegisterStatus("reg-001");

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("應該處理不存在的收銀機", async () => {
        const service = new RegisterService({} as any);

        setupSelect([]);

        const result = await service.getRegisterStatus("non-existent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("不存在");
      });
    });

    describe("updateRegister", () => {
      it("應該成功更新收銀機設定", async () => {
        const service = new RegisterService({} as any);

        setupUpdate();
        setupSelect([
          {
            id: "reg-001",
            name: "POS-001-Updated",
            hardwareConfig: "{}",
            peripherals: "{}",
            settings: "{}",
          },
        ]);

        const result = await service.updateRegister("reg-001", {
          name: "POS-001-Updated",
        });

        expect(result.success).toBe(true);
      });

      it("應該拒絕空更新", async () => {
        const service = new RegisterService({} as any);

        const result = await service.updateRegister("reg-001", {});

        expect(result.success).toBe(false);
        expect(result.error).toContain("沒有需要更新");
      });
    });

    describe("toggleRegisterStatus", () => {
      it("應該成功啟用收銀機", async () => {
        const service = new RegisterService({} as any);

        setupUpdate();

        const result = await service.toggleRegisterStatus("reg-001", true);

        expect(result.success).toBe(true);
      });

      it("應該成功停用收銀機", async () => {
        const service = new RegisterService({} as any);

        setupUpdate();

        const result = await service.toggleRegisterStatus("reg-001", false);

        expect(result.success).toBe(true);
      });
    });

    describe("deleteRegister", () => {
      it("應該成功刪除無活躍班次的收銀機", async () => {
        const service = new RegisterService({} as any);

        setupSelect([]); // No active shift
        setupDelete();

        const result = await service.deleteRegister("reg-001");

        expect(result.success).toBe(true);
      });

      it("應該拒絕刪除有活躍班次的收銀機", async () => {
        const service = new RegisterService({} as any);

        setupSelect([{ id: "shift-001" }]); // Has active shift

        const result = await service.deleteRegister("reg-001");

        expect(result.success).toBe(false);
        expect(result.error).toContain("活躍班次");
      });
    });
  });

  // ========================================
  // ShiftService Tests (14 tests)
  // ========================================

  describe("ShiftService", () => {
    // 使用有效的 UUID 格式
    const validRegisterId = "550e8400-e29b-41d4-a716-446655440000";

    describe("startShift", () => {
      it("應該成功開始新班次", async () => {
        const service = new ShiftService({} as any);

        // First call: check existing shift (select returns empty)
        // Second call: insert shift
        // Third call: update register
        // Fourth call: recordCashMovement select shift registerId
        // Fifth call: recordCashMovement insert
        // Sixth call: select created shift
        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Check existing active shift - none found
            return createChain([]);
          } else if (selectCallCount === 2) {
            // recordCashMovement: get shift's registerId
            return createChain([{ registerId: validRegisterId }]);
          } else {
            // Final select to get created shift
            return createChain([{ id: "shift-001", status: "active" }]);
          }
        });
        setupInsert();
        setupUpdate();

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000,
        });

        expect(result.success).toBe(true);
      });

      it("應該拒絕在已有活動班次時開班", async () => {
        const service = new ShiftService({} as any);

        setupSelect([{ id: "existing-shift", status: "active" }]);

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("已有活躍班次");
      });

      it("應該拒絕負數開班金額", async () => {
        const service = new ShiftService({} as any);

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: -100,
        });

        expect(result.success).toBe(false);
      });

      it("應該支援開班備註", async () => {
        const service = new ShiftService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createChain([]);
          } else if (selectCallCount === 2) {
            return createChain([{ registerId: validRegisterId }]);
          } else {
            return createChain([
              { id: "shift-001", status: "active", notes: "早班" },
            ]);
          }
        });
        setupInsert();
        setupUpdate();

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000,
          notes: "早班",
        });

        expect(result.success).toBe(true);
      });
    });

    describe("endShift", () => {
      it("應該成功結束班次", async () => {
        const service = new ShiftService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Get shift
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
            // recordCashMovement: get registerId
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
        expect(result.data?.shift).toBeDefined();
      });

      it("應該拒絕結束不存在的班次", async () => {
        const service = new ShiftService({} as any);

        setupSelect([]);

        const result = await service.endShift(
          "shift-001",
          {
            actualAmount: 5000,
          },
          1,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("找不到");
      });

      it("應該計算現金差額", async () => {
        const service = new ShiftService({} as any);

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
            actualAmount: 5700, // Expected: 1000 + 5000 - 200 = 5800
          },
          1,
        );

        expect(result.success).toBe(true);
        expect(result.data?.shift.differenceAmount).toBe(-100);
      });

      it("應該支援結班備註", async () => {
        const service = new ShiftService({} as any);

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
            closingNotes: "一切正常",
          },
          1,
        );

        expect(result.success).toBe(true);
      });
    });

    describe("getCurrentShift", () => {
      it("應該返回當前活動班次", async () => {
        const service = new ShiftService({} as any);

        setupSelect([
          {
            id: "shift-001",
            status: "active",
            startAmount: 1000,
          },
        ]);

        const result = await service.getCurrentShift("reg-001");

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("應該返回 null 當沒有活動班次", async () => {
        const service = new ShiftService({} as any);

        setupSelect([]);

        const result = await service.getCurrentShift("reg-001");

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });
    });

    describe("suspendShift", () => {
      it("應該成功暫停班次", async () => {
        const service = new ShiftService({} as any);

        setupUpdate();

        const result = await service.suspendShift("shift-001", "午休");

        expect(result.success).toBe(true);
      });

      it("應該支援無原因暫停", async () => {
        const service = new ShiftService({} as any);

        setupUpdate();

        const result = await service.suspendShift("shift-001");

        expect(result.success).toBe(true);
      });
    });

    describe("resumeShift", () => {
      it("應該成功恢復班次", async () => {
        const service = new ShiftService({} as any);

        setupUpdate();

        const result = await service.resumeShift("shift-001");

        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // CashMovementService Tests (10 tests)
  // ========================================

  describe("CashMovementService", () => {
    describe("processCashMovement", () => {
      it("應該成功記錄現金存入", async () => {
        const service = new CashMovementService({} as any);

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
      });

      it("應該成功記錄現金取出", async () => {
        const service = new CashMovementService({} as any);

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
            type: "cash_out",
            amount: 200,
            description: "找零補充",
          },
          1,
        );

        expect(result.success).toBe(true);
      });

      it("應該拒絕在非活動班次記錄", async () => {
        const service = new CashMovementService({} as any);

        setupSelect([
          {
            status: "closed",
          },
        ]);

        const result = await service.processCashMovement(
          "shift-001",
          {
            type: "cash_in",
            amount: 500,
            description: "現金存入",
          },
          1,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("已結束");
      });

      it("應該拒絕不存在的班次", async () => {
        const service = new CashMovementService({} as any);

        setupSelect([]);

        const result = await service.processCashMovement(
          "non-existent",
          {
            type: "cash_in",
            amount: 500,
            description: "現金存入",
          },
          1,
        );

        expect(result.success).toBe(false);
      });

      it("應該支援面額明細", async () => {
        const service = new CashMovementService({} as any);

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
            amount: 5000,
            description: "現金盤點",
            denominationBreakdown: { "1000": 3, "500": 2, "100": 10 },
          },
          1,
        );

        expect(result.success).toBe(true);
      });
    });

    describe("getCashMovements", () => {
      it("應該返回現金流動記錄", async () => {
        const service = new CashMovementService({} as any);

        setupSelect([
          {
            id: "mov-001",
            type: "cash_in",
            amount: 500,
            denominationBreakdown: "{}",
            metadata: "{}",
          },
          {
            id: "mov-002",
            type: "cash_out",
            amount: 200,
            denominationBreakdown: "{}",
            metadata: "{}",
          },
        ]);

        const result = await service.getCashMovements("shift-001", {});

        expect(result.success).toBe(true);
        expect(result.data.movements).toHaveLength(2);
      });

      it("應該支援類型過濾", async () => {
        const service = new CashMovementService({} as any);

        setupSelect([
          {
            id: "mov-001",
            type: "cash_in",
            amount: 500,
            denominationBreakdown: "{}",
            metadata: "{}",
          },
        ]);

        const result = await service.getCashMovements("shift-001", {
          type: "cash_in",
        });

        expect(result.success).toBe(true);
      });

      it("應該支援分頁", async () => {
        const service = new CashMovementService({} as any);

        setupSelect([]);

        const result = await service.getCashMovements("shift-001", {
          page: 2,
          limit: 10,
        });

        expect(result.success).toBe(true);
        expect(result.data.pagination.page).toBe(2);
      });
    });

    describe("approveCashMovement", () => {
      it("應該成功審核現金操作", async () => {
        const service = new CashMovementService({} as any);

        setupUpdate();

        const result = await service.approveCashMovement("mov-001", 1);

        expect(result.success).toBe(true);
      });
    });

    describe("rejectCashMovement", () => {
      it("應該成功拒絕現金操作", async () => {
        const service = new CashMovementService({} as any);

        setupUpdate();

        const result = await service.rejectCashMovement(
          "mov-001",
          1,
          "金額不符",
        );

        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // ReceiptService Tests (12 tests)
  // ========================================

  describe("ReceiptService", () => {
    describe("printReceipt", () => {
      it("應該成功打印收據", async () => {
        const service = new ReceiptService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Check order exists
            return createChain([
              {
                id: 1,
                order_number: "ORD-001",
                total_amount: 1000,
              },
            ]);
          } else if (selectCallCount === 2) {
            // Get order items
            return createChain([]);
          } else {
            // Get created receipt
            return createChain([{ id: "receipt-001", content: "{}" }]);
          }
        });
        setupInsert();

        const result = await service.printReceipt(
          {
            orderId: 1,
            templateName: "default",
            receiptType: "customer",
          },
          "reg-001",
          "shift-001",
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("應該拒絕不存在的訂單", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([]);

        const result = await service.printReceipt(
          {
            orderId: 999,
            templateName: "default",
            receiptType: "customer",
          },
          "reg-001",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("不存在");
      });

      it("應該支援不同收據類型", async () => {
        const service = new ReceiptService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createChain([{ id: 1, order_number: "ORD-001" }]);
          } else if (selectCallCount === 2) {
            return createChain([]);
          } else {
            return createChain([{ id: "receipt-001", content: "{}" }]);
          }
        });
        setupInsert();

        const result = await service.printReceipt(
          {
            orderId: 1,
            templateName: "kitchen",
            receiptType: "kitchen",
          },
          "reg-001",
        );

        expect(result.success).toBe(true);
      });

      it("應該支援多份打印", async () => {
        const service = new ReceiptService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createChain([{ id: 1, order_number: "ORD-001" }]);
          } else if (selectCallCount === 2) {
            return createChain([]);
          } else {
            return createChain([{ id: "receipt-001", content: "{}" }]);
          }
        });
        setupInsert();

        const result = await service.printReceipt(
          {
            orderId: 1,
            copies: 3,
          },
          "reg-001",
        );

        expect(result.success).toBe(true);
      });
    });

    describe("reprintReceipt", () => {
      it("應該成功重打收據", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([
          {
            id: "receipt-001",
            reprintedCount: 0,
          },
        ]);
        setupUpdate();

        const result = await service.reprintReceipt("receipt-001");

        expect(result.success).toBe(true);
      });

      it("應該拒絕不存在的收據", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([]);

        const result = await service.reprintReceipt("non-existent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("不存在");
      });
    });

    describe("getReceipts", () => {
      it("應該返回收據列表", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([
          { id: "receipt-001", receipt_number: "R001", content: "{}" },
          { id: "receipt-002", receipt_number: "R002", content: "{}" },
        ]);

        const result = await service.getReceipts("reg-001");

        expect(result.success).toBe(true);
        expect(result.data.receipts).toHaveLength(2);
      });

      it("應該支援日期過濾", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([]);

        const result = await service.getReceipts("reg-001", {
          startDate: "2024-01-01",
          endDate: "2024-01-31",
        });

        expect(result.success).toBe(true);
      });

      it("應該支援類型過濾", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([]);

        const result = await service.getReceipts("reg-001", {
          receiptType: "customer",
        });

        expect(result.success).toBe(true);
      });
    });

    describe("getReceiptDetail", () => {
      it("應該返回收據詳情", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([
          {
            id: "receipt-001",
            receipt_number: "R001",
            content: '{"items": []}',
          },
        ]);

        const result = await service.getReceiptDetail("receipt-001");

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("應該處理不存在的收據", async () => {
        const service = new ReceiptService({} as any);

        setupSelect([]);

        const result = await service.getReceiptDetail("non-existent");

        expect(result.success).toBe(false);
      });
    });

    describe("cancelPrint", () => {
      it("應該成功取消打印", async () => {
        const service = new ReceiptService({} as any);

        setupUpdate();

        const result = await service.cancelPrint("receipt-001");

        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // RefundService Tests (14 tests)
  // ========================================

  describe("RefundService", () => {
    describe("processRefund", () => {
      it("應該成功處理全額退款", async () => {
        const service = new RefundService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Check original order
            return createChain([
              {
                id: 1,
                totalAmount: 1000,
                total_amount: "1000",
                status: "completed",
              },
            ]);
          } else if (selectCallCount === 2) {
            // Check existing refunds (SUM)
            return createChain([{ totalRefunded: 0 }]);
          } else {
            // Get created refund
            return createChain([
              {
                id: "refund-001",
                refundAmount: 1000,
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
            refundType: "full",
            refundAmount: 1000,
            refundMethod: "cash",
            reasonCode: "customer_request",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(true);
      });

      it("應該成功處理部分退款", async () => {
        const service = new RefundService({} as any);

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

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "partial",
            refundAmount: 500,
            refundMethod: "cash",
            reasonCode: "item_issue",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(true);
      });

      it("應該拒絕超過訂單金額的退款", async () => {
        const service = new RefundService({} as any);

        setupSelect([
          {
            id: 1,
            totalAmount: 1000,
            total_amount: "1000",
            status: "completed",
          },
        ]);

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "partial",
            refundAmount: 1500,
            refundMethod: "cash",
            reasonCode: "test",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("超過");
      });

      it("應該拒絕對不存在訂單的退款", async () => {
        const service = new RefundService({} as any);

        setupSelect([]);

        const result = await service.processRefund(
          {
            originalOrderId: 999,
            refundType: "full",
            refundAmount: 1000,
            refundMethod: "cash",
            reasonCode: "test",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("不存在");
      });

      it("應該拒絕超過可退款額度的退款", async () => {
        const service = new RefundService({} as any);

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
            return createChain([{ totalRefunded: 800 }]); // Already refunded 800
          }
        });

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "partial",
            refundAmount: 300, // Would exceed total
            refundMethod: "cash",
            reasonCode: "test",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("超過");
      });

      it("應該支援卡片退款", async () => {
        const service = new RefundService({} as any);

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
                refundAmount: 1000,
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
            refundType: "full",
            refundAmount: 1000,
            refundMethod: "card",
            reasonCode: "customer_request",
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(true);
      });

      it("應該支援項目退款", async () => {
        const service = new RefundService({} as any);

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
                refundAmount: 300,
                status: "processing",
                itemsRefunded: '[{"itemId": 1, "quantity": 1}]',
                metadata: "{}",
              },
            ]);
          }
        });
        setupInsert();

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "item",
            refundAmount: 300,
            refundMethod: "cash",
            reasonCode: "item_defect",
            itemsRefunded: [{ itemId: 1, quantity: 1 }],
          },
          "reg-001",
          1,
        );

        expect(result.success).toBe(true);
      });

      // K6 release gate: refund against a closed shift must create the
      // refund row but not mutate the closed ledger, and the response must
      // expose an adjustmentId plus ledgerMutation=false.
      it("closed shift: returns adjustmentId + ledgerMutation=false and skips cash movement", async () => {
        const service = new RefundService({} as any);

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
          } else if (selectCallCount === 3) {
            // Shift lookup — simulated CLOSED shift
            return createChain([{ status: "closed" }]);
          } else {
            return createChain([
              {
                id: "refund-closed-001",
                refundAmount: 1000,
                status: "processing",
                itemsRefunded: "[]",
                metadata: '{"postCloseAdjustment":true}',
              },
            ]);
          }
        });
        setupInsert();

        const result = await service.processRefund(
          {
            originalOrderId: 1,
            refundType: "full",
            refundAmount: 1000,
            refundMethod: "cash",
            reasonCode: "after_close",
            reasonDescription: "K6 closed-ledger drill",
          },
          "reg-closed",
          1,
          "shift-closed-001",
        );

        expect(result.success).toBe(true);
        expect(result.data?.ledgerMutation).toBe(false);
        expect(result.data?.adjustmentId).toBe("refund-closed-001");
        // Only the refund insert should fire; no cash movement.
        expect(mockInsert).toHaveBeenCalledTimes(1);
      });

      it("active shift: returns ledgerMutation=true and records a cash movement", async () => {
        const service = new RefundService({} as any);

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
          } else if (selectCallCount === 3) {
            // Shift lookup — simulated ACTIVE shift
            return createChain([{ status: "active" }]);
          } else {
            return createChain([
              {
                id: "refund-active-001",
                refundAmount: 1000,
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
            refundType: "full",
            refundAmount: 1000,
            refundMethod: "cash",
            reasonCode: "customer_request",
          },
          "reg-active",
          1,
          "shift-active-001",
        );

        expect(result.success).toBe(true);
        expect(result.data?.ledgerMutation).toBe(true);
        expect((result.data as any)?.adjustmentId).toBeUndefined();
        // Refund insert + cash_movement insert.
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });
    });

    describe("getRefunds", () => {
      it("應該返回退款記錄列表", async () => {
        const service = new RefundService({} as any);

        setupSelect([
          {
            id: "refund-001",
            refundAmount: 500,
            status: "completed",
            itemsRefunded: "[]",
            metadata: "{}",
          },
          {
            id: "refund-002",
            refundAmount: 300,
            status: "pending",
            itemsRefunded: "[]",
            metadata: "{}",
          },
        ]);

        const result = await service.getRefunds("reg-001", {});

        expect(result.success).toBe(true);
        expect(result.data.refunds).toHaveLength(2);
      });

      it("應該支援狀態過濾", async () => {
        const service = new RefundService({} as any);

        setupSelect([]);

        const result = await service.getRefunds("reg-001", {
          status: "completed",
        });

        expect(result.success).toBe(true);
      });

      it("應該支援訂單過濾", async () => {
        const service = new RefundService({} as any);

        setupSelect([]);

        const result = await service.getRefunds("reg-001", { orderId: 1 });

        expect(result.success).toBe(true);
      });
    });

    describe("approveRefund", () => {
      it("應該成功審核退款", async () => {
        const service = new RefundService({} as any);

        setupUpdate();

        const result = await service.approveRefund("refund-001", 1);

        expect(result.success).toBe(true);
      });
    });

    describe("rejectRefund", () => {
      it("應該成功拒絕退款", async () => {
        const service = new RefundService({} as any);

        setupUpdate();

        const result = await service.rejectRefund(
          "refund-001",
          1,
          "不符合退款條件",
        );

        expect(result.success).toBe(true);
      });
    });

    describe("cancelRefund", () => {
      it("應該成功取消退款", async () => {
        const service = new RefundService({} as any);

        setupUpdate();

        const result = await service.cancelRefund("refund-001", 1, "客戶取消");

        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // ReportService Tests (10 tests)
  // ========================================

  describe("ReportService", () => {
    describe("generateShiftReport", () => {
      it("應該成功生成班次報表", async () => {
        const service = new ReportService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Get shift
            return createChain([
              {
                id: "shift-001",
                registerId: "reg-001",
                operatorId: 1,
                status: "closed",
                startAmount: 1000,
                endAmount: 5800,
                totalSales: 5000,
                totalRefunds: 200,
                cashSales: 3000,
                cardSales: 1500,
                digitalSales: 500,
                expectedAmount: 5800,
                actualAmount: 5800,
                differenceAmount: 0,
                startedAt: "2024-01-15T08:00:00Z",
                endedAt: "2024-01-15T16:00:00Z",
              },
            ]);
          } else if (selectCallCount === 2) {
            // Get movements
            return createChain([]);
          } else if (selectCallCount === 3) {
            // Get receipt stats
            return createChain([{ totalReceipts: 0, printedReceipts: 0 }]);
          } else if (selectCallCount === 4) {
            // Get order stats
            return createChain([
              {
                totalOrders: 50,
                totalSales: 5000,
                avgOrderValue: 100,
              },
            ]);
          }
          return createChain([]);
        });
        setupInsert();

        const result = await service.generateShiftReport("shift-001");

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.reportData).toBeDefined();
      });

      it("應該處理不存在的班次", async () => {
        const service = new ReportService({} as any);

        setupSelect([]);

        const result = await service.generateShiftReport("non-existent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("不存在");
      });

      it("應該計算班次時長", async () => {
        const service = new ReportService({} as any);

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
                totalSales: 5000,
                totalRefunds: 200,
                cashSales: 3000,
                cardSales: 1500,
                digitalSales: 500,
                startedAt: "2024-01-15T08:00:00Z",
                endedAt: "2024-01-15T16:00:00Z",
              },
            ]);
          } else if (selectCallCount === 2) {
            return createChain([]);
          } else if (selectCallCount === 3) {
            return createChain([{ totalReceipts: 0, printedReceipts: 0 }]);
          } else if (selectCallCount === 4) {
            return createChain([{ totalOrders: 50 }]);
          }
          return createChain([]);
        });
        setupInsert();

        const result = await service.generateShiftReport("shift-001");

        expect(result.success).toBe(true);
        expect(result.data.reportData.shift.duration).toBe(480); // 8 hours = 480 minutes
      });
    });

    describe("getDailyReport", () => {
      it("應該成功生成日報表", async () => {
        const service = new ReportService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Get shifts
            return createChain([]);
          } else if (selectCallCount === 2) {
            // Get order stats
            return createChain([
              {
                totalOrders: 50,
                totalSales: 15000,
                totalTax: 750,
                totalDiscounts: 500,
                avgOrderValue: 300,
                cashOrders: 30,
                cardOrders: 15,
                digitalOrders: 5,
              },
            ]);
          } else if (selectCallCount === 3) {
            // Get refund stats
            return createChain([
              {
                totalRefunds: 2,
                totalRefundAmount: 300,
              },
            ]);
          } else if (selectCallCount === 4) {
            // Get top items
            return createChain([]);
          }
          return createChain([]);
        });

        const result = await service.getDailyReport("rest-001", "2024-01-15");

        expect(result.success).toBe(true);
        expect(result.data.summary.totalOrders).toBe(50);
      });

      it("應該正確計算淨銷售額", async () => {
        const service = new ReportService({} as any);

        let selectCallCount = 0;
        mockSelect.mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createChain([]);
          } else if (selectCallCount === 2) {
            return createChain([
              {
                totalOrders: 50,
                totalSales: 15000,
                totalTax: 750,
                totalDiscounts: 500,
                avgOrderValue: 300,
                cashOrders: 30,
                cardOrders: 15,
                digitalOrders: 5,
              },
            ]);
          } else if (selectCallCount === 3) {
            return createChain([
              {
                totalRefunds: 2,
                totalRefundAmount: 300,
              },
            ]);
          } else {
            return createChain([]);
          }
        });

        const result = await service.getDailyReport("rest-001", "2024-01-15");

        expect(result.success).toBe(true);
        expect(result.data.summary.netSales).toBe(14700); // 15000 - 300
      });
    });

    describe("getShiftStats", () => {
      it("應該返回班次統計", async () => {
        const service = new ReportService({} as any);

        setupSelect([
          {
            totalShifts: 30,
            totalSales: 150000,
          },
        ]);

        const result = await service.getShiftStats("rest-001");

        expect(result.success).toBe(true);
      });

      it("應該支援日期範圍", async () => {
        const service = new ReportService({} as any);

        setupSelect([
          {
            totalShifts: 10,
            totalSales: 50000,
          },
        ]);

        const result = await service.getShiftStats("rest-001", {
          from: new Date("2024-01-01"),
          to: new Date("2024-01-31"),
        });

        expect(result.success).toBe(true);
      });
    });

    describe("getRegisterUsageStats", () => {
      it("應該返回收銀機使用統計", async () => {
        const service = new ReportService({} as any);

        setupSelect([]);

        const result = await service.getRegisterUsageStats("rest-001", "day");

        expect(result.success).toBe(true);
        expect(result.data.period).toBe("day");
      });

      it("應該支援不同統計週期", async () => {
        const service = new ReportService({} as any);

        setupSelect([]);

        const result = await service.getRegisterUsageStats("rest-001", "month");

        expect(result.success).toBe(true);
        expect(result.data.period).toBe("month");
      });
    });
  });
});
