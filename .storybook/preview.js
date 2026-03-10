/**
 * Storybook Preview Configuration
 *
 * Global decorators and parameters for visual testing
 */

import { setup } from "@storybook/vue3";
import { createPinia } from "pinia";
import "../apps/admin-dashboard/src/assets/styles/main.css"; // Import global styles

// Setup Vue 3 plugins
const pinia = createPinia();
setup((app) => {
  app.use(pinia);
});

// Global parameters for all stories
export const parameters = {
  // Configure viewport addon
  viewport: {
    viewports: {
      mobile: {
        name: "Mobile",
        styles: { width: "375px", height: "667px" },
      },
      tablet: {
        name: "Tablet",
        styles: { width: "768px", height: "1024px" },
      },
      desktop: {
        name: "Desktop",
        styles: { width: "1440px", height: "900px" },
      },
      wide: {
        name: "Wide Desktop",
        styles: { width: "1920px", height: "1080px" },
      },
    },
  },

  // Configure actions addon
  actions: { argTypesRegex: "^on[A-Z].*" },

  // Configure controls addon
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },

  // Chromatic configuration
  chromatic: {
    // Delay before snapshot (ms)
    delay: 300,

    // Pause animations
    pauseAnimationAtEnd: true,

    // Disable animations for consistent snapshots
    disableSnapshot: false,

    // Force re-snapshot even if story hasn't changed
    forcedReRender: false,
  },

  // Backgrounds addon
  backgrounds: {
    default: "light",
    values: [
      {
        name: "light",
        value: "#ffffff",
      },
      {
        name: "dark",
        value: "#1a202c",
      },
      {
        name: "gray",
        value: "#f7fafc",
      },
    ],
  },
};

// Global decorators
export const decorators = [
  (story) => ({
    components: { story },
    template: '<div style="padding: 1rem;"><story /></div>',
  }),
];
