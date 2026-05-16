import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resetAdminPinWithRecovery } from '../data/repositories'

export function RecoveryScreen() {
  const nav = useNavigate()
  const [recovery, setRecovery] = useState('')
  const [newPin, setNewPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (recovery.length !== 4) {
      setMsg('Codice recupero: 4 cifre')
      return
    }
    if (newPin.length !== 6) {
      setMsg('Nuovo PIN admin: 6 cifre')
      return
    }
    const ok = await resetAdminPinWithRecovery(recovery, newPin)
    setMsg(ok ? 'PIN aggiornato' : 'Codice recupero errato')
    if (ok) nav('/login', { replace: true })
  }

  return (
    <div className="surface-page">
      <h1>Recupero PIN admin</h1>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Codice recupero
          <input value={recovery} onChange={(e) => setRecovery(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
        </label>
        <label>
          Nuovo PIN (6 cifre)
          <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" />
        </label>
        {msg && <p className={msg.includes('errato') ? 'error' : 'ok'}>{msg}</p>}
        <button type="submit" className="primary">
          Aggiorna PIN
        </button>
        <button type="button" className="ghost" onClick={() => nav(-1)}>
          Indietro
        </button>
      </form>
    </div>
  )
}
