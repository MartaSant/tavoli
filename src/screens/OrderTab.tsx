import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoneyFormatter } from '../domain/money'
import { OrderNumberService } from '../domain/orderNumber'
import { useOrderCart } from '../context/OrderCartContext'
import { db } from '../db/database'
import { stageReceiptNavigation } from '../util/receiptNavStaging'

export function OrderTab({ onOrderConfirmed }: { onOrderConfirmed?: () => void }) {
  const nav = useNavigate()
  const cart = useOrderCart()
  const nextState = useLiveQuery(() => db.appState.get(1))
  const tavoli = useLiveQuery(() => db.tavoli.filter((t) => t.attivo).toArray().then((a) => a.sort((x, y) => x.nome.localeCompare(y.nome))), [])
  const [modPickerFor, setModPickerFor] = useState<number | null>(null)
  const [elevatedField, setElevatedField] = useState<string | null>(null)

  useEffect(() => {
    void cart.refreshMods()
  }, [cart])

  async function onPreview() {
    const snap = await cart.previewOrder()
    if (snap) {
      stageReceiptNavigation(snap, true, 1)
      nav('/main/receipt')
    }
  }

  async function onConfirm() {
    await cart.confirmOrder(() => {
      onOrderConfirmed?.()
    })
  }

  const nextNum = nextState?.nextOrderNumber ?? 1

  return (
    <div className="stack order-tab">
      <h2 className="section-title">Prossimo ordine #{OrderNumberService.formatDisplay(nextNum)}</h2>
      <hr className="divider" />

      <p className="hint">Tavolo</p>
      <div className="row-gap wrap">
        {(tavoli ?? []).map((t) => (
          <button
            key={t.id}
            type="button"
            className={cart.selectedTableId === t.id ? 'small-btn primary' : 'small-btn secondary'}
            onClick={() => cart.setSelectedTable(t.id!, t.nome)}
          >
            {t.nome}
          </button>
        ))}
      </div>
      {cart.selectedTableNome && (
        <p className="hint">
          Selezionato: <strong>{cart.selectedTableNome}</strong>
        </p>
      )}

      {elevatedField !== 'pizzaQ' && (
        <input
          className="field"
          placeholder="Cerca pizza"
          value={cart.pizzaSearch}
          onChange={(e) => void cart.searchPizze(e.target.value)}
          onFocus={() => setElevatedField('pizzaQ')}
          onBlur={() => setElevatedField(null)}
        />
      )}
      {elevatedField === 'pizzaQ' && (
        <input
          className="field elevated"
          placeholder="Cerca pizza"
          value={cart.pizzaSearch}
          onChange={(e) => void cart.searchPizze(e.target.value)}
          onBlur={() => setElevatedField(null)}
          autoFocus
        />
      )}

      <ul className="search-results">
        {cart.pizzaResults.map((p) => (
          <li key={p.id}>
            <button type="button" className="linkish" onClick={() => cart.addPizza(p)}>
              {p.nome} — {MoneyFormatter.format(p.prezzoCentesimi)}
            </button>
          </li>
        ))}
      </ul>

      {cart.pizzaLines.map((line) => (
        <div key={line.localId} className="card line-card">
          <div className="row-between">
            <strong>
              {line.nome} {MoneyFormatter.format(line.prezzoBaseCentesimi)}
            </strong>
            <span>
              <button type="button" className="icon-btn" title="Duplica" onClick={() => cart.duplicatePizza(line.localId)}>
                ⧉
              </button>
              <button type="button" className="icon-btn danger" title="Rimuovi" onClick={() => cart.removePizza(line.localId)}>
                ×
              </button>
            </span>
          </div>
          {line.mods.map((m, i) => (
            <div key={`${line.localId}-m-${i}`} className="row-between mod-row">
              <span>
                {m.tipo === 'EXTRA' ? `+ ${m.nome}` : `- ${m.nome}`}{' '}
                {m.tipo === 'EXTRA' ? MoneyFormatter.format(m.prezzoCentesimi) : ''}
              </span>
              <button type="button" className="icon-btn danger" onClick={() => cart.removeMod(line.localId, i)}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="small-btn" onClick={() => setModPickerFor(line.localId)}>
            + / − modificatori
          </button>
          {modPickerFor === line.localId && (
            <div className="mod-picker card">
              <input
                className="field"
                placeholder="Cerca modificatore"
                value={cart.modSearch}
                onChange={(e) => void cart.searchMods(e.target.value)}
              />
              <ul>
                {cart.modResults.map((m) => (
                  <li key={m.id} className="mod-actions">
                    <span>{m.nome} ({MoneyFormatter.format(m.prezzoCentesimi)})</span>
                    <button type="button" className="small-btn" onClick={() => m.id && cart.addMod(line.localId, m, 'EXTRA')}>
                      Extra
                    </button>
                    <button type="button" className="small-btn" onClick={() => m.id && cart.addMod(line.localId, m, 'REMOVAL')}>
      Via
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="ghost" onClick={() => setModPickerFor(null)}>
                Chiudi
              </button>
            </div>
          )}
          {elevatedField !== `note-${line.localId}` ? (
            <input
              className="field"
              placeholder="Nota"
              value={line.nota ?? ''}
              onChange={(e) => cart.updatePizzaNote(line.localId, e.target.value)}
              onFocus={() => setElevatedField(`note-${line.localId}`)}
              onBlur={() => setElevatedField(null)}
            />
          ) : (
            <input
              className="field elevated"
              placeholder="Nota"
              value={line.nota ?? ''}
              onChange={(e) => cart.updatePizzaNote(line.localId, e.target.value)}
              onBlur={() => setElevatedField(null)}
              autoFocus
            />
          )}
        </div>
      ))}

      <hr className="divider" />
      {elevatedField !== 'bibitaQ' && (
        <input
          className="field"
          placeholder="Cerca bibita"
          value={cart.bibitaSearch}
          onChange={(e) => void cart.searchBibite(e.target.value)}
          onFocus={() => setElevatedField('bibitaQ')}
          onBlur={() => setElevatedField(null)}
        />
      )}
      {elevatedField === 'bibitaQ' && (
        <input
          className="field elevated"
          placeholder="Cerca bibita"
          value={cart.bibitaSearch}
          onChange={(e) => void cart.searchBibite(e.target.value)}
          onBlur={() => setElevatedField(null)}
          autoFocus
        />
      )}
      <ul className="search-results">
        {cart.bibitaResults.map((b) => (
          <li key={b.id}>
            <button type="button" className="linkish" onClick={() => cart.addBibita(b)}>
              {b.nome} — {MoneyFormatter.format(b.prezzoCentesimi)}
            </button>
          </li>
        ))}
      </ul>

      {cart.bibitaLines.map((b) => (
        <div key={b.localId} className="row-between bib-row">
          <span>
            {b.nome} x{b.quantita}
          </span>
          <span className="row-gap">
            <button type="button" className="icon-btn" onClick={() => cart.adjustBibita(b.localId, -1)}>
              −
            </button>
            <button type="button" className="icon-btn" onClick={() => cart.adjustBibita(b.localId, 1)}>
              +
            </button>
            <strong>{MoneyFormatter.format(b.prezzoUnitarioCentesimi * b.quantita)}</strong>
            <button type="button" className="icon-btn danger" onClick={() => cart.removeBibita(b.localId)}>
              ×
            </button>
          </span>
        </div>
      ))}

      <p className="total">TOTALE {MoneyFormatter.format(cart.totalCentesimi)}</p>
      {cart.message && <p className="error">{cart.message}</p>}

      <div className="row-gap wrap">
        <button
          type="button"
          className="secondary"
          disabled={!cart.isCartNonEmpty() || cart.selectedTableId == null}
          onClick={() => void onPreview()}
        >
          Anteprima ordine
        </button>
        <button
          type="button"
          className="primary"
          disabled={!cart.isCartNonEmpty() || cart.selectedTableId == null}
          onClick={() => void onConfirm()}
        >
          Conferma ordine
        </button>
      </div>
    </div>
  )
}
