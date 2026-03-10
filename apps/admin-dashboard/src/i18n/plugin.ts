import { initI18n } from "./index";

/**
 * Vue plugin for i18n
 * Separated to avoid export conflicts during build
 */
export default {
  install: async () => {
    await initI18n();
  },
};
