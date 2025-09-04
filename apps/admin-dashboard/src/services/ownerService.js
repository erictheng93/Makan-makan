class OwnerService {
    constructor() {
        Object.defineProperty(this, "baseURL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: '/api/v1'
        });
        // 緩存管理
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    async getDashboardData(restaurantId) {
        try {
            const params = new URLSearchParams();
            if (restaurantId) {
                params.append('restaurantId', restaurantId.toString());
            }
            const response = await fetch(`${this.baseURL}/analytics/owner-dashboard?${params}`);
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to fetch dashboard data');
            }
            return result.data;
        }
        catch (error) {
            console.error('Error fetching dashboard data:', error);
            throw error;
        }
    }
    async getFinancialReport(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.restaurantId) {
                params.append('restaurantId', options.restaurantId.toString());
            }
            if (options.period) {
                params.append('period', options.period);
            }
            if (options.year) {
                params.append('year', options.year);
            }
            if (options.month) {
                params.append('month', options.month);
            }
            const response = await fetch(`${this.baseURL}/analytics/financial-report?${params}`);
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to fetch financial report');
            }
            return result.data;
        }
        catch (error) {
            console.error('Error fetching financial report:', error);
            throw error;
        }
    }
    async getRealtimeOrders(restaurantId) {
        try {
            const params = new URLSearchParams();
            if (restaurantId) {
                params.append('restaurantId', restaurantId.toString());
            }
            const response = await fetch(`${this.baseURL}/analytics/realtime-dashboard?${params}`);
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to fetch realtime orders');
            }
            return result.data?.active_orders || [];
        }
        catch (error) {
            console.error('Error fetching realtime orders:', error);
            throw error;
        }
    }
    async getStaffActivity(_restaurantId) {
        try {
            // 模擬員工活動數據，實際應該從 API 獲取
            return [
                { id: 1, name: '張小明', role: '廚師', status: 'online', performance: 98 },
                { id: 2, name: '李美華', role: '送菜員', status: 'busy', performance: 95 },
                { id: 3, name: '王大偉', role: '收銀員', status: 'online', performance: 92 },
                { id: 4, name: '陳小芳', role: '廚師', status: 'offline', performance: 88 }
            ];
        }
        catch (error) {
            console.error('Error fetching staff activity:', error);
            throw error;
        }
    }
    async handleQuickAction(action) {
        try {
            console.log('Executing quick action:', action);
            switch (action) {
                case 'add-staff':
                    // 跳轉到員工管理頁面或打開新增員工彈窗
                    window.location.href = '/dashboard/users';
                    break;
                case 'update-menu':
                    // 跳轉到菜單管理頁面
                    window.location.href = '/dashboard/menu';
                    break;
                case 'view-reports':
                    // 跳轉到報表頁面
                    window.location.href = '/dashboard/analytics';
                    break;
                case 'system-settings':
                    // 跳轉到系統設定頁面
                    window.location.href = '/dashboard/settings';
                    break;
                case 'send-notification':
                    // 打開通知發送介面
                    this.showNotificationDialog();
                    break;
                case 'emergency':
                    // 處理緊急狀況
                    this.handleEmergency();
                    break;
                default:
                    console.log('Unknown action:', action);
            }
        }
        catch (error) {
            console.error('Error handling quick action:', error);
            throw error;
        }
    }
    showNotificationDialog() {
        // 實現通知發送對話框
        alert('通知發送功能將在此實現');
    }
    handleEmergency() {
        // 實現緊急處理功能
        alert('緊急處理功能將在此實現');
    }
    async resolveEmergencyAlert(alertId) {
        try {
            const response = await fetch(`${this.baseURL}/alerts/${alertId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to resolve alert');
            }
            console.log('Emergency alert resolved:', alertId);
        }
        catch (error) {
            console.error('Error resolving emergency alert:', error);
            throw error;
        }
    }
    async escalateEmergencyAlert(alertId) {
        try {
            const response = await fetch(`${this.baseURL}/alerts/${alertId}/escalate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to escalate alert');
            }
            console.log('Emergency alert escalated:', alertId);
        }
        catch (error) {
            console.error('Error escalating emergency alert:', error);
            throw error;
        }
    }
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
        return null;
    }
    setCachedData(key, data, ttl = 60000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    async getDashboardDataCached(restaurantId) {
        const cacheKey = `dashboard-${restaurantId || 'all'}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) {
            return cached;
        }
        const data = await this.getDashboardData(restaurantId);
        this.setCachedData(cacheKey, data, 30000); // 30秒緩存
        return data;
    }
    clearCache() {
        this.cache.clear();
    }
}
export const ownerService = new OwnerService();
export default ownerService;
