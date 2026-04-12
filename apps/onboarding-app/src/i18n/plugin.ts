import { initI18n } from "./index";

/**
 * Vue plugin for onboarding-app i18n
 */
export default {
  install: async () => {
    await initI18n();
  },
};
