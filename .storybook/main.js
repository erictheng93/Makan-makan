/**
 * Storybook Configuration for Visual Regression Testing
 *
 * Integrated with Chromatic for automated visual testing
 */

const path = require("path"); // eslint-disable-line @typescript-eslint/no-require-imports

module.exports = {
  stories: [
    "../apps/**/*.stories.@(js|jsx|ts|tsx|mdx)",
    "../packages/shared/**/*.stories.@(js|jsx|ts|tsx|mdx)",
  ],

  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y", // Accessibility testing
    "@storybook/addon-viewport", // Responsive testing
    "@chromatic-com/storybook", // Chromatic integration
  ],

  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },

  docs: {
    autodocs: "tag",
  },

  // Chromatic-specific settings
  chromatic: {
    // Delay before capturing to ensure animations complete
    delay: 300,

    // Disable animations for consistent snapshots
    disableAnimations: true,

    // Pause animations at specific point
    pauseAnimationAtEnd: true,

    // Viewports to test
    viewports: [375, 768, 1024, 1440, 1920],

    // Threshold for acceptable visual differences (%)
    diffThreshold: 0.05,
  },

  // Performance optimizations
  core: {
    disableTelemetry: true,
  },

  viteFinal: async (config) => {
    // Customize Vite config for Storybook
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "../"),
    };

    return config;
  },
};
