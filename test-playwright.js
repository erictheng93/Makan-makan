import { test, expect } from '@playwright/test'

test('基本 Playwright 測試', async ({ page }) => {
  // 測試是否能訪問一個簡單的 HTML 頁面
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head><title>測試頁面</title></head>
      <body>
        <h1 data-testid="title">Hello Playwright</h1>
        <button data-testid="test-btn">點擊我</button>
        <div data-testid="result" style="display:none;">測試成功</div>
        <script>
          document.querySelector('[data-testid="test-btn"]').addEventListener('click', function() {
            document.querySelector('[data-testid="result"]').style.display = 'block'
          })
        </script>
      </body>
    </html>
  `
  
  await page.setContent(htmlContent)
  
  // 檢查標題
  await expect(page.locator('[data-testid="title"]')).toContainText('Hello Playwright')
  
  // 點擊按鈕
  await page.locator('[data-testid="test-btn"]').click()
  
  // 檢查結果顯示
  await expect(page.locator('[data-testid="result"]')).toBeVisible()
  await expect(page.locator('[data-testid="result"]')).toContainText('測試成功')
})