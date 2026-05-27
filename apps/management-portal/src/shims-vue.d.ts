/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_MANAGEMENT_API_URL: string;
  readonly VITE_ADMIN_DASHBOARD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
