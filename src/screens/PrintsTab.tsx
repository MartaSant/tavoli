import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { useOrderCart } from '../context/OrderCartContext'
import { getAppState, recreateTavoloFromPrintLog } from '../data/repositories'
import { db } from '../db/database'
import { onOrderConfirmed } from '../util/feedback'

type PrintRow = {
  id?: number
  tableId: number
  printedAtMillis: number
  summaryText: string
  nomeTavolo: string
}

export function PrintsTab({ onGoToTavoli }: { onGoToTavoli: () => void }) {
  const { user } = useSession()
  const cart = useOrderCart()
  const rows = useLiveQuery(async () => {
    const logs = await db.tablePrintLog.orderBy('printedAtMillis').reverse().limit(80).toArray()
    return Promise.all(
      logs.map(async (l) => {
        const t = await db.tavoli.get(l.tableId)
        return { ...l, nomeTavolo: t?.nome ?? `Tavolo #${l.tableId}` }
      }),
    )
  }, [])
  const [msg, setMsg] = useState<string | null>(null)
  const [recreateTarget, setRecreateTarget] = useState<PrintRow | null>(null)
  const [recreateNome, setRecreateNome] = useState('')
  const [replaceCartPending, setReplaceCartPending] = useState<PrintRow | null>(null)
  const [busy, setBusy] = useState(false)

  function openRecreateDialog(row: PrintRow) {
    setMsg(null)
    setRecreateNome(row.nomeTavolo)
    setRecreateTarget(row)
  }

  async function applyRecreate(row: PrintRow, nome: string) {
    if (!user?.id) {
      setMsg('Non autenticato')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await recreateTavoloFromPrintLog(row.id!, nome, user.id, user.username)
      const state = await getAppState()
      if (state) await onOrderConfirmed(state.confirmFeedback)
      cart.resetCart()
      setRecreateTarget(null)
      setReplaceCartPending(null)
      onGoToTavoli()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  function onRecreateClick(row: PrintRow) {
    if (cart.isCartNonEmpty()) {
      setReplaceCartPending(row)
      setRecreateNome(row.nomeTavolo)
      return
    }
    openRecreateDialog(row)
  }

  async function confirmRecreate() {
    if (!recreateTarget?.id) return
    const nome = recreateNome.trim()
    if (!nome) {
      setMsg('Inserisci il nome del nuovo tavolo')
      return
    }
    await applyRecreate(recreateTarget, nome)
  }

  return (
    <div className="stack">
      <h2 className="section-title">Ultime stampe sessione</h2>
      <p className="hint">
        Seleziona una stampa per creare un nuovo tavolo con lo stesso riepilogo già salvato.
      </p>
      {msg && <p className="error">{msg}</p>}
      <ul className="history-list">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="card history-card">
            <div className="row-between wrap">
              <div>
                <div className="hint">{format(r.printedAtMillis, 'dd/MM/yyyy HH:mm', { locale: it })}</div>
                <strong>{r.nomeTavolo}</strong>
              </div>
              <button type="button" className="small-btn" onClick={() => onRecreateClick(r)}>
                Ricrea tavolo
              </button>
            </div>
            <pre className="receipt-pre" style={{ fontSize: '11px', maxHeight: '8rem', overflow: 'auto' }}>
              {r.summaryText}
            </pre>
          </li>
        ))}
      </ul>
      {(rows?.length ?? 0) === 0 && <p className="hint">Nessuna stampa sessione registrata.</p>}

      {recreateTarget != null && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card">
            <h3>Nuovo tavolo da stampa</h3>
            <p className="hint">
              Verrà creato un tavolo attivo con l&apos;ordine della sessione stampata il{' '}
              {format(recreateTarget.printedAtMillis, 'dd/MM/yyyy HH:mm', { locale: it })}.
            </p>
            <input
              className="field"
              placeholder="Nome nuovo tavolo"
              value={recreateNome}
              onChange={(e) => setRecreateNome(e.target.value)}
              autoFocus
            />
            <div className="row-gap">
              <button type="button" className="primary" disabled={busy} onClick={() => void confirmRecreate()}>
                Ricrea tavolo
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={() => setRecreateTarget(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {replaceCartPending != null && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card">
            <h3>Carrello attivo</h3>
            <p>Il carrello verrà svuotato. Verrà creato il nuovo tavolo con il riepilogo della stampa.</p>
            <input
              className="field"
              placeholder="Nome nuovo tavolo"
              value={recreateNome}
              onChange={(e) => setRecreateNome(e.target.value)}
            />
            <div className="row-gap">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => {
                  const nome = recreateNome.trim()
                  if (!nome) {
                    setMsg('Inserisci il nome del nuovo tavolo')
                    return
                  }
                  void applyRecreate(replaceCartPending, nome)
                }}
              >
                Ricrea tavolo
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={() => setReplaceCartPending(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
