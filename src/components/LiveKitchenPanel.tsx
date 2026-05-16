import type { LiveKitchenTableBlock } from '../domain/liveKitchenBoard'

export function LiveKitchenPanel({
  blocks,
  onClose,
}: {
  blocks: LiveKitchenTableBlock[]
  onClose: () => void
}) {
  const total = blocks.reduce((n, b) => n + b.pizze.length, 0)
  return (
    <section className="live-kitchen-panel card">
      <div className="row-between wrap live-kitchen-header">
        <strong>Riepilogo live cucina</strong>
        <span className="hint">{total} pizza/e in attesa</span>
        <button type="button" className="small-btn" onClick={onClose}>
          Chiudi
        </button>
      </div>
      {blocks.length === 0 ? (
        <p className="hint live-kitchen-empty">Nessuna pizza in attesa di invio.</p>
      ) : (
        <ul className="live-kitchen-list">
          {blocks.map((block) => (
            <li key={block.tableId} className="live-kitchen-table-block">
              <div className="live-kitchen-table-name">{block.tableName}</div>
              <ul>
                {block.pizze.map((p, i) => (
                  <li key={`${block.tableId}-${i}`} className="live-kitchen-pizza-line">
                    <span className="live-kitchen-pizza-primary">{p.primary}</span>
                    {p.sublines.map((sub, j) => (
                      <span key={j} className="live-kitchen-pizza-sub">
                        {sub}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
