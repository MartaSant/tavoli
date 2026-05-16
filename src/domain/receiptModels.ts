export interface ReceiptModLine {
  nome: string
  prezzoCentesimi: number
}

export interface ReceiptPizzaLine {
  nome: string
  prezzoBaseCentesimi: number
  extras: ReceiptModLine[]
  removals: string[]
  nota: string | null | undefined
}

export interface ReceiptBibitaLine {
  nome: string
  prezzoUnitarioCentesimi: number
  quantita: number
}

export interface ReceiptData {
  nomeOperatore: string | null | undefined
  nomeCliente: string | null | undefined
  nomeTavolo?: string | null
  createdAtMillis: number
  numeroDisplay: number
  orderLabelOverride?: string | null
  pizze: ReceiptPizzaLine[]
  bibite: ReceiptBibitaLine[]
  totaleCentesimi: number
}
