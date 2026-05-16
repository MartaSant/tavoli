import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeWizard } from '../data/repositories'

export function WizardScreen() {
  const nav = useNavigate()
  const [nomePizzeria, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [recovery, setRecovery] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Setup — PizzApp Web'
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (!nomePizzeria.trim()) throw new Error('Nome pizzeria obbligatorio')
      if (!username.trim()) throw new Error('Nome utente obbligatorio')
      if (adminPin.length !== 6) throw new Error('PIN admin: 6 cifre')
      if (recovery.length !== 4) throw new Error('Codice recupero: 4 cifre')
      await completeWizard(nomePizzeria, username, adminPin, recovery)
      nav('/login', { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface-page">
      <h1>Benvenuto</h1>
      <p className="hint">Configura la pizzeria e il primo utente amministratore.</p>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Nome pizzeria
          <input value={nomePizzeria} onChange={(e) => setNome(e.target.value)} autoComplete="organization" />
        </label>
        <label>
          Nome utente admin
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          PIN admin (6 cifre)
          <input value={adminPin} onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" />
        </label>
        <label>
          Codice recupero (4 cifre)
          <input value={recovery} onChange={(e) => setRecovery(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
        </label>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="primary" disabled={busy}>
          Completa setup
        </button>
      </form>
    </div>
  )
}
