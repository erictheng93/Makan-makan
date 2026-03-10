/**
 * Menu Factory for Test Data Generation
 */

import {
  BaseFactory,
  type FactoryOptions,
  randomChoice,
  randomNumber,
  randomBoolean,
  currentTimestamp,
} from "./base.factory";

/**
 * 分類測試數據
 */
export interface CategoryTestData {
  id?: number;
  restaurantId: number;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
  imageUrl: string | null;
  iconUrl: string | null;
  availableHours: Record<string, any>;
  itemCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 菜單項目測試數據
 */
export interface MenuItemTestData {
  id?: number;
  restaurantId: number;
  categoryId: number;
  name: string;
  description: string;
  ingredients: string;
  price: number;
  originalPrice: number | null;
  costPrice: number | null;
  imageUrl: string | null;
  imageVariants: Record<string, string>;
  isAvailable: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  sortOrder: number;
  inventoryCount: number | null;
  minInventoryAlert: number;
  spiceLevel: number;
  preparationTime: number;
  calories: number | null;
  dietaryInfo: Record<string, boolean>;
  allergens: string[];
  options: Array<{
    name: string;
    choices: Array<{ label: string; price: number }>;
  }>;
  availableHours: Record<string, any>;
  orderCount: number;
  rating: number;
  reviewCount: number;
  viewCount: number;
  tags: string[];
  keywords: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 常見分類
 */
export const CommonCategories = [
  "開胃菜",
  "主菜",
  "湯品",
  "飯類",
  "麵類",
  "小吃",
  "甜點",
  "飲料",
  "酒類",
  "套餐",
] as const;

/**
 * 常見菜餚名稱
 */
const DishNames = {
  開胃菜: ["涼拌小黃瓜", "泡菜", "毛豆", "春捲", "炸豆腐"],
  主菜: ["宮保雞丁", "糖醋排骨", "紅燒牛肉", "清蒸魚", "咖哩雞"],
  湯品: ["酸辣湯", "玉米濃湯", "蛤蜊湯", "味噌湯", "排骨湯"],
  飯類: ["炒飯", "滷肉飯", "雞腿飯", "咖哩飯", "燴飯"],
  麵類: ["牛肉麵", "炒麵", "義大利麵", "拉麵", "烏龍麵"],
  小吃: ["蚵仔煎", "臭豆腐", "鹽酥雞", "珍珠奶茶", "蔥油餅"],
  甜點: ["提拉米蘇", "布丁", "冰淇淋", "蛋糕", "水果塔"],
  飲料: ["可樂", "果汁", "奶茶", "咖啡", "茶"],
  酒類: ["啤酒", "紅酒", "白酒", "清酒", "威士忌"],
  套餐: ["商業午餐", "下午茶套餐", "情人套餐", "家庭套餐", "宵夜套餐"],
};

/**
 * 分類工廠
 */
export class CategoryFactory extends BaseFactory<CategoryTestData> {
  build(options?: FactoryOptions<CategoryTestData>): CategoryTestData {
    const sequence = options?.sequence ?? this.getNextSequence();
    const restaurantId = options?.relations?.restaurantId ?? 1;
    const categoryName =
      options?.overrides?.name ?? randomChoice([...CommonCategories]);

    const baseData: CategoryTestData = {
      id: sequence + 1,
      restaurantId,
      name: categoryName,
      description: `美味的${categoryName}選擇`,
      sortOrder: sequence,
      isActive: true,
      isVisible: true,
      imageUrl: randomBoolean(0.6)
        ? `https://cdn.example.com/categories/${sequence + 1}.jpg`
        : null,
      iconUrl: randomBoolean(0.8)
        ? `https://cdn.example.com/icons/category-${sequence + 1}.svg`
        : null,
      availableHours: {},
      itemCount: 0,
      createdAt: currentTimestamp(),
      updatedAt: currentTimestamp(),
    };

    return {
      ...baseData,
      ...options?.overrides,
    };
  }

  /**
   * 生成完整的餐廳分類集合
   */
  buildRestaurantCategories(restaurantId: number): CategoryTestData[] {
    return [...CommonCategories].map((name, index) =>
      this.build({
        sequence: index,
        relations: { restaurantId },
        overrides: { name, sortOrder: index },
      }),
    );
  }
}

/**
 * 菜單項目工廠
 */
export class MenuItemFactory extends BaseFactory<MenuItemTestData> {
  build(options?: FactoryOptions<MenuItemTestData>): MenuItemTestData {
    const sequence = options?.sequence ?? this.getNextSequence();
    const restaurantId = options?.relations?.restaurantId ?? 1;
    const categoryId = options?.relations?.categoryId ?? 1;
    const categoryName = options?.relations?.categoryName ?? "主菜";

    // 根據分類選擇菜名
    const dishNames =
      DishNames[categoryName as keyof typeof DishNames] || DishNames.主菜;
    const dishName = randomChoice(dishNames);
    const basePrice = randomNumber(50, 500);

    const baseData: MenuItemTestData = {
      id: sequence + 1,
      restaurantId,
      categoryId,
      name: `${dishName} #${sequence + 1}`,
      description: `新鮮美味的${dishName},精心烹調,值得品嚐。`,
      ingredients: "新鮮食材,特製醬料",
      price: basePrice,
      originalPrice: randomBoolean(0.3)
        ? basePrice + randomNumber(20, 100)
        : null,
      costPrice: Math.floor(basePrice * 0.4),
      imageUrl: randomBoolean(0.8)
        ? `https://cdn.example.com/menu/${sequence + 1}.jpg`
        : null,
      imageVariants: {
        thumbnail: `https://cdn.example.com/menu/${sequence + 1}_thumb.jpg`,
        medium: `https://cdn.example.com/menu/${sequence + 1}_medium.jpg`,
        large: `https://cdn.example.com/menu/${sequence + 1}_large.jpg`,
      },
      isAvailable: randomBoolean(0.95),
      isFeatured: randomBoolean(0.2),
      isPopular: randomBoolean(0.3),
      sortOrder: sequence,
      inventoryCount: randomBoolean(0.7) ? randomNumber(10, 100) : null,
      minInventoryAlert: 5,
      spiceLevel: randomNumber(0, 3),
      preparationTime: randomNumber(10, 30),
      calories: randomBoolean(0.6) ? randomNumber(200, 800) : null,
      dietaryInfo: {
        vegetarian: randomBoolean(0.2),
        vegan: randomBoolean(0.1),
        glutenFree: randomBoolean(0.15),
        dairyFree: randomBoolean(0.15),
        nutFree: randomBoolean(0.8),
      },
      allergens: randomBoolean(0.3)
        ? randomChoice([["花生", "堅果"], ["海鮮"], ["蛋", "奶"], ["麩質"]])
        : [],
      options:
        categoryName === "飲料" || categoryName === "套餐"
          ? [
              {
                name: "大小",
                choices: [
                  { label: "小杯", price: 0 },
                  { label: "中杯", price: 10 },
                  { label: "大杯", price: 20 },
                ],
              },
            ]
          : [],
      availableHours: {},
      orderCount: randomNumber(0, 500),
      rating: 3.5 + Math.random() * 1.5,
      reviewCount: randomNumber(0, 100),
      viewCount: randomNumber(0, 1000),
      tags: [categoryName, dishName],
      keywords: `${categoryName},${dishName}`,
      createdAt: currentTimestamp(),
      updatedAt: currentTimestamp(),
    };

    return {
      ...baseData,
      ...options?.overrides,
    };
  }

  /**
   * 生成特定分類的菜單項目
   */
  buildForCategory(
    restaurantId: number,
    categoryId: number,
    categoryName: string,
    count: number = 5,
  ): MenuItemTestData[] {
    return this.buildList(count, {
      relations: { restaurantId, categoryId, categoryName },
    });
  }

  /**
   * 生成熱門菜品
   */
  buildPopular(options?: FactoryOptions<MenuItemTestData>): MenuItemTestData {
    return this.build({
      ...options,
      overrides: {
        isPopular: true,
        isFeatured: true,
        orderCount: randomNumber(100, 500),
        rating: 4.5 + Math.random() * 0.5,
        reviewCount: randomNumber(50, 200),
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成促銷菜品
   */
  buildOnSale(options?: FactoryOptions<MenuItemTestData>): MenuItemTestData {
    const basePrice = randomNumber(100, 400);
    return this.build({
      ...options,
      overrides: {
        price: Math.floor(basePrice * 0.8),
        originalPrice: basePrice,
        isFeatured: true,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成素食菜品
   */
  buildVegetarian(
    options?: FactoryOptions<MenuItemTestData>,
  ): MenuItemTestData {
    return this.build({
      ...options,
      overrides: {
        dietaryInfo: {
          vegetarian: true,
          vegan: randomBoolean(0.5),
          glutenFree: randomBoolean(0.3),
          dairyFree: randomBoolean(0.4),
          nutFree: true,
        },
        allergens: [],
        ...options?.overrides,
      },
    });
  }
}

// 導出單例實例
export const categoryFactory = new CategoryFactory();
export const menuItemFactory = new MenuItemFactory();
