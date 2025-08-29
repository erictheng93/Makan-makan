import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { UserRole } from '@/types';
const routes = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/LoginView.vue'),
        meta: { requiresAuth: false, title: '登入' }
    },
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/layouts/DefaultLayout.vue'),
        meta: {
            requiresAuth: true,
            title: '儀表板',
            roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF, UserRole.SERVICE, UserRole.CASHIER]
        },
        children: [
            {
                path: '',
                name: 'DashboardHome',
                component: () => import('@/views/DashboardView.vue')
            },
            {
                path: 'orders',
                name: 'Orders',
                component: () => import('@/views/OrdersView.vue'),
                meta: {
                    title: '訂單管理',
                    roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE, UserRole.CASHIER]
                }
            },
            {
                path: 'menu',
                name: 'Menu',
                component: () => import('@/views/MenuView.vue'),
                meta: {
                    title: '菜單管理',
                    roles: [UserRole.ADMIN, UserRole.OWNER]
                }
            },
            {
                path: 'tables',
                name: 'Tables',
                component: () => import('@/views/TablesView.vue'),
                meta: {
                    title: '桌台管理',
                    roles: [UserRole.ADMIN, UserRole.OWNER]
                }
            },
            {
                path: 'users',
                name: 'Users',
                component: () => import('@/views/UsersView.vue'),
                meta: {
                    title: '員工管理',
                    roles: [UserRole.ADMIN, UserRole.OWNER]
                }
            },
            {
                path: 'analytics',
                name: 'Analytics',
                component: () => import('@/views/AnalyticsView.vue'),
                meta: {
                    title: '數據分析',
                    roles: [UserRole.ADMIN, UserRole.OWNER]
                }
            }
        ]
    },
    {
        path: '/kitchen',
        name: 'Kitchen',
        component: () => import('@/layouts/KitchenLayout.vue'),
        meta: {
            requiresAuth: true,
            title: '廚房顯示',
            roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF]
        },
        children: [
            {
                path: '',
                name: 'KitchenDisplay',
                component: () => import('@/views/KitchenView.vue')
            }
        ]
    },
    {
        path: '/cashier',
        name: 'Cashier',
        component: () => import('@/layouts/CashierLayout.vue'),
        meta: {
            requiresAuth: true,
            title: '收銀台',
            roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER]
        },
        children: [
            {
                path: '',
                name: 'CashierPOS',
                component: () => import('@/views/CashierView.vue')
            }
        ]
    },
    {
        path: '/unauthorized',
        name: 'Unauthorized',
        component: () => import('@/views/UnauthorizedView.vue'),
        meta: { requiresAuth: false, title: '無權限' }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { requiresAuth: false, title: '頁面不存在' }
    }
];
export const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(_, __, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        }
        return { top: 0 };
    }
});
router.beforeEach(async (to, _, next) => {
    const authStore = useAuthStore();
    if (to.meta.requiresAuth === false) {
        if (to.name === 'Login' && authStore.isAuthenticated) {
            return next('/dashboard');
        }
        return next();
    }
    if (!authStore.isAuthenticated) {
        return next('/login');
    }
    const requiredRoles = to.meta.roles;
    if (requiredRoles && requiredRoles.length > 0) {
        const hasPermission = requiredRoles.some(role => authStore.hasPermission(role));
        if (!hasPermission) {
            return next('/unauthorized');
        }
    }
    document.title = `${to.meta.title || 'MakanMakan'} - 管理後台`;
    next();
});
