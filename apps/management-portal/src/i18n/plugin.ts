import { initI18n } from "./index";

/**
 * Vue plugin for management-portal i18n
 */
export default {
  install: async () => {
    await initI18n();
  },
};
