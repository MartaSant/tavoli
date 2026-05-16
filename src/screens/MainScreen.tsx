import { useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toggleLightDarkFromResolved, deactivateTavolo, commitSessionPrint } from '../data/repositories'
import { useSession } from '../auth/SessionContext'
import { OrderTab } from './OrderTab'
import { HistoryTab } from './HistoryTab'
import { AdminTab } from './AdminTab'
import { TablesTab } from './TablesTab'
import { PrintsTab } from './PrintsTab'
import { takeMainTabAfterReceipt, takePendingSessionPrintDecision } from '../util/receiptNavStaging'

const LABELS = ['Tavoli', 'Ordine', 'Storico', 'Stampe', 'Admin'] as const

const MAX_TAB = LABELS.length - 1

export function MainScreen() {
  const [tab, setTab] = useState(0)
  const [sessionPrintDecision, setSessionPrintDecision] = useState<{
    tableId: number
    summaryText: string
  } | null>(null)
  const { logout, user } = useSession()
  const nav = useNavigate()
  const loc = useLocation()

  useLayoutEffect(() => {
    const m = takeMainTabAfterReceipt()
    if (m != null) setTab(Math.max(0, Math.min(m, MAX_TAB)))
    const pending = takePendingSessionPrintDecision()
    if (pending != null) setSessionPrintDecision(pending)
  }, [])

  useLayoutEffect(() => {
    const st = loc.state as { openMainTab?: number } | null
    if (typeof st?.openMainTab === 'number' && Number.isFinite(st.openMainTab)) {
      setTab(Math.max(0, Math.min(st.openMainTab, MAX_TAB)))
      nav(loc.pathname, { replace: true, state: {} })
    }
  }, [loc.pathname, loc.state, nav])

  async function onThemeIcon() {
    const dark = document.documentElement.dataset.theme === 'dark'
    await toggleLightDarkFromResolved(dark)
  }

  async function confirmCloseSessionAndDeactivate() {
    if (sessionPrintDecision == null) return
    const { tableId, summaryText } = sessionPrintDecision
    try {
      await commitSessionPrint(tableId, summaryText)
      await deactivateTavolo(tableId)
    } catch {
      /* ignore */
    }
    setSessionPrintDecision(null)
  }

  return (
    <div className="main-shell">
      <header className="top-bar row-between">
        <h1 className="title">{user?.username ?? 'Tavoli'}</h1>
        <div className="row-gap">
          <button type="button" className="icon-btn" title="Tema" onClick={() => void onThemeIcon()}>
            ◑
          </button>
          <button type="button" className="icon-btn" title="Esci" onClick={() => { logout(); nav('/login', { replace: true }) }}>
            ⎋
          </button>
        </div>
      </header>
      <nav className="tab-row main-tabs">
        {LABELS.map((l, i) => (
          <button key={l} type="button" className={tab === i ? 'tab active' : 'tab'} onClick={() => setTab(i)}>
            {l}
          </button>
        ))}
      </nav>
      <main className="main-body">
        {tab === 0 && <TablesTab onGoToOrder={() => setTab(1)} />}
        {tab === 1 && <OrderTab onOrderConfirmed={() => setTab(0)} />}
        {tab === 2 && <HistoryTab />}
        {tab === 3 && <PrintsTab onGoToTavoli={() => setTab(0)} />}
        {tab === 4 && <AdminTab />}
      </main>

      {sessionPrintDecision != null && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card">
            <h3>Chiudere la sessione sul tavolo?</h3>
            <p>
              Se confermi, la sessione viene registrata come chiusa (come dopo il riepilogo stampato) e il tavolo
              viene nascosto dalla lista. Se mantieni attivo, torni ai tavoli senza modificare la sessione: potrai
              ancora aggiungere o modificare ordini su quel tavolo.
            </p>
            <div className="row-gap">
              <button type="button" className="primary" onClick={() => void confirmCloseSessionAndDeactivate()}>
                Sì, chiudi sessione e nascondi tavolo
              </button>
              <button type="button" className="ghost" onClick={() => setSessionPrintDecision(null)}>
                No, mantieni sessione aperta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
