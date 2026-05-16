import { describe, expect, it } from 'vitest'
import { pizzaNomePerOrdine } from './pizzaNome'

describe('pizzaNomePerOrdine', () => {
  it('taglia dopo il separatore catalogo', () => {
    expect(pizzaNomePerOrdine("Margherita — Pomodoro, mozzarella")).toBe('Margherita')
  })

  it('senza separatore resta tutto', () => {
    expect(pizzaNomePerOrdine('Marinara')).toBe('Marinara')
  })

  it('trim', () => {
    expect(pizzaNomePerOrdine("  Bufalina — bufala  ")).toBe('Bufalina')
  })
})
