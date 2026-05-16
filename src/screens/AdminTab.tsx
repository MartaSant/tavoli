import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { APP_VERSION } from '../version'
import { AppThemeMode, normalizeThemeMode } from '../domain/appThemeMode'
import { MoneyFormatter } from '../domain/money'
import { UserRole, ConfirmFeedback, confirmFeedbackFromStorage } from '../auth/userRole'
import { useSession } from '../auth/SessionContext'
import {
  clearMenu,
  createUser,
  deactivateUser,
  deleteBibitaById,
  deleteModificatoreById,
  deletePizzaById,
  MenuClearScope,
  type MenuClearScopeValue,
  updateSettings,
  updateThemeMode,
  upsertBibita,
  upsertModificatore,
  upsertPizza,
} from '../data/repositories'
import { exportJson, exportMenuCatalogJson, importJson, importMenuCatalog } from '../backup/backupManager'
import { db } from '../db/database'
import type { BibitaEntity, ModificatoreEntity, PizzaEntity } from '../db/types'

const TABS = ['Pizze', 'Modificatori', 'Bibite', 'Backup', 'Utenti', 'Impostazioni'] as const

export function AdminTab() {
  const { isAdmin, user } = useSession()
  const [section, setSection] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuFileRef = useRef<HTMLInputElement>(null)

  const pizze = useLiveQuery(() => db.pizze.orderBy('ordineVisualizzazione').toArray(), [])
  const mods = useLiveQuery(() => db.modificatori.orderBy('ordineVisualizzazione').toArray(), [])
  const bibite = useLiveQuery(() => db.bibite.orderBy('ordineVisualizzazione').toArray(), [])
  const users = useLiveQuery(() => db.users.toArray().then((a) => a.sort((u, v) => u.username.localeCompare(v.username))), [])
  const appState = useLiveQuery(() => db.appState.get(1))

  if (!isAdmin) {
    return <p className="error">Area riservata all&apos;amministratore.</p>
  }

  return (
    <div className="stack admin-tab">
      <div className="tab-row scroll-x">
        {TABS.map((t, i) => (
          <button key={t} type="button" className={section === i ? 'tab active' : 'tab'} onClick={() => setSection(i)}>
            {t}
          </button>
        ))}
      </div>
      {msg && <p className="ok">{msg}</p>}

      {section === 0 && (
        <MenuSection
          title="Pizza"
          items={pizze ?? []}
          onSave={(id, nome, prezzo, attiva, ordine) => void upsertPizza(id, nome, prezzo, attiva, ordine).then(() => setMsg('Salvato')).catch((e) => setMsg(String(e.message)))}
          onDelete={(id) => void deletePizzaById(id).then(() => setMsg('Eliminato')).catch((e) => setMsg(String(e.message)))}
        />
      )}
      {section === 1 && (
        <MenuSection
          title="Modificatore"
          items={mods ?? []}
          onSave={(id, nome, prezzo, attiva, ordine) =>
            void upsertModificatore(id, nome, prezzo, attiva, ordine).then(() => setMsg('Salvato')).catch((e) => setMsg(String(e.message)))
          }
          onDelete={(id) => void deleteModificatoreById(id).then(() => setMsg('Eliminato')).catch((e) => setMsg(String(e.message)))}
        />
      )}
      {section === 2 && (
        <MenuSection
          title="Bibita"
          items={bibite ?? []}
          onSave={(id, nome, prezzo, attiva, ordine) => void upsertBibita(id, nome, prezzo, attiva, ordine).then(() => setMsg('Salvato')).catch((e) => setMsg(String(e.message)))}
          onDelete={(id) => void deleteBibitaById(id).then(() => setMsg('Eliminato')).catch((e) => setMsg(String(e.message)))}
        />
      )}
      {section === 3 && (
        <div className="stack">
          <h3 className="section-title">Solo listino (consigliato per JSON catalogo)</h3>
          <input
            ref={menuFileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const reader = new FileReader()
              reader.onload = () => {
                void importMenuCatalog(String(reader.result))
                  .then(() => setMsg('Menu importato (utenti e ordini invariati)'))
                  .catch((err) => setMsg(err instanceof Error ? err.message : 'Errore import menu'))
              }
              reader.readAsText(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void (async () => {
                try {
                  const json = await exportMenuCatalogJson()
                  const blob = new Blob([json], { type: 'application/json' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `menu-catalog-${Date.now()}.json`
                  a.click()
                  setMsg('Export menu avviato')
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Errore')
                }
              })()
            }}
          >
            Esporta solo menu JSON
          </button>
          <button type="button" className="primary" onClick={() => menuFileRef.current?.click()}>
            Importa solo menu
          </button>
          <p className="hint">
            File con <code>menuCatalog: true</code> (es. listino Glovo). Esporta/importa solo pizze, modificatori e
            bibite; utenti e ordini restano. Per file di backup completo usa la sezione sotto.
          </p>

          <h3 className="section-title">Backup completo</h3>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                const json = await exportJson()
                const blob = new Blob([json], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `pizzapp-backup-${Date.now()}.json`
                a.click()
                setMsg('Export avviato')
              } catch (e) {
                setMsg(e instanceof Error ? e.message : 'Errore')
              }
            }}
          >
            Esporta backup JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const reader = new FileReader()
              reader.onload = () => {
                void importJson(String(reader.result))
                  .then(() => setMsg('Import completato'))
                  .catch((err) => setMsg(err instanceof Error ? err.message : 'Errore import'))
              }
              reader.readAsText(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
            Importa backup
          </button>
          <p className="hint">Sostituisce tutti i dati (utenti, ordini, menu). Non usare per il solo file catalogo.</p>

          <p className="hint">
            Ordini passati: dopo «Importa solo menu» gli ID nel menu cambiano; sulle righe storiche azzeriamo i
            riferimenti agli ID, ma nome e prezzi negli scontrini restano quelli salvati all&apos;ordine.
          </p>
        </div>
      )}
      {section === 4 && (
        <UsersSection
          onCreate={async (username, pin, role) => {
            try {
              const len = role === UserRole.ADMIN ? 6 : 4
              if (pin.length !== len) throw new Error(`PIN: ${len} cifre`)
              await createUser(username, pin, role)
              setMsg('Utente creato')
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Errore')
            }
          }}
          onDeactivate={async (targetId) => {
            if (user?.id == null) return
            try {
              await deactivateUser(user.id, targetId)
              setMsg('Utente disattivato')
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Errore')
            }
          }}
          actingUserId={user?.id}
          users={users ?? []}
        />
      )}
      {section === 5 && appState && (
        <SettingsSection
          appState={appState}
          onFeedback={async (fb) => {
            try {
              await updateSettings(fb, appState.printerMac)
              setMsg('Salvato')
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Errore')
            }
          }}
          onPrinter={async (mac) => {
            try {
              await updateSettings(appState.confirmFeedback, mac || null)
              setMsg('Salvato stampante')
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Errore')
            }
          }}
          onTheme={async (mode) => {
            try {
              await updateThemeMode(mode)
              setMsg('Tema aggiornato')
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Errore')
            }
          }}
        />
      )}
    </div>
  )
}

function MenuSection<T extends PizzaEntity | ModificatoreEntity | BibitaEntity>({
  title,
  items,
  onSave,
  onDelete,
}: {
  title: string
  items: T[]
  onSave: (id: number, nome: string, prezzo: number, attiva: boolean, ordine: number) => void
  onDelete: (id: number) => void
}) {
  const [nome, setNome] = useState('')
  const [prezzo, setPrezzo] = useState('')
  const [edit, setEdit] = useState<T | null>(null)

  return (
    <div className="stack">
      <h3>Nuovo {title}</h3>
      <div className="row-gap wrap">
        <input className="field" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="field" placeholder="Prezzo (es. 7,50)" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
        <button
          type="button"
          className="primary"
          onClick={() => {
            const cents = MoneyFormatter.parseToCentesimi(prezzo)
            if (cents == null) {
              window.alert('Prezzo non valido')
              return
            }
            onSave(0, nome, cents, true, items.length)
            setNome('')
            setPrezzo('')
          }}
        >
          Aggiungi
        </button>
      </div>
      <ul className="menu-list">
        {items.map((p) => (
          <li key={p.id} className="card row-between">
            <span>
              {p.nome} — {MoneyFormatter.format(p.prezzoCentesimi)} {p.attiva ? '' : '(off)'}
            </span>
            <span className="row-gap">
              <button type="button" className="small-btn" onClick={() => setEdit(p)}>
                Modifica
              </button>
              <button type="button" className="small-btn danger" onClick={() => p.id && onDelete(p.id)}>
                Elimina
              </button>
            </span>
          </li>
        ))}
      </ul>
      {edit && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card stack">
            <h3>Modifica</h3>
            <EditMenuForm
              item={edit}
              onClose={() => setEdit(null)}
              onSave={(id, n, pr, att, ord) => {
                onSave(id, n, pr, att, ord)
                setEdit(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EditMenuForm({
  item,
  onClose,
  onSave,
}: {
  item: PizzaEntity | ModificatoreEntity | BibitaEntity
  onClose: () => void
  onSave: (id: number, nome: string, prezzo: number, attiva: boolean, ordine: number) => void
}) {
  const [nome, setNome] = useState(item.nome)
  const [prezzo, setPrezzo] = useState(
    new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      item.prezzoCentesimi / 100,
    ),
  )
  const [attiva, setAttiva] = useState(item.attiva)
  const [ordine, setOrdine] = useState(item.ordineVisualizzazione)
  return (
    <>
      <label>
        Nome
        <input className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label>
        Prezzo
        <input className="field" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
      </label>
      <label className="row-gap">
        <input type="checkbox" checked={attiva} onChange={(e) => setAttiva(e.target.checked)} />
        Attivo
      </label>
      <label>
        Ordine
        <input type="number" className="field" value={ordine} onChange={(e) => setOrdine(Number(e.target.value))} />
      </label>
      <div className="row-gap">
        <button
          type="button"
          className="primary"
          onClick={() => {
            const cents = MoneyFormatter.parseToCentesimi(prezzo)
            if (!item.id || cents == null) return
            onSave(item.id, nome, cents, attiva, ordine)
          }}
        >
          Salva
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Annulla
        </button>
      </div>
    </>
  )
}

function UsersSection({
  users,
  onCreate,
  onDeactivate,
  actingUserId,
}: {
  users: { id?: number; username: string; role: string; attivo: boolean }[]
  onCreate: (u: string, pin: string, role: string) => void
  onDeactivate: (targetId: number) => void
  actingUserId?: number
}) {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<string>(UserRole.STAFF)
  return (
    <div className="stack">
      <h3>Nuovo utente</h3>
      <input className="field" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input className="field" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value={UserRole.STAFF}>Staff (PIN 4)</option>
        <option value={UserRole.ADMIN}>Admin (PIN 6)</option>
      </select>
      <button type="button" className="primary" onClick={() => onCreate(username, pin, role)}>
        Crea
      </button>
      <h4>Elenco</h4>
      <ul>
        {users.map((u) => (
          <li key={u.id} className="row-gap wrap">
            <span>
              {u.username} — {u.role} {u.attivo ? '' : '(disattivo)'}
            </span>
            {u.attivo && u.id != null && u.id !== actingUserId ? (
              <button type="button" className="ghost danger" onClick={() => onDeactivate(u.id!)}>
                Disattiva
              </button>
            ) : null}
            {u.attivo && u.id != null && u.id === actingUserId ? (
              <span className="hint">(account corrente)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SettingsSection({
  appState,
  onFeedback,
  onPrinter,
  onTheme,
}: {
  appState: { confirmFeedback: string; printerMac: string | null; themeMode: string }
  onFeedback: (s: string) => void
  onPrinter: (mac: string) => void
  onTheme: (m: string) => void
}) {
  const [mac, setMac] = useState(appState.printerMac ?? '')
  const fb = confirmFeedbackFromStorage(appState.confirmFeedback)
  const clearScopeRef = useRef<HTMLSelectElement>(null)
  const clearConfirmRef = useRef<HTMLInputElement>(null)

  return (
    <div className="stack">
      <p className="hint">Versione app: {APP_VERSION}</p>
      <h3>Tema</h3>
      <div className="chip-row">
        {(['LIGHT', 'DARK', 'SYSTEM'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={normalizeThemeMode(appState.themeMode) === m ? 'chip active' : 'chip'}
            onClick={() => onTheme(AppThemeMode[m])}
          >
            {m === 'LIGHT' ? 'Chiaro' : m === 'DARK' ? 'Scuro' : 'Sistema'}
          </button>
        ))}
      </div>
      <h3>Conferma ordine</h3>
      <select value={fb} onChange={(e) => onFeedback(e.target.value)}>
        <option value={ConfirmFeedback.VIBRATE}>Vibrazione</option>
        <option value={ConfirmFeedback.SOUND}>Suono</option>
        <option value={ConfirmFeedback.BOTH}>Entrambi</option>
        <option value={ConfirmFeedback.OFF}>Nessuno</option>
      </select>
      <h3>Stampante (solo note / compatibilità backup)</h3>
      <p className="hint">Sul web usa Anteprima e stampa browser. MAC salvato per backup come su Android.</p>
      <input className="field" placeholder="MAC stampante (opz.)" value={mac} onChange={(e) => setMac(e.target.value)} />
      <button type="button" className="secondary" onClick={() => onPrinter(mac.trim() || '')}>
        Salva MAC
      </button>

      <h3>Svuota menu</h3>
      <div className="row-gap wrap">
        <select ref={clearScopeRef} defaultValue={MenuClearScope.PIZZE}>
          <option value={MenuClearScope.ALL}>Tutto</option>
          <option value={MenuClearScope.PIZZE}>Pizze</option>
          <option value={MenuClearScope.MODIFICATORI}>Modificatori</option>
          <option value={MenuClearScope.BIBITE}>Bibite</option>
        </select>
        <input ref={clearConfirmRef} className="field" placeholder="SVUOTA" />
        <button
          type="button"
          className="danger"
          onClick={() => {
            const c = clearConfirmRef.current?.value
            const scope = clearScopeRef.current?.value as MenuClearScopeValue
            if (c !== 'SVUOTA') {
              window.alert('Digita SVUOTA')
              return
            }
            void clearMenu(scope)
              .then(() => window.alert('Menu svuotato'))
              .catch((e) => window.alert(String(e)))
          }}
        >
          Svuota selezione
        </button>
      </div>
    </div>
  )
}
