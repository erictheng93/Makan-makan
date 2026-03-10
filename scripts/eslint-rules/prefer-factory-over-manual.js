/**
 * ESLint 自定義規則：建議使用 factory 而非手動創建測試數據
 *
 * 用途：
 * - 檢測手動創建測試數據的模式
 * - 建議使用 factory 替代
 * - 提供遷移指南
 */

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "建議使用 factory 而非手動創建測試數據",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      preferFactory:
        "建議使用 {{factoryName}} 而非手動創建 {{dataType}} 數據。參考：docs/testing/FACTORY_QUICK_REFERENCE.md",
      considerFactory:
        "發現手動創建測試數據，考慮使用 testing-utils factory 簡化代碼",
    },
  },

  create(context) {
    const filename = context.getFilename();

    // 只檢查測試文件
    if (!filename.includes(".test.ts") && !filename.includes(".spec.ts")) {
      return {};
    }

    // 數據類型到 factory 的映射
    const dataTypeToFactory = {
      // User 相關
      role: "userFactory",
      username: "userFactory",
      email: "userFactory",
      fullName: "userFactory",

      // Restaurant 相關
      restaurantName: "restaurantFactory",
      shopMode: "restaurantFactory",
      restaurantId: "restaurantFactory",

      // Menu 相關
      categoryName: "categoryFactory",
      menuItemName: "menuItemFactory",
      price: "menuItemFactory",

      // Order 相關
      orderStatus: "orderFactory",
      totalAmount: "orderFactory",
      orderItems: "orderItemFactory",
    };

    return {
      // 檢查對象字面量
      ObjectExpression(node) {
        // 跳過小對象（少於 3 個屬性）
        if (node.properties.length < 3) {
          return;
        }

        const propertyNames = node.properties
          .filter((prop) => prop.key && prop.key.type === "Identifier")
          .map((prop) => prop.key.name);

        // 檢測是否為測試數據對象
        let detectedDataType = null;
        let suggestedFactory = null;

        for (const [key, factory] of Object.entries(dataTypeToFactory)) {
          if (propertyNames.includes(key)) {
            detectedDataType = key;
            suggestedFactory = factory;
            break;
          }
        }

        // 如果檢測到測試數據，建議使用 factory
        if (detectedDataType && suggestedFactory) {
          // 檢查是否已經在使用 factory
          let parent = node.parent;
          let isFromFactory = false;

          while (parent) {
            if (
              parent.type === "CallExpression" &&
              parent.callee.type === "MemberExpression" &&
              parent.callee.property.name === "build"
            ) {
              isFromFactory = true;
              break;
            }
            parent = parent.parent;
          }

          if (!isFromFactory) {
            context.report({
              node,
              messageId: "preferFactory",
              data: {
                factoryName: suggestedFactory,
                dataType: detectedDataType,
              },
            });
          }
        }

        // 檢測通用的大型對象字面量（可能是測試數據）
        if (node.properties.length >= 5 && !detectedDataType) {
          context.report({
            node,
            messageId: "considerFactory",
          });
        }
      },
    };
  },
};
