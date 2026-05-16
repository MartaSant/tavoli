import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { db } from '../db/database'

export function PrintsTab() {
  const rows = useLiveQuery(async () => {
    const logs = await db.tablePrintLog.orderBy('printedAtMillis').reverse().limit(80).toArray()
    return Promise.all(
      logs.map(async (l) => {
        const t = await db.tavoli.get(l.tableId)
        return { ...l, nomeTavolo: t?.nome ?? `Tavolo #${l.tableId}` }
      }),
    )
  }, [])

  return (
    <div className="stack">
      <h2 className="section-title">Ultime stampe sessione</h2>
      <ul className="history-list">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="card history-card">
            <div className="hint">{format(r.printedAtMillis, 'dd/MM/yyyy HH:mm', { locale: it })}</div>
            <div>
              <strong>{r.nomeTavolo}</strong>
            </div>
            <pre className="receipt-pre" style={{ fontSize: '11px', maxHeight: '8rem', overflow: 'auto' }}>
              {r.summaryText}
            </pre>
          </li>
        ))}
      </ul>
      {(rows?.length ?? 0) === 0 && <p className="hint">Nessuna stampa sessione registrata.</p>}
    </div>
  )
}
