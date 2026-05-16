import { describe, expect, it } from 'vitest'
import { cartHasOrderContent, createNoteOnlyCartLine, isNoteOnlyCartLine } from './orderNoteLine'
import type { CartBibitaLine, CartPizzaLine } from '../data/cartTypes'

describe('orderNoteLine', () => {
  it('detects note-only lines', () => {
    const line = createNoteOnlyCartLine(' senza cipolla ', 1)
    expect(isNoteOnlyCartLine(line)).toBe(true)
    expect(line.nota).toBe('senza cipolla')
  })

  it('cart with only note is valid', () => {
    const note = createNoteOnlyCartLine('ritardo 10 min', 2)
    expect(cartHasOrderContent([note], [])).toBe(true)
  })

  it('empty note line does not count', () => {
    const note = createNoteOnlyCartLine('   ', 1)
    expect(cartHasOrderContent([note], [])).toBe(false)
  })

  it('pizza line still counts', () => {
    const pizza: CartPizzaLine = {
      localId: 3,
      pizzaId: 1,
      nome: 'Margherita',
      prezzoBaseCentesimi: 500,
      mods: [],
      nota: null,
    }
    expect(cartHasOrderContent([pizza], [])).toBe(true)
  })

  it('bibite still count', () => {
    const bibite: CartBibitaLine[] = [
      { localId: 1, bibitaId: 2, nome: 'Acqua', prezzoUnitarioCentesimi: 200, quantita: 1 },
    ]
    expect(cartHasOrderContent([], bibite)).toBe(true)
  })
})
