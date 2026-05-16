import type { SessionSummaryModel } from '../domain/sessionSummaryModel'

export function SessionSummaryView({ model }: { model: SessionSummaryModel }) {
  return (
    <pre className="receipt-pre session-summary-pre">
      {model.lines.map((line, i) => (
        <span key={i} className={line.highlight ? 'summary-line summary-line--highlight' : 'summary-line'}>
          {line.text}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}
