/**
 * ESLint 自定義規則：強制在測試文件中使用 resetAllFactories()
 *
 * 用途：
 * - 檢測測試文件是否導入了 factory
 * - 如果使用了 factory，確保有 resetAllFactories() 調用
 * - 提供自動修復建議
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "強制在使用 factory 的測試文件中調用 resetAllFactories()",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [],
    messages: {
      missingReset:
        "測試文件使用了 factory 但缺少 resetAllFactories() 調用。建議在 beforeEach 中添加。",
      missingImport: "缺少 resetAllFactories 的導入",
    },
  },

  create(context) {
    const filename = context.getFilename();

    // 只檢查測試文件
    if (!filename.includes(".test.ts") && !filename.includes(".spec.ts")) {
      return {};
    }

    let hasFactoryImport = false;
    let hasResetAllFactoriesImport = false;
    let hasResetAllFactoriesCall = false;
    let factoryImportNode = null;
    let lastImportNode = null;

    // Factory 使用模式
    const factoryPatterns = [
      "userFactory",
      "restaurantFactory",
      "categoryFactory",
      "menuItemFactory",
      "orderFactory",
      "orderItemFactory",
      "buildCompleteRestaurantData",
    ];

    return {
      // 檢查導入語句
      ImportDeclaration(node) {
        lastImportNode = node;

        // 檢查是否從 @makanmakan/testing-utils 導入
        if (node.source.value === "@makanmakan/testing-utils") {
          hasFactoryImport = true;
          factoryImportNode = node;

          // 檢查是否導入了 resetAllFactories
          node.specifiers.forEach((spec) => {
            if (
              spec.type === "ImportSpecifier" &&
              spec.imported.name === "resetAllFactories"
            ) {
              hasResetAllFactoriesImport = true;
            }
          });
        }
      },

      // 檢查函數調用
      CallExpression(node) {
        // 檢查 resetAllFactories() 調用
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "resetAllFactories"
        ) {
          hasResetAllFactoriesCall = true;
        }

        // 檢查是否使用了 factory
        if (node.callee.type === "MemberExpression") {
          const objectName = node.callee.object.name;
          if (factoryPatterns.includes(objectName)) {
            hasFactoryImport = true;
          }
        }

        // 檢查 buildCompleteRestaurantData
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "buildCompleteRestaurantData"
        ) {
          hasFactoryImport = true;
        }
      },

      // 程序結束時檢查
      "Program:exit"(node) {
        if (hasFactoryImport && !hasResetAllFactoriesCall) {
          // 如果沒有導入 resetAllFactories，報告導入錯誤
          if (!hasResetAllFactoriesImport && factoryImportNode) {
            context.report({
              node: factoryImportNode,
              messageId: "missingImport",
              fix(fixer) {
                // 自動添加 resetAllFactories 到導入列表
                const importSpecifiers = factoryImportNode.specifiers
                  .map((s) => s.local.name)
                  .concat(["resetAllFactories"])
                  .join(", ");

                return fixer.replaceText(
                  factoryImportNode,
                  `import { ${importSpecifiers} } from '@makanmakan/testing-utils'`,
                );
              },
            });
          }

          // 報告缺少調用的錯誤
          context.report({
            node: lastImportNode || node,
            messageId: "missingReset",
            fix(fixer) {
              // 嘗試在文件開頭添加 beforeEach
              const programBody = node.body;

              // 找到第一個 describe 或 test 塊
              let insertPosition = null;
              for (const statement of programBody) {
                if (
                  statement.type === "ExpressionStatement" &&
                  statement.expression.type === "CallExpression"
                ) {
                  const callee = statement.expression.callee;
                  if (
                    callee.type === "Identifier" &&
                    (callee.name === "describe" || callee.name === "test")
                  ) {
                    insertPosition = statement.range[0];
                    break;
                  }
                }
              }

              if (insertPosition !== null) {
                const beforeEachCode = `\nbeforeEach(() => {\n  resetAllFactories()\n})\n\n`;
                return fixer.insertTextBeforeRange(
                  [insertPosition, insertPosition],
                  beforeEachCode,
                );
              }

              return null;
            },
          });
        }
      },
    };
  },
};
