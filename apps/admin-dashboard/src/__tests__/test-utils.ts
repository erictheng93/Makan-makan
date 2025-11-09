/**
 * Test Utilities
 * 提供測試輔助函數，確保正確的測試環境配置
 */

import { mount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia, TestingOptions } from '@pinia/testing';
import { vi } from 'vitest';
import { mockRouter } from './setup';
import type { ComponentMountingOptions } from '@vue/test-utils';

/**
 * 擴展 mount 選項以支持 router
 */
export interface MountOptions<T = any> extends ComponentMountingOptions<T> {
  router?: typeof mockRouter;
  piniaOptions?: TestingOptions;
}

/**
 * Mount 組件並自動注入 router 和 pinia
 *
 * @example
 * const wrapper = mountWithRouter(MyComponent, {
 *   props: { ... },
 *   piniaOptions: {
 *     initialState: { auth: { user: {...} } }
 *   }
 * });
 */
export function mountWithRouter<T>(
  component: T,
  options: MountOptions = {}
): VueWrapper<any> {
  const {
    router = mockRouter,
    piniaOptions = {},
    ...mountOptions
  } = options;

  // 合併 global 配置
  const mergedOptions: ComponentMountingOptions<any> = {
    ...mountOptions,
    global: {
      ...(mountOptions.global || {}),

      // 合併 plugins
      plugins: [
        ...(mountOptions.global?.plugins || []),
        createTestingPinia({
          createSpy: vi.fn,
          ...piniaOptions,
        }),
        router,  // 添加 router 作為插件
      ],

      // 合併 mocks
      mocks: {
        ...(mountOptions.global?.mocks || {}),
        $router: router,
        $route: router.currentRoute,
      },

      // 合併 provide
      provide: {
        ...(mountOptions.global?.provide || {}),
        router,
        route: router.currentRoute,
      },

      // 合併 stubs
      stubs: {
        ...(mountOptions.global?.stubs || {}),
        'router-link': {
          template: '<a><slot /></a>',
          props: ['to'],
        },
        'transition': false,
        'transition-group': false,
      },
    },
  };

  return mount(component as any, mergedOptions);
}

/**
 * 為 Pinia store 創建初始狀態
 *
 * @example
 * const wrapper = mountWithRouter(MyComponent, {
 *   piniaOptions: {
 *     initialState: createAuthState({ role: UserRole.ADMIN })
 *   }
 * });
 */
export function createAuthState(overrides: Record<string, any> = {}) {
  return {
    auth: {
      user: {
        id: 1,
        username: 'testuser',
        role: 1,
        restaurantId: 1,
      },
      isAuthenticated: true,
      canManageOrders: true,
      canManageMenu: true,
      canAccessAdminFeatures: true,
      canViewKitchen: true,
      ...overrides,
    },
  };
}

/**
 * 等待 Vue 更新和 Promise 解析
 */
export async function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 等待指定的毫秒數
 */
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 模擬用戶輸入
 */
export async function setInputValue(
  wrapper: VueWrapper<any>,
  selector: string,
  value: string
) {
  const input = wrapper.find(selector);
  await input.setValue(value);
  await wrapper.vm.$nextTick();
}

/**
 * 模擬用戶點擊
 */
export async function clickElement(
  wrapper: VueWrapper<any>,
  selector: string
) {
  const element = wrapper.find(selector);
  await element.trigger('click');
  await wrapper.vm.$nextTick();
}

export { mockRouter };
