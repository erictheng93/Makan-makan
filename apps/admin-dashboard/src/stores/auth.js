import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import { UserRole } from '@/types';
import { api } from '@/services/api';
export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const token = ref(localStorage.getItem('auth_token'));
    const isLoading = ref(false);
    const isAuthenticated = computed(() => !!user.value && !!token.value);
    const userRole = computed(() => user.value?.role);
    const restaurantId = computed(() => user.value?.restaurantId);
    const hasPermission = (requiredRole) => {
        if (!user.value)
            return false;
        const userRoleValue = user.value.role;
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        return roles.includes(userRoleValue);
    };
    const canAccessAdminFeatures = computed(() => hasPermission([UserRole.ADMIN, UserRole.OWNER]));
    const canManageOrders = computed(() => hasPermission([UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE, UserRole.CASHIER]));
    const canManageMenu = computed(() => hasPermission([UserRole.ADMIN, UserRole.OWNER]));
    const canViewKitchen = computed(() => hasPermission([UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF]));
    const login = async (username, password) => {
        isLoading.value = true;
        try {
            const response = await api.post('/auth/login', { username, password });
            if (response.data.success && response.data.data) {
                token.value = response.data.data.token;
                user.value = response.data.data.user;
                localStorage.setItem('auth_token', token.value);
                api.setAuthToken(token.value);
                return { success: true };
            }
            return { success: false, error: response.data.error?.message || 'Login failed' };
        }
        catch (error) {
            return {
                success: false,
                error: error.response?.data?.error?.message || '登入失敗'
            };
        }
        finally {
            isLoading.value = false;
        }
    };
    const logout = async () => {
        try {
            await api.post('/auth/logout');
        }
        catch (error) {
            console.warn('Logout request failed:', error);
        }
        finally {
            user.value = null;
            token.value = null;
            localStorage.removeItem('auth_token');
            api.setAuthToken(null);
        }
    };
    const checkAuth = async () => {
        if (!token.value)
            return false;
        try {
            api.setAuthToken(token.value);
            const response = await api.get('/auth/me');
            if (response.data.success && response.data.data) {
                user.value = response.data.data;
                return true;
            }
        }
        catch (error) {
            console.warn('Auth check failed:', error);
        }
        await logout();
        return false;
    };
    const refreshToken = async () => {
        try {
            const response = await api.post('/auth/refresh');
            if (response.data.success && response.data.data) {
                token.value = response.data.data.token;
                localStorage.setItem('auth_token', token.value);
                api.setAuthToken(token.value);
                return true;
            }
        }
        catch (error) {
            await logout();
            return false;
        }
    };
    return {
        user: readonly(user),
        token: readonly(token),
        isLoading: readonly(isLoading),
        isAuthenticated,
        userRole,
        restaurantId,
        hasPermission,
        canAccessAdminFeatures,
        canManageOrders,
        canManageMenu,
        canViewKitchen,
        login,
        logout,
        checkAuth,
        refreshToken
    };
});
