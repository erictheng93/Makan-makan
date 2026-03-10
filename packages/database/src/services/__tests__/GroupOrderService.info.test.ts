/**
 * GroupOrderService - 獲取群組資訊測試
 *
 * 測試範圍: 查詢群組訂單資訊
 * 測試數量: 5 個測試
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GroupOrderService } from "../GroupOrderService";
import {
  createOptimizedMockDB,
  createMockEnv,
  setupUUIDMock,
  setupRandomMock,
  cleanupMockDB,
} from "./test-helpers";

describe("GroupOrderService - 獲取群組資訊", () => {
  let service: GroupOrderService;
  let mockDB: any;
  let mockEnv: any;
  let testGroupOrderId: string;

  beforeEach(async () => {
    // 先設置 mock,再創建 service
    setupUUIDMock();
    setupRandomMock();

    mockDB = createOptimizedMockDB();
    mockEnv = createMockEnv();
    service = new GroupOrderService(mockDB, mockEnv);

    // 創建群組並添加一些測試數據
    const createResult = await service.createGroupOrder(
      {
        restaurantId: "R-001",
      },
      1,
    );
    testGroupOrderId = createResult.data!.groupOrderId;

    // 添加測試菜品
    mockDB._mockData.menuItems.set(1, {
      id: 1,
      name: "Test Burger",
      price: 10.99,
      isAvailable: true,
      restaurantId: "R-001",
    });

    // 添加第二個成員
    const memberData = {
      id: crypto.randomUUID(),
      groupOrderId: testGroupOrderId,
      name: "Test Member",
      role: "member",
      permissions: JSON.stringify({}),
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true,
    };
    mockDB._mockData.groupMembers.set(memberData.id, memberData);
  });

  afterEach(() => {
    cleanupMockDB(mockDB);
  });

  it("應該成功獲取群組資訊", async () => {
    const result = await service.getGroupOrder(testGroupOrderId);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.groupOrder).toBeDefined();
    expect(result.data?.members).toBeDefined();
    expect(result.data?.cartItems).toBeDefined();
    expect(result.data?.totalAmount).toBeDefined();
  });

  it("應該返回所有活躍成員", async () => {
    const result = await service.getGroupOrder(testGroupOrderId);

    expect(result.success).toBe(true);
    expect(result.data?.members.length).toBeGreaterThan(0);
    // 应该至少有创建者
    const creator = result.data?.members.find((m) => m.role === "creator");
    expect(creator).toBeDefined();
  });

  it("應該返回購物車項目（如果有）", async () => {
    const result = await service.getGroupOrder(testGroupOrderId);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.cartItems)).toBe(true);
  });

  it("應該正確計算總金額", async () => {
    const result = await service.getGroupOrder(testGroupOrderId);

    expect(result.success).toBe(true);
    expect(typeof result.data?.totalAmount).toBe("number");
    expect(result.data?.totalAmount).toBeGreaterThanOrEqual(0);
  });

  it("應該拒絕不存在的群組ID", async () => {
    const result = await service.getGroupOrder("non-existent-id");

    expect(result.success).toBe(false);
    expect(result.error).toContain("找不到");
  });
});
