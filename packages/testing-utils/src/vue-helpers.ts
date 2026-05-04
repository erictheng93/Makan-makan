/**
 * Vue Test Helpers
 *
 * 提供 Vue 組件測試的共享工具函數
 * 獨立導出路徑，避免非 Vue 套件拉入 Vue 依賴
 *
 * 使用方式：import { mountWithPlugins, createAuthState } from "@makanmasak/testing-utils/vue-helpers"
 */

import { mount, type VueWrapper } from "@vue/test-utils";
import { createTestingPinia, type TestingOptions } from "@pinia/testing";
import { vi } from "vitest";
import type { ComponentMountingOptions } from "@vue/test-utils";
import type { Component } from "vue";
import type { Router } from "vue-router";

/**
 * 擴展 mount 選項以支持 router 和 pinia
 */
export interface MountWithPluginsOptions<
  T = any,
> extends ComponentMountingOptions<T> {
  router?: Router;
  piniaOptions?: TestingOptions;
}

/**
 * Mount 組件並自動注入 Pinia 和 Router
 *
 * @example
 * const wrapper = mountWithPlugins(MyComponent, {
 *   props: { title: "Test" },
 *   router: myRouter,
 *   piniaOptions: {
 *     initialState: createAuthState({ role: 0 })
 *   }
 * });
 */
export function mountWithPlugins(
  component: Component,
  options: MountWithPluginsOptions = {},
): VueWrapper<any> {
  const { router, piniaOptions = {}, ...mountOptions } = options;

  const plugins: any[] = [
    ...(mountOptions.global?.plugins || []),
    createTestingPinia({
      createSpy: vi.fn,
      ...piniaOptions,
    }),
  ];

  if (router) {
    plugins.push(router);
  }

  const mergedOptions: ComponentMountingOptions<any> = {
    ...mountOptions,
    global: {
      ...(mountOptions.global || {}),
      plugins,
      mocks: {
        ...(mountOptions.global?.mocks || {}),
        ...(router ? { $router: router, $route: router.currentRoute } : {}),
      },
      provide: {
        ...(mountOptions.global?.provide || {}),
        ...(router ? { router, route: router.currentRoute } : {}),
      },
      stubs: {
        ...(mountOptions.global?.stubs || {}),
        "router-link": {
          template: "<a><slot /></a>",
          props: ["to"],
        },
        transition: false,
        "transition-group": false,
      },
    },
  };

  return mount(component, mergedOptions);
}

/**
 * 為 Pinia store 創建認證初始狀態
 *
 * @example
 * mountWithPlugins(MyComponent, {
 *   piniaOptions: {
 *     initialState: createAuthState({ role: 0 })  // Admin
 *   }
 * });
 */
export function createAuthState(overrides: Record<string, any> = {}) {
  return {
    auth: {
      user: {
        id: 1,
        username: "testuser",
        role: 1,
        restaurantId: 1,
      },
      isAuthenticated: true,
      canManageOrders: true,
      canManageMenu: true,
      canAccessAdminFeatures: true,
      ...overrides,
    },
  };
}

/**
 * 等待 Vue 更新和 Promise 解析
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 等待指定的毫秒數
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 模擬用戶輸入
 */
export async function setInputValue(
  wrapper: VueWrapper<any>,
  selector: string,
  value: string,
): Promise<void> {
  const input = wrapper.find(selector);
  await input.setValue(value);
  await wrapper.vm.$nextTick();
}

/**
 * 模擬用戶點擊
 */
export async function clickElement(
  wrapper: VueWrapper<any>,
  selector: string,
): Promise<void> {
  const element = wrapper.find(selector);
  await element.trigger("click");
  await wrapper.vm.$nextTick();
}
