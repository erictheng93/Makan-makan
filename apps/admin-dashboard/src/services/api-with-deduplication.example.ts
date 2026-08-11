/**
 * API Service with Request Deduplication - Implementation Example
 *
 * This file demonstrates how to integrate request deduplication into your API service
 */

import axios from "axios";
import {
  installAxiosDeduplication,
  skipDedup,
  withDedupTTL,
  combineConfigs,
} from "@makanmasak/utils";

// Create Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Install request deduplication interceptor
const cleanupDeduplication = installAxiosDeduplication(api, {
  cacheDuration: 5000, // 5 seconds default cache
  maxCacheSize: 100,
  debug: import.meta.env.DEV,
});

// Example 1: Basic usage - automatic deduplication
export async function getRestaurant(id: number) {
  // Multiple simultaneous calls will be deduplicated automatically
  const response = await api.get(`/restaurants/${id}`);
  return response.data;
}

// Example 2: Custom cache duration
export async function getMenu(restaurantId: number) {
  // Cache menu data for 30 seconds (longer than default)
  const response = await api.get(
    `/restaurants/${restaurantId}/menu`,
    withDedupTTL(30000),
  );
  return response.data;
}

// Example 3: Skip deduplication for specific requests
export async function createOrder(restaurantId: number, orderData: any) {
  // Don't deduplicate POST requests that create new resources
  const response = await api.post(
    `/restaurants/${restaurantId}/orders`,
    orderData,
    skipDedup(),
  );
  return response.data;
}

// Example 4: Combine options
export async function getAnalytics(restaurantId: number, period: string) {
  const response = await api.get(
    `/restaurants/${restaurantId}/analytics`,
    combineConfigs(
      withDedupTTL(60000), // Cache for 1 minute
      {
        params: { period },
        headers: { "X-Analytics-Version": "v2" },
      },
    ),
  );
  return response.data;
}

// Example 5: Using with composables
export function useRestaurantAPI() {
  // Multiple components calling this will share the same request
  const fetchRestaurant = async (id: number) => {
    return getRestaurant(id);
  };

  const fetchMenu = async (restaurantId: number) => {
    return getMenu(restaurantId);
  };

  return {
    fetchRestaurant,
    fetchMenu,
  };
}

// Cleanup function (call when app unmounts)
export function cleanupAPI() {
  cleanupDeduplication();
}

/**
 * Real-world scenario: Dashboard loading
 *
 * Problem: Dashboard loads restaurant data, menu, and analytics simultaneously
 * Multiple components request the same data, causing duplicate API calls
 *
 * Solution: With deduplication, all components share the same requests
 */
export async function loadDashboard(restaurantId: number) {
  // Even if multiple components call these simultaneously,
  // only one request per endpoint will be made
  const [restaurant, menu, analytics] = await Promise.all([
    getRestaurant(restaurantId),
    getMenu(restaurantId),
    getAnalytics(restaurantId, "today"),
  ]);

  return { restaurant, menu, analytics };
}

/**
 * Real-world scenario: User rapid clicking
 *
 * Problem: User rapidly clicks "Refresh" button, triggering multiple requests
 * Solution: Deduplication prevents duplicate requests within cache window
 */
export async function refreshOrders(restaurantId: number) {
  // Even if user clicks refresh 10 times in 5 seconds,
  // only ONE request will be made (cached for 5s by default)
  const response = await api.get(`/restaurants/${restaurantId}/orders`);
  return response.data;
}

export default api;
