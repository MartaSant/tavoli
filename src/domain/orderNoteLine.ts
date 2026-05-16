import type { CartBibitaLine, CartPizzaLine } from '../data/cartTypes'

/** Etichetta riga ordine salvata come `orderLinePizza` senza pizza catalogo. */
export const ORDER_NOTE_LINE_NOME = 'Nota'

export function isNoteOnlyCartLine(line: CartPizzaLine): boolean {
  return (
    line.pizzaId == null &&
    line.prezzoBaseCentesimi === 0 &&
    line.nome === ORDER_NOTE_LINE_NOME &&
    line.mods.length === 0
  )
}

export function createNoteOnlyCartLine(text: string, localId: number): CartPizzaLine {
  return {
    localId,
    pizzaId: null,
    nome: ORDER_NOTE_LINE_NOME,
    prezzoBaseCentesimi: 0,
    mods: [],
    nota: text.trim(),
  }
}

export function cartHasOrderContent(pizze: CartPizzaLine[], bibite: CartBibitaLine[]): boolean {
  if (bibite.length > 0) return true
  return pizze.some((line) => {
    if (isNoteOnlyCartLine(line)) return Boolean(line.nota?.trim())
    return true
  })
}
