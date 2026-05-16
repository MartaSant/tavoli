export interface CartModLine {
  modificatoreId: number | null
  nome: string
  tipo: string
  prezzoCentesimi: number
}

export interface CartPizzaLine {
  localId: number
  pizzaId: number | null
  nome: string
  prezzoBaseCentesimi: number
  mods: CartModLine[]
  nota: string | null
  inviataInCucina?: boolean
}

export function lineTotalPizza(line: CartPizzaLine): number {
  return line.prezzoBaseCentesimi + line.mods.filter((m) => m.tipo === 'EXTRA').reduce((s, m) => s + m.prezzoCentesimi, 0)
}

export interface CartBibitaLine {
  localId: number
  bibitaId: number | null
  nome: string
  prezzoUnitarioCentesimi: number
  quantita: number
  inviataInCucina?: boolean
}

export function lineTotalBibita(line: CartBibitaLine): number {
  return line.prezzoUnitarioCentesimi * line.quantita
}

export interface OrderCartLoad {
  nomeCliente: string | null
  tableId?: number | null
  nomeTavoloSnapshot?: string | null
  pizze: CartPizzaLine[]
  bibite: CartBibitaLine[]
  /** Se valorizzato, alla conferma ordine quegli ordini e i riepiloghi stampati del tavolo vengono sostituiti. */
  sessionOrderIdsToReplaceOnSave?: number[] | null
}

export function newLocalId(): number {
  return Math.floor(performance.now() * 1e6 + Math.random() * 1e9)
}
