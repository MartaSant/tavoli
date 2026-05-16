/** Handoff scontrino → pagina ricevuta senza mettere il testo in `location.state` (limiti di serializzazione / lunghezza). */
const KEY = 'tavoli_receiptNavHandoff_v1'

const MAIN_TAB_AFTER_RECEIPT_KEY = 'tavoli_mainTabAfterReceipt_v1'

/** Dopo riepilogo sessione: commit DB solo se l'utente conferma chiusura tavolo. */
const PENDING_SESSION_PRINT_DECISION_KEY = 'tavoli_pendingSessionPrintDecision_v1'

export type TableSessionPrintPayload = { tableId: number; summaryText: string }

export function stageReceiptNavigation(
  snapshot: string,
  preview: boolean,
  returnMainTab?: number,
  tableSessionPrint?: TableSessionPrintPayload,
): void {
  try {
    const payload: {
      snapshot: string
      preview: boolean
      returnMainTab?: number
      tableSessionPrint?: TableSessionPrintPayload
    } = { snapshot, preview }
    if (returnMainTab !== undefined) payload.returnMainTab = returnMainTab
    if (tableSessionPrint != null) payload.tableSessionPrint = tableSessionPrint
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* quota o storage disabilitato: niente da fare, ReceiptPage reindirizza */
  }
}

export function readReceiptNavigationStaging(): {
  snapshot: string
  preview: boolean
  returnMainTab?: number
  tableSessionPrint?: TableSessionPrintPayload
} | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw == null) return null
    const o = JSON.parse(raw) as {
      snapshot?: unknown
      preview?: unknown
      returnMainTab?: unknown
      tableSessionPrint?: unknown
    }
    if (typeof o.snapshot !== 'string') return null
    const returnMainTab =
      typeof o.returnMainTab === 'number' && Number.isFinite(o.returnMainTab) ? o.returnMainTab : undefined
    let tableSessionPrint: TableSessionPrintPayload | undefined
    const tsp = o.tableSessionPrint
    if (tsp != null && typeof tsp === 'object' && !Array.isArray(tsp)) {
      const t = tsp as Record<string, unknown>
      const tableId = Number(t.tableId)
      const summaryText = typeof t.summaryText === 'string' ? t.summaryText : ''
      if (Number.isFinite(tableId) && summaryText !== '') {
        tableSessionPrint = { tableId, summaryText }
      }
    }
    return { snapshot: o.snapshot, preview: Boolean(o.preview), returnMainTab, tableSessionPrint }
  } catch {
    return null
  }
}

export function clearReceiptNavigationStaging(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Chiamare da ReceiptPage prima di tornare a /main: MainScreen legge e rimuove al mount. */
export function stashMainTabForReturnFromReceipt(mainTab: number): void {
  try {
    sessionStorage.setItem(MAIN_TAB_AFTER_RECEIPT_KEY, String(mainTab))
  } catch {
    /* ignore */
  }
}

export function takeMainTabAfterReceipt(): number | null {
  try {
    const v = sessionStorage.getItem(MAIN_TAB_AFTER_RECEIPT_KEY)
    sessionStorage.removeItem(MAIN_TAB_AFTER_RECEIPT_KEY)
    if (v == null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function stashPendingSessionPrintDecision(payload: TableSessionPrintPayload): void {
  try {
    sessionStorage.setItem(PENDING_SESSION_PRINT_DECISION_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/** Legge e rimuove il payload per decidere se registrare chiusura sessione + disattivare tavolo. */
export function takePendingSessionPrintDecision(): TableSessionPrintPayload | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SESSION_PRINT_DECISION_KEY)
    sessionStorage.removeItem(PENDING_SESSION_PRINT_DECISION_KEY)
    if (raw == null) return null
    const o = JSON.parse(raw) as { tableId?: unknown; summaryText?: unknown }
    const tableId = Number(o.tableId)
    const summaryText = typeof o.summaryText === 'string' ? o.summaryText : ''
    if (!Number.isFinite(tableId) || summaryText === '') return null
    return { tableId, summaryText }
  } catch {
    return null
  }
}
