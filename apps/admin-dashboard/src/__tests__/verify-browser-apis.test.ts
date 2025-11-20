/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest'

describe('Browser API Mocks Verification', () => {
  beforeEach(() => {
    // 測試環境已經在 setup.ts 中配置
  })

  describe('localStorage Mock', () => {
    it('should have functional localStorage', () => {
      expect(window.localStorage).toBeDefined()
      expect(typeof window.localStorage.getItem).toBe('function')
      expect(typeof window.localStorage.setItem).toBe('function')
      expect(typeof window.localStorage.removeItem).toBe('function')
      expect(typeof window.localStorage.clear).toBe('function')
    })

    it('should actually store data', () => {
      // 測試真正的存儲功能
      window.localStorage.setItem('test-key', 'test-value')
      const retrieved = window.localStorage.getItem('test-key')

      expect(retrieved).toBe('test-value')
    })

    it('should support multiple items', () => {
      window.localStorage.setItem('key1', 'value1')
      window.localStorage.setItem('key2', 'value2')
      window.localStorage.setItem('key3', 'value3')

      expect(window.localStorage.getItem('key1')).toBe('value1')
      expect(window.localStorage.getItem('key2')).toBe('value2')
      expect(window.localStorage.getItem('key3')).toBe('value3')
    })

    it('should support clear', () => {
      window.localStorage.setItem('key1', 'value1')
      window.localStorage.setItem('key2', 'value2')

      window.localStorage.clear()

      expect(window.localStorage.getItem('key1')).toBeNull()
      expect(window.localStorage.getItem('key2')).toBeNull()
    })

    it('should support removeItem', () => {
      window.localStorage.setItem('key1', 'value1')
      window.localStorage.setItem('key2', 'value2')

      window.localStorage.removeItem('key1')

      expect(window.localStorage.getItem('key1')).toBeNull()
      expect(window.localStorage.getItem('key2')).toBe('value2')
    })

    it('should return null for non-existent keys', () => {
      expect(window.localStorage.getItem('non-existent')).toBeNull()
    })

    it('should persist JSON data', () => {
      const testData = { id: 1, name: 'Test', active: true }
      window.localStorage.setItem('json-data', JSON.stringify(testData))

      const retrieved = window.localStorage.getItem('json-data')
      expect(retrieved).not.toBeNull()

      const parsed = JSON.parse(retrieved!)
      expect(parsed).toEqual(testData)
    })
  })

  describe('URL API Mock', () => {
    it('should have URL.createObjectURL', () => {
      expect(window.URL).toBeDefined()
      expect(typeof window.URL.createObjectURL).toBe('function')
    })

    it('should have URL.revokeObjectURL', () => {
      expect(typeof window.URL.revokeObjectURL).toBe('function')
    })

    it('should create blob URL', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)

      expect(url).toBeDefined()
      expect(typeof url).toBe('string')
      expect(url).toMatch(/^blob:/)
    })

    it('should create unique URLs', () => {
      const blob1 = new Blob(['content 1'], { type: 'text/plain' })
      const blob2 = new Blob(['content 2'], { type: 'text/plain' })

      const url1 = window.URL.createObjectURL(blob1)
      const url2 = window.URL.createObjectURL(blob2)

      expect(url1).not.toBe(url2)
    })

    it('should revoke URL without error', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)

      expect(() => {
        window.URL.revokeObjectURL(url)
      }).not.toThrow()
    })
  })

  describe('Blob Support', () => {
    it('should create Blob', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })

      expect(blob).toBeDefined()
      expect(blob.size).toBeGreaterThan(0)
      expect(blob.type).toBe('text/plain')
    })

    it('should support multiple parts', () => {
      const blob = new Blob(['part 1', 'part 2', 'part 3'], { type: 'text/plain' })

      expect(blob).toBeDefined()
      expect(blob.size).toBeGreaterThan(0)
    })

    it('should support empty Blob', () => {
      const blob = new Blob([], { type: 'application/json' })

      expect(blob).toBeDefined()
      expect(blob.size).toBe(0)
      expect(blob.type).toBe('application/json')
    })
  })

  describe('Integration Test', () => {
    it('should support export workflow', () => {
      // 模擬 exportService 的工作流程
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]

      // 1. 創建 CSV 內容
      const csvContent = data.map(item => `${item.id},${item.name}`).join('\n')

      // 2. 創建 Blob
      const blob = new Blob([csvContent], { type: 'text/csv' })
      expect(blob).toBeDefined()
      expect(blob.size).toBeGreaterThan(0)

      // 3. 創建下載 URL
      const url = window.URL.createObjectURL(blob)
      expect(url).toBeDefined()
      expect(url).toMatch(/^blob:/)

      // 4. 清理
      window.URL.revokeObjectURL(url)

      // 驗證整個流程沒有錯誤
      expect(true).toBe(true)
    })

    it('should support storage workflow', () => {
      // 模擬 monitoringStorage 的工作流程
      const filter = {
        id: 'filter-1',
        name: 'Test Filter',
        data: { search: 'test', severity: 'high' },
      }

      // 1. 保存到 localStorage
      window.localStorage.setItem('test-filter', JSON.stringify(filter))

      // 2. 從 localStorage 讀取
      const retrieved = window.localStorage.getItem('test-filter')
      expect(retrieved).not.toBeNull()

      // 3. 解析 JSON
      const parsed = JSON.parse(retrieved!)
      expect(parsed).toEqual(filter)

      // 4. 更新
      parsed.name = 'Updated Filter'
      window.localStorage.setItem('test-filter', JSON.stringify(parsed))

      // 5. 再次讀取驗證
      const updated = JSON.parse(window.localStorage.getItem('test-filter')!)
      expect(updated.name).toBe('Updated Filter')

      // 6. 刪除
      window.localStorage.removeItem('test-filter')
      expect(window.localStorage.getItem('test-filter')).toBeNull()

      // 驗證整個流程
      expect(true).toBe(true)
    })
  })
})
