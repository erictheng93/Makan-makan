import { createRouter, createWebHistory } from 'vue-router';
const routes = [
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
];
export function createTestRouter() {
    return createRouter({
        history: createWebHistory(),
        routes
    });
}
