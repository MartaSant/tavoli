import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderCart } from '../context/OrderCartContext'
import type { TavoloDisplayStatus } from '../domain/tavoloDisplayStatus'
import {
  createTavolo,
  formatSessionSummaryText,
  getActiveTavoliWithSessionState,
  inviaComandeSessioni,
} from '../data/repositories'
import { db } from '../db/database'
import { stageReceiptNavigation } from '../util/receiptNavStaging'

function tableCardClass(status: TavoloDisplayStatus): string {
  if (status === 'sent') return 'table-card table-card--sent'
  if (status === 'session') return 'table-card table-card--session'
  return 'table-card table-card--idle'
}

export function TablesTab({ onGoToOrder }: { onGoToOrder: () => void }) {
  const nav = useNavigate()
  const cart = useOrderCart()
  const tavoli = useLiveQuery(() => getActiveTavoliWithSessionState(), [])
  const [nuovoNome, setNuovoNome] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busyInvia, setBusyInvia] = useState(false)
  const [selectedTableIds, setSelectedTableIds] = useState<Set<number>>(() => new Set())

  const pendingSelectedCount = useMemo(() => {
    if (!tavoli) return 0
    return tavoli.filter((t) => t.id != null && selectedTableIds.has(t.id) && t.displayStatus === 'session')
      .length
  }, [tavoli, selectedTableIds])

  function toggleSelected(tableId: number, checked: boolean) {
    setSelectedTableIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(tableId)
      else next.delete(tableId)
      return next
    })
  }

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

  async function onInviaComande() {
    setBusyInvia(true)
    setMsg(null)
    try {
      const ids = [...selectedTableIds]
      const n = await inviaComandeSessioni(ids)
      if (n === 0) setMsg('Nessun tavolo selezionato con righe da inviare')
      else {
        setMsg(`${n} comanda/e inviata/e in cucina`)
        setSelectedTableIds(new Set())
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusyInvia(false)
    }
  }

  return (
    <div className="stack">
      <h2 className="section-title">Tavoli attivi</h2>
      <div className="table-legend row-gap wrap">
        <span className="table-legend-item table-legend-item--idle">Senza ordini</span>
        <span className="table-legend-item table-legend-item--session">Con riepilogo</span>
        <button
          type="button"
          className="table-legend-item table-legend-item--session table-legend-btn"
          disabled={busyInvia || pendingSelectedCount === 0}
          onClick={() => void onInviaComande()}
        >
          Invia comande
        </button>
        <span className="table-legend-item table-legend-item--sent">Comanda inviata</span>
      </div>
      {msg && <p className={msg.includes('inviata') ? 'ok' : 'error'}>{msg}</p>}
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
          <li key={t.id} className={`card history-card ${tableCardClass(t.displayStatus)}`}>
            <div className="row-between wrap table-card-row">
              {t.hasSessionOrders ? (
                <label className="table-select-label">
                  <input
                    type="checkbox"
                    checked={selectedTableIds.has(t.id!)}
                    onChange={(e) => toggleSelected(t.id!, e.target.checked)}
                  />
                </label>
              ) : (
                <span className="table-select-spacer" aria-hidden />
              )}
              <strong className="table-card-title">
                {t.nome}
                {t.displayStatus === 'sent' && (
                  <span className="hint" style={{ marginLeft: '0.5rem', fontWeight: 400 }}>
                    Comanda inviata
                  </span>
                )}
              </strong>
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
