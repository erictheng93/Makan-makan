/**
 * Testing Utils Factories Test
 *
 * 驗證所有工廠的功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  userFactory,
  UserRoles,
  restaurantFactory,
  RestaurantTypes,
  categoryFactory,
  menuItemFactory,
  orderFactory,
  orderItemFactory,
  buildCompleteRestaurantData,
  resetAllFactories,
} from "../factories";

describe("User Factory", () => {
  beforeEach(() => {
    userFactory.resetSequence();
  });

  it("應該生成基本用戶數據", () => {
    const user = userFactory.build();

    expect(user.id).toBe(1);
    expect(user.username).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.phone).toBeDefined();
    expect(user.fullName).toBeDefined();
    expect(user.role).toBe(UserRoles.CUSTOMER);
  });

  it("應該生成管理員", () => {
    const admin = userFactory.buildAdmin();

    expect(admin.role).toBe(UserRoles.ADMIN);
    expect(admin.fullName).toBe("系統管理員");
  });

  it("應該生成店主", () => {
    const owner = userFactory.buildShopOwner(5);

    expect(owner.role).toBe(UserRoles.SHOP_OWNER);
    expect(owner.restaurantId).toBe(5);
  });

  it("應該生成多個用戶", () => {
    const users = userFactory.buildList(5);

    expect(users).toHaveLength(5);
    expect(users[0].id).toBe(1);
    expect(users[4].id).toBe(5);
  });

  it("應該生成完整的餐廳團隊", () => {
    const team = userFactory.buildRestaurantTeam(1);

    expect(team.owner.role).toBe(UserRoles.SHOP_OWNER);
    expect(team.chefs).toHaveLength(2);
    expect(team.serviceCrews).toHaveLength(3);
    expect(team.cashiers).toHaveLength(2);
  });
});

describe("Restaurant Factory", () => {
  beforeEach(() => {
    restaurantFactory.resetSequence();
  });

  it("應該生成基本餐廳數據", () => {
    const restaurant = restaurantFactory.build();

    expect(restaurant.id).toBe(1);
    expect(restaurant.name).toBeDefined();
    expect(restaurant.category).toBeDefined();
    expect(restaurant.city).toBe("台中市");
    expect(restaurant.isActive).toBe(true);
  });

  it("應該生成啟用 Shop QR 的餐廳", () => {
    const restaurant = restaurantFactory.buildWithShopMode();

    expect(restaurant.enableShopMode).toBe(true);
    expect(restaurant.shopQrCode).toBeDefined();
    expect(restaurant.shopQrCodeImageUrl).toBeDefined();
  });

  it("應該生成快餐店", () => {
    const fastFood = restaurantFactory.buildFastFood();

    expect(fastFood.category).toBe("快餐");
    expect(fastFood.type).toBe(RestaurantTypes.ALL);
    expect(fastFood.settings.serviceChargeRate).toBe(0);
  });

  it("應該生成咖啡廳", () => {
    const cafe = restaurantFactory.buildCafe();

    expect(cafe.category).toBe("咖啡廳");
    expect(cafe.type).toBe(RestaurantTypes.DINE_IN);
  });
});

describe("Category Factory", () => {
  beforeEach(() => {
    categoryFactory.resetSequence();
  });

  it("應該生成基本分類數據", () => {
    const category = categoryFactory.build({
      relations: { restaurantId: 1 },
    });

    expect(category.id).toBe(1);
    expect(category.restaurantId).toBe(1);
    expect(category.name).toBeDefined();
    expect(category.isActive).toBe(true);
  });

  it("應該生成完整的餐廳分類集合", () => {
    const categories = categoryFactory.buildRestaurantCategories(1);

    expect(categories).toHaveLength(10);
    expect(categories[0].restaurantId).toBe(1);
    expect(categories[0].sortOrder).toBe(0);
    expect(categories[9].sortOrder).toBe(9);
  });
});

describe("MenuItem Factory", () => {
  beforeEach(() => {
    menuItemFactory.resetSequence();
  });

  it("應該生成基本菜單項目", () => {
    const menuItem = menuItemFactory.build({
      relations: {
        restaurantId: 1,
        categoryId: 1,
        categoryName: "主菜",
      },
    });

    expect(menuItem.id).toBe(1);
    expect(menuItem.restaurantId).toBe(1);
    expect(menuItem.categoryId).toBe(1);
    expect(menuItem.price).toBeGreaterThan(0);
    expect(menuItem.isAvailable).toBeDefined();
  });

  it("應該為特定分類生成多個項目", () => {
    const items = menuItemFactory.buildForCategory(1, 1, "主菜", 5);

    expect(items).toHaveLength(5);
    expect(items.every((item) => item.restaurantId === 1)).toBe(true);
    expect(items.every((item) => item.categoryId === 1)).toBe(true);
  });

  it("應該生成熱門菜品", () => {
    const popular = menuItemFactory.buildPopular();

    expect(popular.isPopular).toBe(true);
    expect(popular.isFeatured).toBe(true);
    expect(popular.orderCount).toBeGreaterThan(100);
  });

  it("應該生成促銷菜品", () => {
    const sale = menuItemFactory.buildOnSale();

    expect(sale.originalPrice).toBeGreaterThan(sale.price);
    expect(sale.isFeatured).toBe(true);
  });

  it("應該生成素食菜品", () => {
    const vegetarian = menuItemFactory.buildVegetarian();

    expect(vegetarian.dietaryInfo.vegetarian).toBe(true);
    expect(vegetarian.allergens).toHaveLength(0);
  });
});

describe("Order Factory", () => {
  beforeEach(() => {
    orderFactory.resetSequence();
  });

  it("應該生成基本訂單數據", () => {
    const order = orderFactory.build({
      relations: {
        restaurantId: 1,
        tableId: 5,
        customerId: 10,
      },
    });

    expect(order.id).toBe(1);
    expect(order.restaurantId).toBe(1);
    expect(order.tableId).toBe(5);
    expect(order.customerId).toBe(10);
    expect(order.orderNumber).toBeDefined();
    expect(order.totalAmount).toBeGreaterThan(0);
  });

  it("應該生成待處理訂單", () => {
    const pending = orderFactory.buildPending();

    expect(pending.status).toBe("pending");
    expect(pending.confirmedAt).toBeNull();
    expect(pending.paidAt).toBeNull();
  });

  it("應該生成進行中訂單", () => {
    const inProgress = orderFactory.buildInProgress();

    expect(inProgress.status).toBe("preparing");
    expect(inProgress.confirmedAt).toBeDefined();
    expect(inProgress.preparingAt).toBeDefined();
  });

  it("應該生成已付款訂單", () => {
    const completed = orderFactory.buildPaid();

    expect(completed.status).toBe("paid");
    expect(completed.paymentStatus).toBe("paid");
    expect(completed.paymentMethod).toBeDefined();
  });

  it("應該生成外帶訂單", () => {
    const takeaway = orderFactory.buildTakeaway();

    expect(takeaway.orderType).toBe("takeaway");
    expect(takeaway.tableId).toBeNull();
    expect(takeaway.serviceCharge).toBe(0);
  });

  it("應該生成外送訂單", () => {
    const delivery = orderFactory.buildDelivery();

    expect(delivery.orderType).toBe("delivery");
    expect(delivery.tableId).toBeNull();
    expect(delivery.deliveryInfo).toBeDefined();
    expect(delivery.deliveryInfo!.deliveryFee).toBe(50);
  });
});

describe("OrderItem Factory", () => {
  beforeEach(() => {
    orderItemFactory.resetSequence();
  });

  it("應該生成基本訂單項目", () => {
    const item = orderItemFactory.build({
      relations: {
        orderId: 1,
        menuItemId: 5,
      },
    });

    expect(item.id).toBe(1);
    expect(item.orderId).toBe(1);
    expect(item.menuItemId).toBe(5);
    expect(item.totalPrice).toBe(item.unitPrice * item.quantity);
  });

  it("應該為訂單生成多個項目", () => {
    const items = orderItemFactory.buildForOrder(1, 3);

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.orderId === 1)).toBe(true);
  });

  it("應該生成已準備好的項目", () => {
    const prepared = orderItemFactory.buildPrepared();

    expect(prepared.status).toBe("prepared");
    expect(prepared.preparedAt).toBeDefined();
  });

  it("應該生成已上菜的項目", () => {
    const served = orderItemFactory.buildServed();

    expect(served.status).toBe("served");
    expect(served.preparedAt).toBeDefined();
    expect(served.servedAt).toBeDefined();
    expect(served.servedAt).toBeGreaterThan(served.preparedAt!);
  });
});

describe("buildCompleteRestaurantData", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應該生成完整的餐廳數據", () => {
    const testData = buildCompleteRestaurantData();

    expect(testData.restaurant).toBeDefined();
    expect(testData.team.owner).toBeDefined();
    expect(testData.categories).toHaveLength(10);
    expect(testData.menuItems).toHaveLength(50); // 10 categories * 5 items
    expect(testData.orders).toHaveLength(10);
    expect(testData.orderItems.length).toBeGreaterThan(0);
    expect(testData.customers).toHaveLength(20);
  });

  it("應該根據選項自定義生成的數據", () => {
    const testData = buildCompleteRestaurantData({
      enableShopMode: true,
      menuItemsPerCategory: 3,
      orderCount: 5,
    });

    expect(testData.restaurant.enableShopMode).toBe(true);
    expect(testData.menuItems).toHaveLength(30); // 10 categories * 3 items
    expect(testData.orders).toHaveLength(5);
  });

  it("應該包含正確的數據摘要", () => {
    const testData = buildCompleteRestaurantData({
      menuItemsPerCategory: 3,
      orderCount: 5,
    });

    expect(testData.summary.restaurantCount).toBe(1);
    expect(testData.summary.employeeCount).toBe(8); // 1 owner + 2 chefs + 3 crews + 2 cashiers
    expect(testData.summary.categoryCount).toBe(10);
    expect(testData.summary.menuItemCount).toBe(30);
    expect(testData.summary.orderCount).toBe(5);
    expect(testData.summary.customerCount).toBe(20);
  });
});

describe("序列號重置", () => {
  it("應該重置所有工廠的序列號", () => {
    // 生成一些數據
    userFactory.build();
    restaurantFactory.build();
    menuItemFactory.build();

    // 重置
    resetAllFactories();

    // 驗證序列號已重置
    const user = userFactory.build();
    const restaurant = restaurantFactory.build();
    const menuItem = menuItemFactory.build();

    expect(user.id).toBe(1);
    expect(restaurant.id).toBe(1);
    expect(menuItem.id).toBe(1);
  });
});
