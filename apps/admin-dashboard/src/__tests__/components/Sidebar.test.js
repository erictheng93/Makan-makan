import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Sidebar from '@/components/layout/Sidebar.vue';
import { UserRole } from '@/types';
// Mock Lucide Vue icons
vi.mock('lucide-vue-next', () => ({
    Home: { name: 'Home' },
    ShoppingCart: { name: 'ShoppingCart' },
    Menu: { name: 'Menu' },
    Users: { name: 'Users' },
    Table: { name: 'Table' },
    BarChart3: { name: 'BarChart3' },
    ChefHat: { name: 'ChefHat' },
    Calculator: { name: 'Calculator' },
    Settings: { name: 'Settings' },
    User: { name: 'User' }
}));
describe('Sidebar Component', () => {
    const createWrapper = (authStoreOverrides = {}) => {
        return mount(Sidebar, {
            props: {
                isCollapsed: false
            },
            global: {
                plugins: [
                    createTestingPinia({
                        createSpy: vi.fn,
                        initialState: {
                            auth: {
                                user: {
                                    id: 1,
                                    username: 'testuser',
                                    role: UserRole.OWNER,
                                    restaurantId: 1
                                },
                                isAuthenticated: true,
                                canManageOrders: true,
                                canManageMenu: true,
                                canAccessAdminFeatures: true,
                                canViewKitchen: true,
                                ...authStoreOverrides
                            }
                        }
                    })
                ],
                stubs: {
                    'router-link': {
                        template: '<a><slot /></a>',
                        props: ['to']
                    }
                }
            }
        });
    };
    describe('Rendering', () => {
        it('should render the sidebar with logo', () => {
            const wrapper = createWrapper();
            expect(wrapper.find('.bg-primary-600').text()).toBe('M');
            expect(wrapper.text()).toContain('MakanMakan');
        });
        it('should show user information', () => {
            const wrapper = createWrapper();
            expect(wrapper.text()).toContain('testuser');
            expect(wrapper.text()).toContain('店主'); // Role label for OWNER
        });
        it('should collapse when isCollapsed prop is true', () => {
            const wrapper = mount(Sidebar, {
                props: {
                    isCollapsed: true
                },
                global: {
                    plugins: [createTestingPinia({ createSpy: vi.fn })]
                }
            });
            expect(wrapper.classes()).toContain('w-16');
            expect(wrapper.text()).not.toContain('MakanMakan');
        });
    });
    describe('Navigation Items', () => {
        it('should show all navigation items for owner role', () => {
            const wrapper = createWrapper({
                canManageOrders: true,
                canManageMenu: true,
                canAccessAdminFeatures: true,
                canViewKitchen: true,
                hasPermission: vi.fn(() => true)
            });
            expect(wrapper.text()).toContain('儀表板');
            expect(wrapper.text()).toContain('訂單管理');
            expect(wrapper.text()).toContain('菜單管理');
            expect(wrapper.text()).toContain('桌台管理');
            expect(wrapper.text()).toContain('員工管理');
            expect(wrapper.text()).toContain('數據分析');
            expect(wrapper.text()).toContain('廚房顯示');
            expect(wrapper.text()).toContain('收銀台');
        });
        it('should hide admin-only features for non-admin users', () => {
            const wrapper = createWrapper({
                canAccessAdminFeatures: false,
                hasPermission: vi.fn(() => false)
            });
            expect(wrapper.text()).toContain('儀表板');
            expect(wrapper.text()).not.toContain('桌台管理');
            expect(wrapper.text()).not.toContain('員工管理');
            expect(wrapper.text()).not.toContain('數據分析');
            expect(wrapper.text()).not.toContain('系統設定');
        });
        it('should show limited navigation for service crew', () => {
            const wrapper = createWrapper({
                user: {
                    id: 2,
                    username: 'servicecrew',
                    role: UserRole.SERVICE,
                    restaurantId: 1
                },
                canManageOrders: false,
                canManageMenu: false,
                canAccessAdminFeatures: false,
                canViewKitchen: false,
                hasPermission: vi.fn(() => false)
            });
            expect(wrapper.text()).toContain('儀表板');
            expect(wrapper.text()).not.toContain('訂單管理');
            expect(wrapper.text()).not.toContain('菜單管理');
            expect(wrapper.text()).not.toContain('員工管理');
        });
    });
    describe('Role Labels', () => {
        it('should display correct role labels', () => {
            const wrapper = createWrapper();
            const vm = wrapper.vm;
            expect(vm.getRoleLabel(UserRole.ADMIN)).toBe('系統管理員');
            expect(vm.getRoleLabel(UserRole.OWNER)).toBe('店主');
            expect(vm.getRoleLabel(UserRole.CHEF)).toBe('廚師');
            expect(vm.getRoleLabel(UserRole.SERVICE)).toBe('服務員');
            expect(vm.getRoleLabel(UserRole.CASHIER)).toBe('收銀員');
            expect(vm.getRoleLabel(undefined)).toBe('');
        });
    });
    describe('Route Active State', () => {
        it('should identify active routes correctly', () => {
            const wrapper = createWrapper();
            const vm = wrapper.vm;
            // Mock current route
            const mockRoute = {
                path: '/dashboard/orders'
            };
            vm.$route = mockRoute;
            expect(vm.isActiveRoute('/dashboard')).toBe(true); // Parent route
            expect(vm.isActiveRoute('/dashboard/orders')).toBe(true); // Exact match
            expect(vm.isActiveRoute('/dashboard/menu')).toBe(false); // Different route
        });
    });
    describe('Permissions Integration', () => {
        it('should use auth store permissions correctly', () => {
            const mockHasPermission = vi.fn(() => true);
            const wrapper = createWrapper({
                hasPermission: mockHasPermission
            });
            // The component should call hasPermission for certain items
            expect(wrapper.text()).toContain('收銀台');
            // Verify the permission check was called with correct roles
            // This would depend on the exact implementation
        });
        it('should hide items when user lacks permissions', () => {
            const wrapper = createWrapper({
                canManageOrders: false,
                canManageMenu: false,
                canViewKitchen: false,
                hasPermission: vi.fn(() => false)
            });
            expect(wrapper.text()).not.toContain('訂單管理');
            expect(wrapper.text()).not.toContain('菜單管理');
            expect(wrapper.text()).not.toContain('廚房顯示');
        });
    });
});
