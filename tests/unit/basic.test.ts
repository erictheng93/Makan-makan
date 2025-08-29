import { describe, it, expect } from 'vitest'

describe('基本測試', () => {
  it('數學運算正確', () => {
    expect(2 + 2).toBe(4)
    expect(5 * 3).toBe(15)
    expect(10 / 2).toBe(5)
  })

  it('字串操作正確', () => {
    expect('hello'.toUpperCase()).toBe('HELLO')
    expect('WORLD'.toLowerCase()).toBe('world')
    expect('test'.length).toBe(4)
  })

  it('陣列操作正確', () => {
    const arr = [1, 2, 3]
    expect(arr.length).toBe(3)
    expect(arr.includes(2)).toBe(true)
    expect(arr.map(x => x * 2)).toEqual([2, 4, 6])
  })

  it('物件操作正確', () => {
    const obj = { name: '測試', age: 25 }
    expect(obj.name).toBe('測試')
    expect(obj.age).toBe(25)
    expect(Object.keys(obj)).toEqual(['name', 'age'])
  })

  it('布林值操作正確', () => {
    expect(true).toBe(true)
    expect(false).toBe(false)
    expect(!true).toBe(false)
    expect(!false).toBe(true)
  })

  it('非同步操作正確', async () => {
    const promise = Promise.resolve('success')
    const result = await promise
    expect(result).toBe('success')
  })

  it('錯誤處理正確', () => {
    expect(() => {
      throw new Error('測試錯誤')
    }).toThrow('測試錯誤')
  })

  it('型別檢查正確', () => {
    expect(typeof 'string').toBe('string')
    expect(typeof 123).toBe('number')
    expect(typeof true).toBe('boolean')
    expect(typeof {}).toBe('object')
    expect(typeof []).toBe('object')
    expect(Array.isArray([])).toBe(true)
  })
})