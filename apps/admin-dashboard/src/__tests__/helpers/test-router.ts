import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: { template: '<div>Dashboard</div>' }
  },
  {
    path: '/queue',
    name: 'Queue',
    component: { template: '<div>Queue</div>' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: { template: '<div>Settings</div>' }
  }
]

export function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes
  })
}