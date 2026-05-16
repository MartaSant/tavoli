import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../db/database'

/** Evita ambiguità useLiveQuery(undefined): distinguere caricamento DB da “nessuna riga”. */
export function RootRedirect() {
  const [done, setDone] = useState(false)
  const [wizardOk, setWizardOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await db.open()
      const s = await db.appState.get(1)
      if (!cancelled) {
        setWizardOk(!!s?.wizardCompletato)
        setDone(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!done) {
    return (
      <div className="surface-page">
        <p>Caricamento…</p>
      </div>
    )
  }
  if (!wizardOk) return <Navigate to="/wizard" replace />
  return <Navigate to="/login" replace />
}
