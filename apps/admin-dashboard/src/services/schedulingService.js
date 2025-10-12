/**
 * Employee Scheduling Service
 * API client for employee scheduling and shift management
 */
import axios from 'axios';
class SchedulingService {
    constructor() {
        Object.defineProperty(this, "api", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseURL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1';
        this.api = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Add auth token interceptor
        this.api.interceptors.request.use((config) => {
            const token = localStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
        // Add response interceptor for error handling
        this.api.interceptors.response.use((response) => response, (error) => {
            if (error.response?.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('authToken');
                window.location.href = '/login';
            }
            return Promise.reject(error);
        });
    }
    // ========================================
    // Shift Template Management
    // ========================================
    /**
     * Get all shift templates for a restaurant
     */
    async getShiftTemplates(restaurantId) {
        const response = await this.api.get(`/scheduling/${restaurantId}/templates`);
        return response.data.data;
    }
    /**
     * Get a specific shift template
     */
    async getShiftTemplate(id) {
        const response = await this.api.get(`/scheduling/templates/${id}`);
        return response.data.data;
    }
    /**
     * Create a new shift template
     */
    async createShiftTemplate(restaurantId, data) {
        const response = await this.api.post(`/scheduling/${restaurantId}/templates`, data);
        return response.data.data;
    }
    /**
     * Update a shift template
     */
    async updateShiftTemplate(id, data) {
        const response = await this.api.put(`/scheduling/templates/${id}`, data);
        return response.data.data;
    }
    /**
     * Delete a shift template
     */
    async deleteShiftTemplate(id) {
        await this.api.delete(`/scheduling/templates/${id}`);
    }
    // ========================================
    // Employee Schedule Management
    // ========================================
    /**
     * Get employee schedules with filters
     */
    async getSchedules(filters) {
        const { restaurantId, ...params } = filters;
        const response = await this.api.get(`/scheduling/${restaurantId}/schedules`, { params });
        return response.data;
    }
    /**
     * Get a specific schedule
     */
    async getSchedule(id) {
        const response = await this.api.get(`/scheduling/schedules/${id}`);
        return response.data.data;
    }
    /**
     * Create a new schedule
     */
    async createSchedule(restaurantId, data) {
        const response = await this.api.post(`/scheduling/${restaurantId}/schedules`, data);
        return response.data.data;
    }
    /**
     * Update a schedule
     */
    async updateSchedule(id, data) {
        const response = await this.api.put(`/scheduling/schedules/${id}`, data);
        return response.data.data;
    }
    /**
     * Delete (cancel) a schedule
     */
    async deleteSchedule(id) {
        await this.api.delete(`/scheduling/schedules/${id}`);
    }
    /**
     * Bulk create schedules
     */
    async bulkCreateSchedules(restaurantId, data) {
        const response = await this.api.post(`/scheduling/${restaurantId}/schedules/bulk`, data);
        return response.data.data;
    }
    // ========================================
    // Available Employees (Leave Integration)
    // ========================================
    /**
     * Get available employees for scheduling on a specific date
     * Filters out employees on approved leave
     */
    async getAvailableEmployees(restaurantId, date, shiftTemplateId) {
        const params = { date };
        if (shiftTemplateId) {
            params.shiftTemplateId = shiftTemplateId;
        }
        const response = await this.api.get(`/scheduling/${restaurantId}/available-employees`, { params });
        return response.data.data;
    }
    // ========================================
    // Clock In/Out
    // ========================================
    /**
     * Clock in to a shift
     */
    async clockIn(id, data) {
        const response = await this.api.post(`/scheduling/schedules/${id}/clock-in`, data);
        return response.data.data;
    }
    /**
     * Clock out from a shift
     */
    async clockOut(id, data) {
        const response = await this.api.post(`/scheduling/schedules/${id}/clock-out`, data);
        return response.data.data;
    }
    // ========================================
    // Conflict Management
    // ========================================
    /**
     * Get scheduling conflicts
     */
    async getConflicts(filters) {
        const { restaurantId, ...params } = filters;
        const response = await this.api.get(`/scheduling/${restaurantId}/conflicts`, { params });
        return response.data;
    }
    /**
     * Resolve a conflict
     */
    async resolveConflict(id, userId, resolutionNotes) {
        const response = await this.api.post(`/scheduling/conflicts/${id}/resolve`, { userId, resolutionNotes });
        return response.data.data;
    }
    // ========================================
    // Swap Request Management
    // ========================================
    /**
     * Get swap requests
     */
    async getSwapRequests(filters) {
        const { restaurantId, ...params } = filters;
        const response = await this.api.get(`/scheduling/${restaurantId}/swap-requests`, { params });
        return response.data;
    }
    /**
     * Create a swap request
     */
    async createSwapRequest(restaurantId, data) {
        const response = await this.api.post(`/scheduling/${restaurantId}/swap-requests`, data);
        return response.data.data;
    }
    /**
     * Approve a swap request
     */
    async approveSwapRequest(id, managerId) {
        const response = await this.api.post(`/scheduling/swap-requests/${id}/approve`, { managerId });
        return response.data.data;
    }
    /**
     * Reject a swap request
     */
    async rejectSwapRequest(id, managerId, reason) {
        const response = await this.api.post(`/scheduling/swap-requests/${id}/reject`, { managerId, reason });
        return response.data.data;
    }
    // ========================================
    // Statistics & Analytics
    // ========================================
    /**
     * Get daily scheduling statistics
     */
    async getDailyStats(restaurantId, date) {
        const response = await this.api.get(`/scheduling/${restaurantId}/stats/daily`, { params: { date } });
        return response.data.data;
    }
    /**
     * Get weekly summary
     */
    async getWeeklySummary(restaurantId, weekStartDate) {
        const response = await this.api.get(`/scheduling/${restaurantId}/stats/weekly`, { params: { weekStartDate } });
        return response.data.data;
    }
}
// Export singleton instance
export const schedulingService = new SchedulingService();
export default schedulingService;
