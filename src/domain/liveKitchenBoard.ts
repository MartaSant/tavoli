import { ORDER_NOTE_LINE_NOME } from './orderNoteLine'

export interface LiveKitchenPizzaLine {
  primary: string
  sublines: string[]
}

export interface LiveKitchenTableBlock {
  tableId: number
  tableName: string
  pizze: LiveKitchenPizzaLine[]
}

export function isNoteOnlyPizzaRow(nome: string, prezzoBaseCentesimi: number): boolean {
  return nome === ORDER_NOTE_LINE_NOME && prezzoBaseCentesimi === 0
}

export function toLiveKitchenPizzaLine(input: {
  nome: string
  prezzoBaseCentesimi: number
  extras: { nome: string }[]
  removals: string[]
  nota: string | null | undefined
}): LiveKitchenPizzaLine | null {
  if (isNoteOnlyPizzaRow(input.nome, input.prezzoBaseCentesimi)) return null
  const sublines: string[] = []
  for (const e of input.extras) sublines.push(`+ ${e.nome}`)
  for (const r of input.removals) sublines.push(`− ${r}`)
  if (input.nota?.trim()) sublines.push(`Nota: ${input.nota.trim()}`)
  return { primary: input.nome, sublines }
}
