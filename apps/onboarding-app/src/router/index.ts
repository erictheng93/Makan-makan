import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/HomeView.vue"),
    meta: { title: "獨立部署申請" },
  },
  {
    path: "/apply",
    name: "Apply",
    component: () => import("@/views/ApplyView.vue"),
    meta: { title: "填寫申請" },
  },
  {
    path: "/connect",
    name: "Connect",
    component: () => import("@/views/ConnectView.vue"),
    meta: { title: "連接 Cloudflare" },
  },
  {
    path: "/success",
    name: "Success",
    component: () => import("@/views/SuccessView.vue"),
    meta: { title: "申請成功" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const title = to.meta.title as string;
  document.title = title ? `${title} - MakanMasak` : "MakanMasak 獨立部署";
  next();
});

export default router;
