import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../auth/SessionContext'
import { MoneyFormatter } from '../domain/money'
import { OrderNumberService } from '../domain/orderNumber'
import { HISTORY_HOURS_MS, clearAllOrders } from '../data/repositories'
import { useOrderCart } from '../context/OrderCartContext'
import { db } from '../db/database'
import { stageReceiptNavigation } from '../util/receiptNavStaging'

export function HistoryTab() {
  const nav = useNavigate()
  const { isAdmin } = useSession()
  const cart = useOrderCart()
  const since = Date.now() - HISTORY_HOURS_MS
  const orders = useLiveQuery(() => db.orders.filter((o) => o.createdAt >= since).toArray().then((a) => a.sort((x, y) => y.createdAt - x.createdAt)), [])
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [replaceCartId, setReplaceCartId] = useState<number | null>(null)

  async function doClear() {
    try {
      if (confirmText !== 'SVUOTA') {
        setMsg('Digita SVUOTA per confermare')
        return
      }
      if (!isAdmin) throw new Error('Solo admin')
      await clearAllOrders()
      setMsg('Storico svuotato')
      setConfirmClear(false)
      setConfirmText('')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore')
    }
  }

  function beginLoad(orderId: number) {
    if (cart.isCartNonEmpty()) {
      setReplaceCartId(orderId)
    } else {
      void cart.loadCartFromOrder(orderId).then(() => nav('/main', { state: { openMainTab: 1 } }))
    }
  }

  return (
    <div className="stack">
      {isAdmin && (
        <button type="button" className="secondary" onClick={() => setConfirmClear(true)}>
          Svuota storico (admin)
        </button>
      )}
      {msg && <p className="ok">{msg}</p>}
      <ul className="history-list">
        {(orders ?? []).map((o) => (
          <li key={o.id} className="card history-card">
            <div className="row-between">
              <button
                type="button"
                className="linkish left-align"
                onClick={() => {
                  stageReceiptNavigation(o.receiptSnapshot, false, 2)
                  nav('/main/receipt')
                }}
              >
                <strong>
                  #{OrderNumberService.formatDisplay(o.numeroDisplay)} — {MoneyFormatter.format(o.totaleCentesimi)}
                </strong>
                <div className="hint">{format(o.createdAt, 'dd/MM/yyyy HH:mm', { locale: it })}</div>
                {o.nomeTavoloSnapshot && <div className="hint">Tavolo: {o.nomeTavoloSnapshot}</div>}
                {o.nomeCliente && <div className="hint">Cliente: {o.nomeCliente}</div>}
              </button>
              <button type="button" className="small-btn" onClick={() => beginLoad(o.id!)}>
                Modifica
              </button>
            </div>
          </li>
        ))}
      </ul>

      {confirmClear && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card">
            <h3>Svuota storico</h3>
            <p>Eliminerai {orders?.length ?? 0} ordini. Digita SVUOTA.</p>
            <input className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="row-gap">
              <button type="button" className="primary" onClick={() => void doClear()}>
                Conferma
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmClear(false)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {replaceCartId != null && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card">
            <h3>Sostituire il carrello?</h3>
            <p>Il carrello attuale verrà sostituito con l&apos;ordine selezionato.</p>
            <div className="row-gap">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  void cart.loadCartFromOrder(replaceCartId).then(() => {
                    setReplaceCartId(null)
                    nav('/main', { state: { openMainTab: 1 } })
                  })
                }}
              >
                Sostituisci
              </button>
              <button type="button" className="ghost" onClick={() => setReplaceCartId(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
