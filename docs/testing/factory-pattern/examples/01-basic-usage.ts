/**
 * 範例 1: 基本使用
 *
 * 展示最基本的 factory 使用方法
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  userFactory,
  restaurantFactory,
  orderFactory,
  resetAllFactories,
  UserRoles,
} from "@makanmakan/testing-utils";

describe("範例 1: 基本使用", () => {
  // 每個測試前重置序列號
  beforeEach(() => {
    resetAllFactories();
  });

  it("應該生成基本用戶數據", () => {
    // 生成單個用戶
    const user = userFactory.build();

    // 驗證數據
    expect(user.id).toBe(1);
    expect(user.username).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.phone).toBeDefined();
    expect(user.role).toBe(UserRoles.CUSTOMER); // 預設角色
  });

  it("應該生成特定角色的用戶", () => {
    // 使用專用方法生成管理員
    const admin = userFactory.buildAdmin();

    expect(admin.role).toBe(UserRoles.ADMIN);
    expect(admin.fullName).toBe("系統管理員");
    expect(admin.isActive).toBe(true);
  });

  it("應該生成多個用戶", () => {
    // 使用 buildList 生成多筆數據
    const users = userFactory.buildList(5);

    expect(users).toHaveLength(5);
    expect(users[0].id).toBe(1);
    expect(users[1].id).toBe(2);
    expect(users[4].id).toBe(5);
  });

  it("應該自訂用戶數據", () => {
    // 使用 overrides 覆寫預設值
    const customUser = userFactory.build({
      overrides: {
        username: "custom_username",
        email: "custom@test.com",
        fullName: "自訂名稱",
      },
    });

    expect(customUser.username).toBe("custom_username");
    expect(customUser.email).toBe("custom@test.com");
    expect(customUser.fullName).toBe("自訂名稱");
  });

  it("應該生成餐廳數據", () => {
    const restaurant = restaurantFactory.build();

    expect(restaurant.id).toBe(1);
    expect(restaurant.name).toBeDefined();
    expect(restaurant.category).toBeDefined();
    expect(restaurant.isActive).toBe(true);
  });

  it("應該生成訂單數據", () => {
    const order = orderFactory.build({
      relations: {
        restaurantId: 1,
        customerId: 1,
      },
    });

    expect(order.id).toBe(1);
    expect(order.restaurantId).toBe(1);
    expect(order.customerId).toBe(1);
    expect(order.status).toBe("pending");
  });
});
