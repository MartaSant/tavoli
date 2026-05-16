import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../auth/SessionContext'
import { UserRole } from '../auth/userRole'
import { usersActive, verifyPin, getUserById } from '../data/repositories'

export function LoginScreen() {
  const nav = useNavigate()
  const { login } = useSession()
  const users = useLiveQuery(() => usersActive(), [])
  const [userId, setUserId] = useState<number | ''>('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Accesso — PizzApp Web'
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (userId === '') {
      setErr('Seleziona un utente')
      return
    }
    const user = await getUserById(userId)
    if (!user) return
    const expectedLen = user.role === UserRole.ADMIN ? 6 : 4
    if (pin.length !== expectedLen) {
      setErr(`PIN: ${expectedLen} cifre`)
      return
    }
    const ok = await verifyPin(userId, pin)
    if (!ok) {
      setErr('PIN errato')
      return
    }
    login(user)
    nav('/main', { replace: true })
  }

  return (
    <div className="surface-page">
      <h1>Accedi</h1>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Utente
          <select
            value={userId === '' ? '' : String(userId)}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">—</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} {u.role === UserRole.ADMIN ? '(admin)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          PIN
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="primary">
          Entra
        </button>
        <Link to="/recovery">PIN dimenticato? (solo admin)</Link>
      </form>
    </div>
  )
}
