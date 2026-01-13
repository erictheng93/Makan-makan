import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Dashboard",
    component: () => import("@/views/DashboardView.vue"),
    meta: { title: "總覽" },
  },
  {
    path: "/tenants",
    name: "Tenants",
    component: () => import("@/views/TenantsView.vue"),
    meta: { title: "租戶管理" },
  },
  {
    path: "/tenants/:id",
    name: "TenantDetail",
    component: () => import("@/views/TenantDetailView.vue"),
    meta: { title: "租戶詳情" },
  },
  {
    path: "/deployments",
    name: "Deployments",
    component: () => import("@/views/DeploymentsView.vue"),
    meta: { title: "部署管理" },
  },
  {
    path: "/health",
    name: "Health",
    component: () => import("@/views/HealthView.vue"),
    meta: { title: "健康監控" },
  },
  {
    path: "/licenses",
    name: "Licenses",
    component: () => import("@/views/LicensesView.vue"),
    meta: { title: "授權管理" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
    meta: { title: "頁面不存在" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 設置頁面標題
router.beforeEach((to, _from, next) => {
  const title = to.meta.title as string;
  document.title = title
    ? `${title} - MakanMakan 管理平台`
    : "MakanMakan 管理平台";
  next();
});

export default router;
