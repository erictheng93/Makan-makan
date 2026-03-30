import type { Page } from "@playwright/test";

/**
 * Apple-Native Soft Minimalism 設計系統合規性檢查
 *
 * 程式化驗證 CSS 屬性是否符合設計規範
 * 參考：docs/UIUX-design-system.md
 */

/** 設計系統預期值 */
export const DESIGN_TOKENS = {
  pageBg: "rgb(242, 242, 247)", // #F2F2F7
  cardBg: "rgb(255, 255, 255)", // #FFFFFF
  primaryText: "rgb(28, 28, 30)", // #1C1C1E
  pureBlack: "rgb(0, 0, 0)", // 禁止使用
  minCardBorderRadius: 16, // rounded-2xl = 1rem = 16px
  maxShadowOpacity: 0.08, // 8%
} as const;

export interface DesignSystemOptions {
  /** 跳過頁面背景色檢查（某些頁面如 login 可能有不同背景） */
  skipBgCheck?: boolean;
  /** 跳過文字色檢查 */
  skipTextCheck?: boolean;
  /** 跳過卡片圓角檢查 */
  skipCardRadiusCheck?: boolean;
  /** 跳過陰影透明度檢查 */
  skipShadowCheck?: boolean;
}

/**
 * 執行設計系統合規性檢查
 *
 * @returns 違規項目陣列，空陣列表示完全合規
 */
export async function checkDesignSystem(
  page: Page,
  options: DesignSystemOptions = {},
): Promise<string[]> {
  return page.evaluate(
    ({ tokens, opts }) => {
      const violations: string[] = [];

      // 1. 頁面背景色 = #F2F2F7
      if (!opts.skipBgCheck) {
        // 依序檢查 body → #app → 第一個 min-h-screen 容器
        const candidates = [
          document.body,
          document.getElementById("app"),
          document.querySelector(".min-h-screen"),
        ].filter(Boolean) as Element[];

        let effectiveBg = "rgba(0, 0, 0, 0)";
        for (const el of candidates) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)") {
            effectiveBg = bg;
            break;
          }
        }

        if (
          effectiveBg !== tokens.pageBg &&
          effectiveBg !== "rgba(0, 0, 0, 0)"
        ) {
          violations.push(
            `頁面背景色應為 ${tokens.pageBg}，實際為 ${effectiveBg}`,
          );
        }
      }

      // 2. 文字不使用純黑 rgb(0,0,0)
      if (!opts.skipTextCheck) {
        const textElements = document.querySelectorAll(
          "h1, h2, h3, h4, h5, h6, p, span, a, label, li, td, th, div",
        );
        let blackTextCount = 0;
        const blackTextExamples: string[] = [];

        textElements.forEach((el) => {
          const text = el.textContent?.trim();
          if (!text || text.length === 0) return;

          // 跳過沒有直接文字內容的容器
          const directText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent?.trim())
            .filter(Boolean)
            .join("");
          if (!directText) return;

          const color = getComputedStyle(el).color;
          if (color === tokens.pureBlack) {
            blackTextCount++;
            if (blackTextExamples.length < 3) {
              const tag = el.tagName.toLowerCase();
              const preview =
                directText.length > 20
                  ? directText.substring(0, 20) + "..."
                  : directText;
              blackTextExamples.push(`<${tag}>"${preview}"`);
            }
          }
        });

        if (blackTextCount > 0) {
          violations.push(
            `發現 ${blackTextCount} 個元素使用純黑 rgb(0,0,0)，應使用 #1C1C1E。` +
              `範例：${blackTextExamples.join(", ")}`,
          );
        }
      }

      // 3. Card 元素的 border-radius ≥ 16px (rounded-2xl)
      if (!opts.skipCardRadiusCheck) {
        const cardSelectors = [
          '[class*="card"]',
          '[class*="Card"]',
          '[data-testid*="card"]',
          '[class*="rounded-2xl"]',
          '[class*="rounded-3xl"]',
        ];

        const cards = document.querySelectorAll(cardSelectors.join(", "));
        let underRadiusCount = 0;

        cards.forEach((el) => {
          const radius = parseFloat(getComputedStyle(el).borderRadius || "0");
          // 只檢查看起來像 card 的元素（有背景色、有一定尺寸）
          const bg = getComputedStyle(el).backgroundColor;
          const rect = el.getBoundingClientRect();
          const isVisibleCard =
            bg === tokens.cardBg && rect.width > 100 && rect.height > 50;

          if (isVisibleCard && radius < tokens.minCardBorderRadius) {
            underRadiusCount++;
          }
        });

        if (underRadiusCount > 0) {
          violations.push(
            `發現 ${underRadiusCount} 個 card 元素 border-radius < ${tokens.minCardBorderRadius}px，` +
              `應使用 rounded-2xl (16px) 或更大`,
          );
        }
      }

      // 4. Shadow opacity ≤ 8%
      if (!opts.skipShadowCheck) {
        const allElements = document.querySelectorAll("*");
        let highShadowCount = 0;

        allElements.forEach((el) => {
          const shadow = getComputedStyle(el).boxShadow;
          if (!shadow || shadow === "none") return;

          // 分割多重 shadow（逗號分隔）
          // 排除 Tailwind ring shadow（格式: 0 0 0 Npx color，spread-only 無 blur）
          const isRingShadow = /^(rgba?\([^)]+\)\s+)?0px 0px 0px \d+px/.test(
            shadow,
          );
          if (isRingShadow) return;

          // 解析 rgba 中的 alpha 值
          const rgbaMatches = shadow.matchAll(
            /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+)\s*)?\)/g,
          );
          for (const match of rgbaMatches) {
            const alpha = match[1] ? parseFloat(match[1]) : 1;
            // 排除 ring shadow 中的 alpha（ring 通常有 0px 0px 0px 格式）
            if (alpha > tokens.maxShadowOpacity + 0.02) {
              // 加 2% 容差
              highShadowCount++;
              break;
            }
          }
        });

        if (highShadowCount > 0) {
          violations.push(
            `發現 ${highShadowCount} 個元素的 shadow opacity > ${tokens.maxShadowOpacity * 100}%，` +
              `應使用軟陰影（opacity ≤ 8%）`,
          );
        }
      }

      return violations;
    },
    { tokens: DESIGN_TOKENS, opts: options },
  );
}
