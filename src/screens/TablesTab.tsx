import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderCart } from '../context/OrderCartContext'
import { createTavolo, formatSessionSummaryText, getActiveTavoliWithSessionState } from '../data/repositories'
import { db } from '../db/database'
import { stageReceiptNavigation } from '../util/receiptNavStaging'

export function TablesTab({ onGoToOrder }: { onGoToOrder: () => void }) {
  const nav = useNavigate()
  const cart = useOrderCart()
  const tavoli = useLiveQuery(() => getActiveTavoliWithSessionState(), [])
  const [nuovoNome, setNuovoNome] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function onCrea() {
    try {
      setMsg(null)
      const id = await createTavolo(nuovoNome)
      setNuovoNome('')
      const row = await db.tavoli.get(id)
      if (row) {
        cart.prepareNewOrderForTable(id, row.nome)
        onGoToOrder()
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore')
    }
  }

  async function onRiepilogo(tableId: number) {
    try {
      setMsg(null)
      const summaryText = await formatSessionSummaryText(tableId)
      stageReceiptNavigation(summaryText, false, 0, { tableId, summaryText })
      nav('/main/receipt')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore')
    }
  }

  return (
    <div className="stack">
      <h2 className="section-title">Tavoli attivi</h2>
      <div className="table-legend row-gap wrap">
        <span className="table-legend-item table-legend-item--idle">Senza ordini</span>
        <span className="table-legend-item table-legend-item--session">Con riepilogo</span>
      </div>
      {msg && <p className="error">{msg}</p>}
      <div className="row-gap wrap">
        <input
          className="field"
          placeholder="Nome nuovo tavolo"
          value={nuovoNome}
          onChange={(e) => setNuovoNome(e.target.value)}
        />
        <button type="button" className="primary" onClick={() => void onCrea()}>
          Crea tavolo
        </button>
      </div>
      <ul className="history-list">
        {(tavoli ?? []).map((t) => (
          <li
            key={t.id}
            className={`card history-card table-card ${t.hasSessionOrders ? 'table-card--session' : 'table-card--idle'}`}
          >
            <div className="row-between wrap">
              <strong>{t.nome}</strong>
              <div className="row-gap wrap">
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    cart.prepareNewOrderForTable(t.id!, t.nome)
                    onGoToOrder()
                  }}
                >
                  Aggiungi ordine
                </button>
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    void cart.loadMergedSessionIntoCart(t.id!).then(() => onGoToOrder())
                  }}
                >
                  Carica sessione
                </button>
                <button type="button" className="secondary" onClick={() => void onRiepilogo(t.id!)}>
                  Riepilogo sessione
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {(tavoli?.length ?? 0) === 0 && <p className="hint">Nessun tavolo attivo. Creane uno per iniziare.</p>}
    </div>
  )
}
