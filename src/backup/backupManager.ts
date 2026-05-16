import { normalizeThemeMode } from '../domain/appThemeMode'
import { normalizeUsername } from '../domain/usernameNormalizer'
import { db } from '../db/database'
import type { AppStateEntity } from '../db/types'
import { defaultAppState } from '../db/types'
import type {
  BibitaEntity,
  ModificatoreEntity,
  OrderEntity,
  OrderLineBibitaEntity,
  OrderLinePizzaEntity,
  OrderLinePizzaModEntity,
  PizzaEntity,
  TablePrintLogEntity,
  TavoloEntity,
  UserEntity,
} from '../db/types'

export const SCHEMA_VERSION = 2

function appStateToJson(s: AppStateEntity): Record<string, unknown> {
  return {
    wizardCompletato: s.wizardCompletato,
    nomePizzeria: s.nomePizzeria,
    recoveryCodeHash: s.recoveryCodeHash,
    nextOrderNumber: s.nextOrderNumber,
    confirmFeedback: s.confirmFeedback,
    printerMac: s.printerMac ?? null,
    themeMode: s.themeMode,
  }
}

function appStateFromJson(j: Record<string, unknown> | null | undefined, current: AppStateEntity): AppStateEntity {
  const src =
    j != null && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : {}
  return {
    ...current,
    wizardCompletato: Boolean(src.wizardCompletato ?? current.wizardCompletato),
    nomePizzeria: String(src.nomePizzeria ?? current.nomePizzeria),
    recoveryCodeHash: String(src.recoveryCodeHash ?? current.recoveryCodeHash),
    nextOrderNumber: Number(src.nextOrderNumber ?? current.nextOrderNumber),
    confirmFeedback: String(src.confirmFeedback ?? current.confirmFeedback),
    printerMac: src.printerMac == null || src.printerMac === null ? null : String(src.printerMac),
    themeMode: normalizeThemeMode(String(src.themeMode ?? current.themeMode)),
  }
}

function userToJson(u: UserEntity): Record<string, unknown> {
  return {
    username: u.username,
    usernameNorm: u.usernameNorm,
    pinHash: u.pinHash,
    role: u.role,
    attivo: u.attivo,
  }
}

function userFromJson(o: Record<string, unknown>): Omit<UserEntity, 'id'> {
  const username = String(o.username)
  const rawNorm = o.usernameNorm != null ? String(o.usernameNorm) : ''
  const fromField = rawNorm.trim() ? normalizeUsername(rawNorm) : ''
  const usernameNorm = fromField || normalizeUsername(username) || 'user'
  return {
    username,
    usernameNorm,
    pinHash: String(o.pinHash),
    role: String(o.role),
    attivo: o.attivo !== false,
  }
}

/** Backup può contenere duplicati case-variant; garantisce `usernameNorm` univoci prima dell'insert. */
function dedupeImportedUsers(users: Omit<UserEntity, 'id'>[]): Omit<UserEntity, 'id'>[] {
  const used = new Set<string>()
  return users.map((u) => {
    let base = u.usernameNorm.trim() ? normalizeUsername(u.usernameNorm) : normalizeUsername(u.username)
    if (!base) base = 'user'
    let n = base
    let i = 1
    while (used.has(n)) {
      i += 1
      n = `${base}_${i}`
    }
    used.add(n)
    return { ...u, usernameNorm: n }
  })
}

function pizzaToJson(p: PizzaEntity): Record<string, unknown> {
  return {
    nome: p.nome,
    prezzoCentesimi: p.prezzoCentesimi,
    attiva: p.attiva,
    ordineVisualizzazione: p.ordineVisualizzazione,
  }
}

function pizzaFromJson(o: Record<string, unknown>): Omit<PizzaEntity, 'id'> {
  return {
    nome: String(o.nome),
    prezzoCentesimi: Number(o.prezzoCentesimi),
    attiva: o.attiva !== false,
    ordineVisualizzazione: Number(o.ordineVisualizzazione ?? 0),
  }
}

function modToJson(m: ModificatoreEntity): Record<string, unknown> {
  return {
    nome: m.nome,
    prezzoCentesimi: m.prezzoCentesimi,
    attiva: m.attiva,
    ordineVisualizzazione: m.ordineVisualizzazione,
  }
}

function modFromJson(o: Record<string, unknown>): Omit<ModificatoreEntity, 'id'> {
  return {
    nome: String(o.nome),
    prezzoCentesimi: Number(o.prezzoCentesimi),
    attiva: o.attiva !== false,
    ordineVisualizzazione: Number(o.ordineVisualizzazione ?? 0),
  }
}

function bibToJson(b: BibitaEntity): Record<string, unknown> {
  return {
    nome: b.nome,
    prezzoCentesimi: b.prezzoCentesimi,
    attiva: b.attiva,
    ordineVisualizzazione: b.ordineVisualizzazione,
  }
}

function bibFromJson(o: Record<string, unknown>): Omit<BibitaEntity, 'id'> {
  return {
    nome: String(o.nome),
    prezzoCentesimi: Number(o.prezzoCentesimi),
    attiva: o.attiva !== false,
    ordineVisualizzazione: Number(o.ordineVisualizzazione ?? 0),
  }
}

function orderToJson(o: OrderEntity): Record<string, unknown> {
  return {
    numeroDisplay: o.numeroDisplay,
    nomeCliente: o.nomeCliente,
    tableId: o.tableId ?? null,
    nomeTavoloSnapshot: o.nomeTavoloSnapshot ?? null,
    createdAt: o.createdAt,
    totaleCentesimi: o.totaleCentesimi,
    createdByUserId: o.createdByUserId,
    receiptSnapshot: o.receiptSnapshot,
  }
}

function orderFromJson(o: Record<string, unknown>): Omit<OrderEntity, 'id'> {
  return {
    numeroDisplay: Number(o.numeroDisplay),
    nomeCliente: o.nomeCliente == null ? null : String(o.nomeCliente),
    tableId: o.tableId == null || o.tableId === undefined ? null : Number(o.tableId),
    nomeTavoloSnapshot:
      o.nomeTavoloSnapshot == null || o.nomeTavoloSnapshot === '' ? null : String(o.nomeTavoloSnapshot),
    createdAt: Number(o.createdAt),
    totaleCentesimi: Number(o.totaleCentesimi),
    createdByUserId: Number(o.createdByUserId),
    receiptSnapshot: String(o.receiptSnapshot),
  }
}

function pizzaLineToJson(pl: OrderLinePizzaEntity): Record<string, unknown> {
  return {
    pizzaId: pl.pizzaId,
    nomeSnapshot: pl.nomeSnapshot,
    prezzoBaseSnapshot: pl.prezzoBaseSnapshot,
    noteLibere: pl.noteLibere,
    lineIndex: pl.lineIndex,
    inviataInCucina: pl.inviataInCucina,
  }
}

function pizzaLineFromJson(o: Record<string, unknown>, orderId: number): Omit<OrderLinePizzaEntity, 'id'> {
  return {
    orderId,
    pizzaId: o.pizzaId == null ? null : Number(o.pizzaId),
    nomeSnapshot: String(o.nomeSnapshot),
    prezzoBaseSnapshot: Number(o.prezzoBaseSnapshot),
    noteLibere: o.noteLibere == null ? null : String(o.noteLibere),
    lineIndex: Number(o.lineIndex ?? 0),
    inviataInCucina: o.inviataInCucina === true,
  }
}

function modLineToJson(m: OrderLinePizzaModEntity): Record<string, unknown> {
  return {
    modificatoreId: m.modificatoreId,
    nome: m.nome,
    tipo: m.tipo,
    prezzoCentesimi: m.prezzoCentesimi,
  }
}

function modLineFromJson(o: Record<string, unknown>, pizzaLineId: number): Omit<OrderLinePizzaModEntity, 'id'> {
  return {
    pizzaLineId,
    modificatoreId: o.modificatoreId == null ? null : Number(o.modificatoreId),
    nome: String(o.nome),
    tipo: String(o.tipo),
    prezzoCentesimi: Number(o.prezzoCentesimi ?? 0),
  }
}

function bibLineToJson(b: OrderLineBibitaEntity): Record<string, unknown> {
  return {
    bibitaId: b.bibitaId,
    nomeSnapshot: b.nomeSnapshot,
    prezzoUnitarioSnapshot: b.prezzoUnitarioSnapshot,
    quantita: b.quantita,
    inviataInCucina: b.inviataInCucina,
  }
}

function bibLineFromJson(o: Record<string, unknown>, orderId: number): Omit<OrderLineBibitaEntity, 'id'> {
  return {
    orderId,
    bibitaId: o.bibitaId == null ? null : Number(o.bibitaId),
    nomeSnapshot: String(o.nomeSnapshot),
    prezzoUnitarioSnapshot: Number(o.prezzoUnitarioSnapshot),
    quantita: Number(o.quantita ?? 1),
    inviataInCucina: o.inviataInCucina === true,
  }
}

function tavoloToJson(t: TavoloEntity): Record<string, unknown> {
  return {
    nome: t.nome,
    nomeNorm: t.nomeNorm,
    attivo: t.attivo,
    lastPrintedAtMillis: t.lastPrintedAtMillis,
    comandaInviataAtMillis: t.comandaInviataAtMillis,
  }
}

function tavoloFromJson(o: Record<string, unknown>): Omit<TavoloEntity, 'id'> {
  return {
    nome: String(o.nome),
    nomeNorm: String(o.nomeNorm),
    attivo: o.attivo !== false,
    lastPrintedAtMillis: Number(o.lastPrintedAtMillis ?? 0),
    comandaInviataAtMillis: Number(o.comandaInviataAtMillis ?? 0),
  }
}

function printLogToJson(l: TablePrintLogEntity): Record<string, unknown> {
  return {
    tableId: l.tableId,
    printedAtMillis: l.printedAtMillis,
    summaryText: l.summaryText,
  }
}

function printLogFromJson(o: Record<string, unknown>): Omit<TablePrintLogEntity, 'id'> {
  return {
    tableId: Number(o.tableId),
    printedAtMillis: Number(o.printedAtMillis),
    summaryText: String(o.summaryText),
  }
}

export async function exportJson(): Promise<string> {
  const appRow = (await db.appState.get(1)) ?? defaultAppState()
  const root: Record<string, unknown> = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    appState: appStateToJson(appRow),
    users: (await db.users.toArray()).map(userToJson),
    pizze: (await db.pizze.toArray()).map(pizzaToJson),
    modificatori: (await db.modificatori.toArray()).map(modToJson),
    bibite: (await db.bibite.toArray()).map(bibToJson),
  }

  const orderDetails: Record<string, unknown>[] = []
  const orders = await db.orders.toArray()
  for (const order of orders) {
    const oid = order.id!
    const detail: Record<string, unknown> = {
      order: orderToJson(order),
      pizzaLines: (await db.orderLinePizza.where('orderId').equals(oid).toArray()).map(pizzaLineToJson),
      pizzaMods: [] as Record<string, unknown>[],
      bibitaLines: (await db.orderLineBibita.where('orderId').equals(oid).toArray()).map(bibLineToJson),
    }
    const pizzaLines = await db.orderLinePizza.where('orderId').equals(oid).toArray()
    const modsArray = detail.pizzaMods as Record<string, unknown>[]
    for (const pl of pizzaLines) {
      const mods = await db.orderLinePizzaMod.where('pizzaLineId').equals(pl.id!).toArray()
      for (const mod of mods) {
        const row = { ...modLineToJson(mod), pizzaLineIndex: pl.lineIndex }
        modsArray.push(row)
      }
    }
    orderDetails.push(detail)
  }
  root.orderDetails = orderDetails
  root.tavoli = (await db.tavoli.toArray()).map((t) => ({ id: t.id, ...tavoloToJson(t) }))
  root.tablePrintLog = (await db.tablePrintLog.toArray()).map((l) => ({ id: l.id, ...printLogToJson(l) }))
  return JSON.stringify(root, null, 2)
}

/**
 * Sostituisce solo `pizze`, `modificatori`, `bibite`.
 * Azzera `pizzaId` / `modificatoreId` / `bibitaId` sulle righe ordine storiche
 * (nomi e prezzi snapshot restano per ricevute).
 */
export async function importMenuCatalog(json: string): Promise<void> {
  const root = JSON.parse(json) as Record<string, unknown>
  const catVer = Number(root.schemaVersion ?? 0)
  if (catVer !== 1 && catVer !== 2) {
    throw new Error('Versione catalogo non supportata')
  }
  if (root.menuCatalog !== true) {
    throw new Error('File non è un catalogo menu (serve "menuCatalog": true)')
  }
  const pizze = root.pizze
  const modificatori = root.modificatori
  const bibite = root.bibite
  if (!Array.isArray(pizze) || !Array.isArray(modificatori) || !Array.isArray(bibite)) {
    throw new Error('pizze, modificatori e bibite devono essere array')
  }

  await db.transaction(
    'rw',
    [db.orderLinePizza, db.orderLinePizzaMod, db.orderLineBibita, db.pizze, db.modificatori, db.bibite],
    async () => {
      await db.orderLinePizza.toCollection().modify({ pizzaId: null })
      await db.orderLinePizzaMod.toCollection().modify({ modificatoreId: null })
      await db.orderLineBibita.toCollection().modify({ bibitaId: null })

      await db.pizze.clear()
      await db.modificatori.clear()
      await db.bibite.clear()

      for (const row of pizze) {
        await db.pizze.add(pizzaFromJson(row as Record<string, unknown>))
      }
      for (const row of modificatori) {
        await db.modificatori.add(modFromJson(row as Record<string, unknown>))
      }
      for (const row of bibite) {
        await db.bibite.add(bibFromJson(row as Record<string, unknown>))
      }
    },
  )
}

export async function importJson(json: string): Promise<void> {
  const root = JSON.parse(json) as Record<string, unknown>
  const ver = Number(root.schemaVersion ?? 0)
  if (ver !== 1 && ver !== 2) {
    throw new Error('Versione backup non supportata')
  }
  if (root.menuCatalog === true) {
    throw new Error('Questo è un catalogo menu (solo pizze/modificatori/bibite). Usa «Importa solo menu», non «Importa backup».')
  }
  if (root.appState == null || typeof root.appState !== 'object' || Array.isArray(root.appState)) {
    throw new Error('Backup non valido: manca il campo appState.')
  }
  if (!Array.isArray(root.users)) {
    throw new Error('Backup non valido: manca l\'array users.')
  }
  if (!Array.isArray(root.pizze) || !Array.isArray(root.modificatori) || !Array.isArray(root.bibite)) {
    throw new Error('Backup non valido: servono gli array pizze, modificatori e bibite.')
  }

  await db.transaction(
    'rw',
    [
      db.orders,
      db.orderLinePizza,
      db.orderLinePizzaMod,
      db.orderLineBibita,
      db.tablePrintLog,
      db.tavoli,
      db.users,
      db.pizze,
      db.modificatori,
      db.bibite,
      db.appState,
    ],
    async () => {
      await db.orderLinePizzaMod.clear()
      await db.orderLinePizza.clear()
      await db.orderLineBibita.clear()
      await db.orders.clear()
      await db.tablePrintLog.clear()
      await db.tavoli.clear()
      await db.users.clear()
      await db.pizze.clear()
      await db.modificatori.clear()
      await db.bibite.clear()

      const appJson = root.appState as Record<string, unknown>
      const current = (await db.appState.get(1)) ?? defaultAppState()
      await db.appState.put({ ...appStateFromJson(appJson, current), id: 1 })

      const users = (root.users as Record<string, unknown>[]).map(userFromJson)
      for (const u of dedupeImportedUsers(users)) {
        await db.users.add(u as UserEntity)
      }
      const pizze = root.pizze as Record<string, unknown>[]
      for (const p of pizze) {
        await db.pizze.add(pizzaFromJson(p))
      }
      const mods = root.modificatori as Record<string, unknown>[]
      for (const m of mods) {
        await db.modificatori.add(modFromJson(m))
      }
      const bibite = root.bibite as Record<string, unknown>[]
      for (const b of bibite) {
        await db.bibite.add(bibFromJson(b))
      }

      if (ver >= 2 && Array.isArray(root.tavoli)) {
        for (const row of root.tavoli as Record<string, unknown>[]) {
          const base = tavoloFromJson(row)
          const id = row.id == null ? undefined : Number(row.id)
          if (id != null && Number.isFinite(id)) {
            await db.tavoli.put({ ...base, id } as TavoloEntity)
          } else {
            await db.tavoli.add(base as TavoloEntity)
          }
        }
      }
      if (ver >= 2 && Array.isArray(root.tablePrintLog)) {
        for (const row of root.tablePrintLog as Record<string, unknown>[]) {
          const base = printLogFromJson(row)
          const id = row.id == null ? undefined : Number(row.id)
          if (id != null && Number.isFinite(id)) {
            await db.tablePrintLog.put({ ...base, id } as TablePrintLogEntity)
          } else {
            await db.tablePrintLog.add(base as TablePrintLogEntity)
          }
        }
      }

      if (Array.isArray(root.orderDetails)) {
        const details = root.orderDetails as Record<string, unknown>[]
        for (const d of details) {
          const order = orderFromJson(d.order as Record<string, unknown>)
          const orderId = (await db.orders.add(order as OrderEntity)) as number
          const pizzaLinesJson = d.pizzaLines as Record<string, unknown>[]
          const lineIdByIndex = new Map<number, number>()
          for (const plJson of pizzaLinesJson) {
            const pl = pizzaLineFromJson(plJson, orderId)
            const plId = (await db.orderLinePizza.add(pl as OrderLinePizzaEntity)) as number
            lineIdByIndex.set(pl.lineIndex, plId)
          }
          const modsJson = (d.pizzaMods ?? []) as Record<string, unknown>[]
          for (const m of modsJson) {
            const lineIndex = Number(m.pizzaLineIndex ?? 0)
            const pizzaLineId = lineIdByIndex.get(lineIndex)
            if (pizzaLineId == null) continue
            await db.orderLinePizzaMod.add(modLineFromJson(m, pizzaLineId) as OrderLinePizzaModEntity)
          }
          const bibitaJson = (d.bibitaLines ?? []) as Record<string, unknown>[]
          for (const b of bibitaJson) {
            await db.orderLineBibita.add(bibLineFromJson(b, orderId) as OrderLineBibitaEntity)
          }
        }
      }
    },
  )
}
