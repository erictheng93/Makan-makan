/**
 * 範例 3: 完整測試環境生成
 *
 * 展示如何使用 buildCompleteRestaurantData() 快速生成完整環境
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCompleteRestaurantData,
  resetAllFactories,
  UserRoles,
} from "@makanmasak/testing-utils";

describe("範例 3: 完整測試環境", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應該生成預設的完整環境", () => {
    // 一鍵生成所有數據
    const testData = buildCompleteRestaurantData();

    // 驗證餐廳
    expect(testData.restaurant).toBeDefined();
    expect(testData.restaurant.id).toBe(1);

    // 驗證團隊
    expect(testData.team.owner).toBeDefined();
    expect(testData.team.owner.role).toBe(UserRoles.OWNER);
    expect(testData.team.chefs).toHaveLength(2);
    expect(testData.team.serviceCrews).toHaveLength(3);
    expect(testData.team.cashiers).toHaveLength(2);

    // 驗證菜單
    expect(testData.categories).toHaveLength(10);
    expect(testData.menuItems).toHaveLength(50); // 10 * 5

    // 驗證訂單
    expect(testData.orders).toHaveLength(10);
    expect(testData.orderItems.length).toBeGreaterThan(0);

    // 驗證顧客
    expect(testData.customers).toHaveLength(20);

    // 驗證摘要
    expect(testData.summary.restaurantCount).toBe(1);
    expect(testData.summary.employeeCount).toBe(8); // 1+2+3+2
    expect(testData.summary.categoryCount).toBe(10);
    expect(testData.summary.menuItemCount).toBe(50);
  });

  it("應該生成自訂數量的數據", () => {
    // 自訂參數
    const testData = buildCompleteRestaurantData({
      enableShopMode: true,
      categoryCount: 5,
      menuItemsPerCategory: 3,
      orderCount: 15,
    });

    // 驗證自訂參數生效
    expect(testData.restaurant.enableShopMode).toBe(true);
    expect(testData.categories).toHaveLength(5);
    expect(testData.menuItems).toHaveLength(15); // 5 * 3
    expect(testData.orders).toHaveLength(15);
  });

  it("應該用於整合測試場景", () => {
    // 情境：測試完整的訂餐流程
    const testData = buildCompleteRestaurantData();

    // 1. 顧客選擇菜單
    const _customer = testData.customers[0];
    const _selectedItems = testData.menuItems.slice(0, 3);

    // 2. 下訂單
    const newOrder = testData.orders[0];
    expect(newOrder.restaurantId).toBe(testData.restaurant.id);

    // 3. 廚師接單
    const chef = testData.team.chefs[0];
    expect(chef.role).toBe(UserRoles.CHEF);
    expect(chef.restaurantId).toBe(testData.restaurant.id);

    // 4. 服務員送餐
    const serviceCrew = testData.team.serviceCrews[0];
    expect(serviceCrew.role).toBe(UserRoles.SERVICE);

    // 5. 收銀員結帳
    const cashier = testData.team.cashiers[0];
    expect(cashier.role).toBe(UserRoles.CASHIER);

    // 整個流程的數據都已準備好
  });

  it("應該用於性能測試", () => {
    // 生成大量數據進行性能測試
    const testData = buildCompleteRestaurantData({
      categoryCount: 20,
      menuItemsPerCategory: 10,
      orderCount: 100,
    });

    expect(testData.menuItems).toHaveLength(200);
    expect(testData.orders).toHaveLength(100);

    // 可用於測試大數據量的查詢性能
  });

  it("應該用於 E2E 測試準備", () => {
    // E2E 測試需要完整的環境
    const testData = buildCompleteRestaurantData({
      enableShopMode: true,
    });

    // 驗證 Shop QR 模式已啟用
    expect(testData.restaurant.enableShopMode).toBe(true);
    expect(testData.restaurant.shopQrCode).toBeDefined();
    expect(testData.restaurant.shopQrCodeImageUrl).toBeDefined();

    // 可以直接用於模擬完整的用戶流程
    // 1. 掃描 Shop QR
    // 2. 瀏覽菜單
    // 3. 加入購物車
    // 4. 結帳
    // 5. 追蹤訂單
  });

  it("應該生成最小化的測試環境", () => {
    // 只需要最少數據的測試
    const testData = buildCompleteRestaurantData({
      categoryCount: 1,
      menuItemsPerCategory: 1,
      orderCount: 1,
    });

    expect(testData.categories).toHaveLength(1);
    expect(testData.menuItems).toHaveLength(1);
    expect(testData.orders).toHaveLength(1);

    // 快速、簡潔的測試環境
  });

  it("應該提供所有員工的統一訪問", () => {
    const testData = buildCompleteRestaurantData();

    // 可以通過 team.all 訪問所有員工
    const allEmployees = testData.team.all;

    expect(allEmployees).toHaveLength(8);
    expect(allEmployees).toContain(testData.team.owner);
    expect(allEmployees).toEqual(expect.arrayContaining(testData.team.chefs));
    expect(allEmployees).toEqual(
      expect.arrayContaining(testData.team.serviceCrews),
    );
    expect(allEmployees).toEqual(
      expect.arrayContaining(testData.team.cashiers),
    );
  });

  it("應該驗證數據的完整性", () => {
    const testData = buildCompleteRestaurantData();

    // 所有菜單項目都屬於某個分類
    testData.menuItems.forEach((item) => {
      const category = testData.categories.find(
        (c) => c.id === item.categoryId,
      );
      expect(category).toBeDefined();
    });

    // 所有菜單項目都屬於該餐廳
    expect(
      testData.menuItems.every(
        (item) => item.restaurantId === testData.restaurant.id,
      ),
    ).toBe(true);

    // 所有員工都屬於該餐廳
    expect(
      testData.team.all.every(
        (employee) => employee.restaurantId === testData.restaurant.id,
      ),
    ).toBe(true);

    // 所有訂單都屬於該餐廳
    expect(
      testData.orders.every(
        (order) => order.restaurantId === testData.restaurant.id,
      ),
    ).toBe(true);
  });
});
