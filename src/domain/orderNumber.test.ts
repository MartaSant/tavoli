import { describe, expect, it } from 'vitest'
import { OrderNumberService } from './orderNumber'

describe('OrderNumberService', () => {
  it('formats with padding', () => {
    expect(OrderNumberService.formatDisplay(1)).toBe('01')
    expect(OrderNumberService.formatDisplay(99)).toBe('99')
  })

  it('nextAfter wraps', () => {
    expect(OrderNumberService.nextAfter(99)).toBe(1)
    expect(OrderNumberService.nextAfter(5)).toBe(6)
  })
})
