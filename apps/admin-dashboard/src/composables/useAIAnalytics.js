/**
 * Composable for AI Analytics API
 * Clean, type-safe API interactions
 */
import { ref } from 'vue';
const API_BASE = '/api/v1/ai-analytics';
export function useAIAnalytics() {
    const loading = ref(false);
    const error = ref(null);
    // Helper function for API calls
    async function fetchAPI(endpoint, options = {}) {
        loading.value = true;
        error.value = null;
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            const data = await response.json();
            return data;
        }
        catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('AI Analytics API Error:', err);
            return null;
        }
        finally {
            loading.value = false;
        }
    }
    // AI Configuration APIs
    const getConfig = async (restaurantId) => {
        const data = await fetchAPI(`/config/${restaurantId}`, {
            method: 'GET',
        });
        return data;
    };
    const saveConfig = async (configData) => {
        const data = await fetchAPI('/config', {
            method: 'POST',
            body: JSON.stringify(configData),
        });
        return data || { success: false, message: 'Failed to save configuration' };
    };
    const testProvider = async (testData) => {
        const data = await fetchAPI('/test-provider', {
            method: 'POST',
            body: JSON.stringify(testData),
        });
        return data || { success: false, error: 'Test failed' };
    };
    const getAvailableModels = async (provider) => {
        const data = await fetchAPI(`/models/${provider}`, {
            method: 'GET',
        });
        return data?.models || [];
    };
    // AI Report Generation
    const generateReport = async (restaurantId, timeRange, options = {}) => {
        const data = await fetchAPI('/generate', {
            method: 'POST',
            body: JSON.stringify({
                restaurantId,
                timeRange,
                ...options,
            }),
        });
        return data?.report || null;
    };
    // Product Analytics APIs
    const getTrafficDrivers = async (restaurantId, timeRange = '30d', limit = 10) => {
        const data = await fetchAPI(`/products/traffic-drivers/${restaurantId}?timeRange=${timeRange}&limit=${limit}`, { method: 'GET' });
        return data?.products || [];
    };
    const getBestsellers = async (restaurantId, timeRange = '30d', limit = 10) => {
        const data = await fetchAPI(`/products/bestsellers/${restaurantId}?timeRange=${timeRange}&limit=${limit}`, { method: 'GET' });
        return data?.products || [];
    };
    const getProfitLeaders = async (restaurantId, timeRange = '30d', limit = 10) => {
        const data = await fetchAPI(`/products/profit-leaders/${restaurantId}?timeRange=${timeRange}&limit=${limit}`, { method: 'GET' });
        return data?.products || [];
    };
    const getAllProductAnalysis = async (restaurantId, timeRange = '30d') => {
        const data = await fetchAPI(`/products/analysis/${restaurantId}?timeRange=${timeRange}`, { method: 'GET' });
        return data?.products || [];
    };
    // Usage Stats API
    const getUsageStats = async (restaurantId, startDate, endDate) => {
        let url = `/usage/${restaurantId}`;
        const params = new URLSearchParams();
        if (startDate)
            params.append('startDate', startDate);
        if (endDate)
            params.append('endDate', endDate);
        if (params.toString())
            url += `?${params.toString()}`;
        const data = await fetchAPI(url, { method: 'GET' });
        return data?.usage || [];
    };
    return {
        loading,
        error,
        getConfig,
        saveConfig,
        testProvider,
        getAvailableModels,
        generateReport,
        getTrafficDrivers,
        getBestsellers,
        getProfitLeaders,
        getAllProductAnalysis,
        getUsageStats,
    };
}
