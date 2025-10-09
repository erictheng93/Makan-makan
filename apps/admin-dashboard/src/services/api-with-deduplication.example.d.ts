/**
 * API Service with Request Deduplication - Implementation Example
 *
 * This file demonstrates how to integrate request deduplication into your API service
 */
declare const api: import("axios").AxiosInstance;
export declare function getRestaurant(id: number): Promise<any>;
export declare function getMenu(restaurantId: number): Promise<any>;
export declare function createOrder(restaurantId: number, orderData: any): Promise<any>;
export declare function getAnalytics(restaurantId: number, period: string): Promise<any>;
export declare function useRestaurantAPI(): {
    fetchRestaurant: (id: number) => Promise<any>;
    fetchMenu: (restaurantId: number) => Promise<any>;
};
export declare function cleanupAPI(): void;
/**
 * Real-world scenario: Dashboard loading
 *
 * Problem: Dashboard loads restaurant data, menu, and analytics simultaneously
 * Multiple components request the same data, causing duplicate API calls
 *
 * Solution: With deduplication, all components share the same requests
 */
export declare function loadDashboard(restaurantId: number): Promise<{
    restaurant: any;
    menu: any;
    analytics: any;
}>;
/**
 * Real-world scenario: User rapid clicking
 *
 * Problem: User rapidly clicks "Refresh" button, triggering multiple requests
 * Solution: Deduplication prevents duplicate requests within cache window
 */
export declare function refreshOrders(restaurantId: number): Promise<any>;
export default api;
