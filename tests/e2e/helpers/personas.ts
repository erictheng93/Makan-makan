/**
 * E2E Test Personas
 *
 * Pre-built user personas for E2E tests.
 * Each persona contains credentials, role info, and context needed for login mocking.
 */

export interface Persona {
  username: string;
  password: string;
  role: number;
  id: number;
  fullName: string;
  email: string;
  restaurantId: string;
  token: string;
  refreshToken: string;
}

const RESTAURANT_ID = "rest-e2e-001";

export const PERSONAS = {
  ADMIN: {
    username: "admin-e2e",
    password: "Test1234!",
    role: 0,
    id: 1,
    fullName: "E2E Admin",
    email: "admin@e2e.test",
    restaurantId: RESTAURANT_ID,
    token: "mock-admin-jwt-token",
    refreshToken: "mock-admin-refresh-token",
  },
  OWNER: {
    username: "owner-e2e",
    password: "Test1234!",
    role: 1,
    id: 100,
    fullName: "E2E Owner",
    email: "owner@e2e.test",
    restaurantId: RESTAURANT_ID,
    token: "mock-owner-jwt-token",
    refreshToken: "mock-owner-refresh-token",
  },
  CHEF: {
    username: "chef-e2e",
    password: "Test1234!",
    role: 2,
    id: 201,
    fullName: "E2E Chef",
    email: "chef@e2e.test",
    restaurantId: RESTAURANT_ID,
    token: "mock-chef-jwt-token",
    refreshToken: "mock-chef-refresh-token",
  },
  SERVICE_CREW: {
    username: "service-e2e",
    password: "Test1234!",
    role: 3,
    id: 301,
    fullName: "E2E Service",
    email: "service@e2e.test",
    restaurantId: RESTAURANT_ID,
    token: "mock-service-jwt-token",
    refreshToken: "mock-service-refresh-token",
  },
  CASHIER: {
    username: "cashier-e2e",
    password: "Test1234!",
    role: 4,
    id: 401,
    fullName: "E2E Cashier",
    email: "cashier@e2e.test",
    restaurantId: RESTAURANT_ID,
    token: "mock-cashier-jwt-token",
    refreshToken: "mock-cashier-refresh-token",
  },
  CUSTOMER: {
    username: "customer-e2e",
    password: "Test1234!",
    role: 5,
    id: 501,
    fullName: "E2E Customer",
    email: "customer@e2e.test",
    restaurantId: RESTAURANT_ID,
    token: "mock-customer-jwt-token",
    refreshToken: "mock-customer-refresh-token",
  },
} satisfies Record<string, Persona>;

export const RESTAURANT = {
  id: RESTAURANT_ID,
  name: "E2E \u6e2c\u8a66\u9910\u5ef3",
  description: "\u7f8e\u5473\u7684\u6e2c\u8a66\u9910\u5ef3",
  address: "\u53f0\u5317\u5e02\u4fe1\u7fa9\u5340\u6e2c\u8a66\u8def 123 \u865f",
  phone: "02-1234-5678",
  logoUrl: "https://placehold.co/200x200?text=E2E",
  status: "active",
  shopModeEnabled: true,
  settings: {
    enableDineIn: true,
    enableTakeaway: true,
    enableDelivery: true,
    autoAcceptOrders: false,
    estimatedPrepTime: 15,
    deliveryFee: 60,
  },
};

export const TABLE = {
  id: "table-e2e-001",
  number: "A-1",
  capacity: 4,
  status: "available",
  restaurantId: RESTAURANT_ID,
  qrCode: "qr-table-e2e-001",
};

export const MENU_CATEGORIES = [
  {
    id: "cat-1",
    name: "\u9eba\u98df",
    restaurantId: RESTAURANT_ID,
    sortOrder: 0,
  },
  {
    id: "cat-2",
    name: "\u98ef\u985e",
    restaurantId: RESTAURANT_ID,
    sortOrder: 1,
  },
  {
    id: "cat-3",
    name: "\u98f2\u6599",
    restaurantId: RESTAURANT_ID,
    sortOrder: 2,
  },
];

export const MENU_ITEMS = [
  {
    id: "item-1",
    name: "\u725b\u8089\u9eba",
    description: "\u9999\u6fc3\u6e6f\u982d\u914d\u8edf\u5ae9\u725b\u8089",
    price: 18000,
    categoryId: "cat-1",
    restaurantId: RESTAURANT_ID,
    imageUrl: "https://placehold.co/300x200?text=Noodles",
    available: true,
    customizations: {
      sizes: [
        { id: "s1", name: "\u5c0f", priceDiff: 0 },
        { id: "s2", name: "\u5927", priceDiff: 3000 },
      ],
      options: [
        {
          groupName: "\u8fa3\u5ea6",
          items: [
            { id: "o1", name: "\u4e0d\u8fa3", priceDiff: 0 },
            { id: "o2", name: "\u5c0f\u8fa3", priceDiff: 0 },
            { id: "o3", name: "\u5927\u8fa3", priceDiff: 0 },
          ],
        },
      ],
      addOns: [
        { id: "a1", name: "\u52a0\u86cb", price: 1500 },
        { id: "a2", name: "\u52a0\u9752\u83dc", price: 1000 },
      ],
    },
  },
  {
    id: "item-2",
    name: "\u6392\u9aa8\u98ef",
    description: "\u9999\u8108\u9165\u70b8\u6392\u9aa8",
    price: 16000,
    categoryId: "cat-2",
    restaurantId: RESTAURANT_ID,
    imageUrl: "https://placehold.co/300x200?text=Rice",
    available: true,
  },
  {
    id: "item-3",
    name: "\u73cd\u73e0\u5976\u8336",
    description: "\u7d93\u5178\u53f0\u7063\u5976\u8336",
    price: 6000,
    categoryId: "cat-3",
    restaurantId: RESTAURANT_ID,
    imageUrl: "https://placehold.co/300x200?text=Tea",
    available: true,
  },
  {
    id: "item-4",
    name: "\u6c34\u9905",
    description: "\u624b\u5de5\u9bae\u8089\u6c34\u9905",
    price: 8000,
    categoryId: "cat-1",
    restaurantId: RESTAURANT_ID,
    imageUrl: "https://placehold.co/300x200?text=Dumpling",
    available: false,
  },
];

export function createMockOrder(overrides: Record<string, any> = {}) {
  return {
    id: "order-e2e-001",
    orderNumber: "ORD-20260330-001",
    restaurantId: RESTAURANT_ID,
    tableId: TABLE.id,
    tableName: TABLE.number,
    status: 0,
    items: [
      {
        id: "oi-1",
        menuItemId: "item-1",
        menuItemName: "\u725b\u8089\u9eba",
        quantity: 1,
        unitPrice: 18000,
        totalPrice: 18000,
        customizations: { size: "\u5c0f", spice: "\u5c0f\u8fa3" },
        notes: "",
      },
      {
        id: "oi-2",
        menuItemId: "item-3",
        menuItemName: "\u73cd\u73e0\u5976\u8336",
        quantity: 2,
        unitPrice: 6000,
        totalPrice: 12000,
      },
    ],
    subtotal: 30000,
    tax: 0,
    total: 30000,
    customerName: "\u6e2c\u8a66\u9867\u5ba2",
    customerPhone: "0912345678",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
