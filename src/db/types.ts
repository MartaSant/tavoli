export interface UserEntity {
  id?: number
  username: string
  /** lower(trim(username)), univoco (Dexie &usernameNorm) */
  usernameNorm: string
  pinHash: string
  role: string
  attivo: boolean
}

export interface PizzaEntity {
  id?: number
  nome: string
  prezzoCentesimi: number
  attiva: boolean
  ordineVisualizzazione: number
}

export interface ModificatoreEntity {
  id?: number
  nome: string
  prezzoCentesimi: number
  attiva: boolean
  ordineVisualizzazione: number
}

export interface BibitaEntity {
  id?: number
  nome: string
  prezzoCentesimi: number
  attiva: boolean
  ordineVisualizzazione: number
}

export interface AppStateEntity {
  id: number
  wizardCompletato: boolean
  nomePizzeria: string
  recoveryCodeHash: string
  nextOrderNumber: number
  confirmFeedback: string
  printerMac: string | null
  themeMode: string
}

export interface OrderEntity {
  id?: number
  numeroDisplay: number
  nomeCliente: string | null
  tableId?: number | null
  nomeTavoloSnapshot?: string | null
  createdAt: number
  totaleCentesimi: number
  createdByUserId: number
  receiptSnapshot: string
}

export interface TavoloEntity {
  id?: number
  nome: string
  nomeNorm: string
  attivo: boolean
  lastPrintedAtMillis: number
  /** > 0 quando la comanda sessione è stata inviata in cucina. */
  comandaInviataAtMillis: number
}

export interface TablePrintLogEntity {
  id?: number
  tableId: number
  printedAtMillis: number
  summaryText: string
}

export interface OrderLinePizzaEntity {
  id?: number
  orderId: number
  pizzaId: number | null
  nomeSnapshot: string
  prezzoBaseSnapshot: number
  noteLibere: string | null
  lineIndex: number
  /** false = evidenziata nel riepilogo sessione */
  inviataInCucina: boolean
}

export interface OrderLinePizzaModEntity {
  id?: number
  pizzaLineId: number
  modificatoreId: number | null
  nome: string
  tipo: string
  prezzoCentesimi: number
}

export interface OrderLineBibitaEntity {
  id?: number
  orderId: number
  bibitaId: number | null
  nomeSnapshot: string
  prezzoUnitarioSnapshot: number
  quantita: number
  inviataInCucina: boolean
}

export const defaultAppState = (): AppStateEntity => ({
  id: 1,
  wizardCompletato: false,
  nomePizzeria: '',
  recoveryCodeHash: '',
  nextOrderNumber: 1,
  confirmFeedback: 'VIBRATE',
  printerMac: null,
  themeMode: 'SYSTEM',
})
