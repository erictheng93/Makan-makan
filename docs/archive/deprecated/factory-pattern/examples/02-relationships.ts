/**
 * 範例 2: 關聯數據生成
 *
 * 展示如何生成有關聯關係的測試數據
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  restaurantFactory,
  categoryFactory,
  menuItemFactory,
  orderFactory,
  orderItemFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

describe("範例 2: 關聯數據生成", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應該生成餐廳及其分類", () => {
    // 1. 先生成餐廳
    const restaurant = restaurantFactory.build();

    // 2. 生成屬於該餐廳的分類
    const category = categoryFactory.build({
      relations: {
        restaurantId: restaurant.id!,
      },
    });

    // 驗證關聯
    expect(category.restaurantId).toBe(restaurant.id);
  });

  it("應該生成完整的菜單結構", () => {
    // 1. 生成餐廳
    const restaurant = restaurantFactory.build();

    // 2. 生成多個分類
    const categories = categoryFactory.buildRestaurantCategories(
      restaurant.id!,
    );

    // 3. 為每個分類生成菜單項目
    const allMenuItems = categories.flatMap((category) =>
      menuItemFactory.buildForCategory(
        restaurant.id!,
        category.id!,
        category.name,
        3, // 每個分類 3 個項目
      ),
    );

    // 驗證
    expect(categories).toHaveLength(10); // 預設 10 個分類
    expect(allMenuItems).toHaveLength(30); // 10 * 3 = 30
    expect(
      allMenuItems.every((item) => item.restaurantId === restaurant.id),
    ).toBe(true);
  });

  it("應該生成訂單及其項目", () => {
    // 1. 生成訂單
    const order = orderFactory.build({
      relations: {
        restaurantId: 1,
        customerId: 1,
      },
    });

    // 2. 生成訂單項目
    const orderItems = orderItemFactory.buildForOrder(
      order.id!,
      3, // 3 個項目
    );

    // 驗證
    expect(orderItems).toHaveLength(3);
    expect(orderItems.every((item) => item.orderId === order.id)).toBe(true);
  });

  it("應該生成完整的訂單流程數據", () => {
    // 情境：顧客在餐廳點餐

    // 1. 餐廳和菜單
    const restaurant = restaurantFactory.build();
    const categories = categoryFactory.buildRestaurantCategories(
      restaurant.id!,
    );
    const menuItems = menuItemFactory.buildForCategory(
      restaurant.id!,
      categories[0].id!,
      categories[0].name,
      5,
    );

    // 2. 顧客下單
    const order = orderFactory.build({
      relations: {
        restaurantId: restaurant.id!,
        tableId: 5,
        customerId: 1,
      },
    });

    // 3. 訂單項目（從菜單選擇）
    const orderItems = menuItems.slice(0, 3).map((menuItem, index) =>
      orderItemFactory.build({
        sequence: index,
        relations: {
          orderId: order.id!,
          menuItemId: menuItem.id!,
        },
        overrides: {
          unitPrice: menuItem.price,
          quantity: 2,
          totalPrice: menuItem.price * 2,
        },
      }),
    );

    // 驗證完整流程
    expect(order.restaurantId).toBe(restaurant.id);
    expect(orderItems).toHaveLength(3);
    expect(
      orderItems.every(
        (item) =>
          item.orderId === order.id &&
          menuItems.some((menu) => menu.id === item.menuItemId),
      ),
    ).toBe(true);
  });

  it("應該處理多層關聯", () => {
    // 餐廳 → 分類 → 菜單項目 → 訂單項目

    // 第 1 層：餐廳
    const restaurant = restaurantFactory.build();

    // 第 2 層：分類
    const category = categoryFactory.build({
      relations: { restaurantId: restaurant.id! },
    });

    // 第 3 層：菜單項目
    const menuItem = menuItemFactory.build({
      relations: {
        restaurantId: restaurant.id!,
        categoryId: category.id!,
        categoryName: category.name,
      },
    });

    // 第 4 層：訂單和訂單項目
    const order = orderFactory.build({
      relations: {
        restaurantId: restaurant.id!,
        customerId: 1,
      },
    });

    const orderItem = orderItemFactory.build({
      relations: {
        orderId: order.id!,
        menuItemId: menuItem.id!,
      },
    });

    // 驗證所有關聯
    expect(category.restaurantId).toBe(restaurant.id);
    expect(menuItem.restaurantId).toBe(restaurant.id);
    expect(menuItem.categoryId).toBe(category.id);
    expect(order.restaurantId).toBe(restaurant.id);
    expect(orderItem.orderId).toBe(order.id);
    expect(orderItem.menuItemId).toBe(menuItem.id);
  });
});
