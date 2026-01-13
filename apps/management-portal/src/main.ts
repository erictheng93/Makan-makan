import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import App from "./App.vue";
import Toast, { type PluginOptions } from "vue-toastification";
import "vue-toastification/dist/index.css";
import "./assets/css/main.css";

const app = createApp(App);
const pinia = createPinia();

// Toast 配置
const toastOptions: PluginOptions = {
  position: "top-right",
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: "button",
  icon: true,
  rtl: false,
};

app.use(pinia);
app.use(router);
app.use(Toast, toastOptions);

// 全局錯誤處理
app.config.errorHandler = (error, instance, info) => {
  console.error("Vue error:", error, info);
  // 可以在這裡發送錯誤到監控系統
};

app.mount("#app");
