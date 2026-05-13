import { describe, it, expect } from 'vitest'

describe('Example Test Suite', () => {
  it('should pass basic math', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string operations', () => {
    const greeting = 'Hello, AdBazaar!'
    expect(greeting).toContain('AdBazaar')
    expect(greeting.length).toBeGreaterThan(0)
  })

  it('should handle arrays', () => {
    const items = [1, 2, 3, 4, 5]
    expect(items.length).toBe(5)
    expect(items.filter((n) => n % 2 === 0)).toEqual([2, 4])
  })
})
