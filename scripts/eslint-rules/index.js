/**
 * Testing Utils ESLint 自定義規則集
 *
 * 用途：提供測試相關的 ESLint 規則
 */

module.exports = {
  rules: {
    "enforce-factory-reset": require("./enforce-factory-reset"),
    "prefer-factory-over-manual": require("./prefer-factory-over-manual"),
  },

  configs: {
    recommended: {
      plugins: ["testing-utils"],
      rules: {
        "testing-utils/enforce-factory-reset": "error",
        "testing-utils/prefer-factory-over-manual": "warn",
      },
    },
  },
};
