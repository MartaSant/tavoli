import { AppThemeMode, normalizeThemeMode } from '../domain/appThemeMode'
import { formatReceipt } from '../domain/receiptFormatter'
import type { ReceiptBibitaLine, ReceiptData, ReceiptModLine, ReceiptPizzaLine } from '../domain/receiptModels'
import { OrderNumberService } from '../domain/orderNumber'
import {
  ORDER_NOTE_LINE_NOME,
  cartHasOrderContent,
  createNoteOnlyCartLine,
} from '../domain/orderNoteLine'
import {
  type LiveKitchenTableBlock,
  toLiveKitchenPizzaLine,
} from '../domain/liveKitchenBoard'
import {
  buildSessionSummaryModel,
  type SessionSummaryBibitaRow,
  type SessionSummaryModel,
  type SessionSummaryPizzaRow,
} from '../domain/sessionSummaryModel'
import { type TavoloDisplayStatus, resolveTavoloDisplayStatus } from '../domain/tavoloDisplayStatus'
import { pizzaNomePerOrdine } from '../domain/pizzaNome'
import { normalizeUsername } from '../domain/usernameNormalizer'
import { PinHasher } from '../auth/pinHasher'
import { UserRole } from '../auth/userRole'
import { db, ensurePizzappDatabaseReady, pizzappOrderRwTables } from '../db/database'
import type {
  AppStateEntity,
  BibitaEntity,
  ModificatoreEntity,
  OrderEntity,
  OrderLineBibitaEntity,
  OrderLinePizzaModEntity,
  PizzaEntity,
  TavoloEntity,
  UserEntity,
} from '../db/types'
import type { CartBibitaLine, CartPizzaLine, OrderCartLoad } from './cartTypes'
import { lineTotalBibita, lineTotalPizza } from './cartTypes'

export const MENU_NAME_MAX = 35
export const HISTORY_HOURS_MS = 48 * 60 * 60 * 1000

async function deleteOrderAndLines(orderId: number): Promise<void> {
  const pizzaLines = await db.orderLinePizza.where('orderId').equals(orderId).toArray()
  for (const pl of pizzaLines) {
    await db.orderLinePizzaMod.where('pizzaLineId').equals(pl.id!).delete()
  }
  await db.orderLinePizza.where('orderId').equals(orderId).delete()
  await db.orderLineBibita.where('orderId').equals(orderId).delete()
  await db.orders.delete(orderId)
}

export const MenuClearScope = {
  ALL: 'ALL',
  PIZZE: 'PIZZE',
  MODIFICATORI: 'MODIFICATORI',
  BIBITE: 'BIBITE',
} as const
export type MenuClearScopeValue = (typeof MenuClearScope)[keyof typeof MenuClearScope]

export interface MenuCounts {
  pizze: number
  modificatori: number
  bibite: number
}

export async function getAppState(): Promise<AppStateEntity | undefined> {
  return db.appState.get(1)
}

export async function requireAppState(): Promise<AppStateEntity> {
  const row = await db.appState.get(1)
  if (!row) throw new Error('Stato app mancante')
  return row
}

export async function completeWizard(
  nomePizzeria: string,
  adminUsername: string,
  adminPin: string,
  recoveryCode: string,
): Promise<void> {
  await db.transaction('rw', [db.appState, db.users], async () => {
    const recoveryHash = PinHasher.hash(recoveryCode)
    await db.appState.put({
      id: 1,
      wizardCompletato: true,
      nomePizzeria: nomePizzeria.trim(),
      recoveryCodeHash: recoveryHash,
      nextOrderNumber: 1,
      confirmFeedback: 'VIBRATE',
      printerMac: null,
      themeMode: AppThemeMode.SYSTEM,
    })
    const adminTrim = adminUsername.trim()
    await db.users.add({
      username: adminTrim,
      usernameNorm: normalizeUsername(adminTrim),
      pinHash: PinHasher.hash(adminPin),
      role: UserRole.ADMIN,
      attivo: true,
    })
  })
}

export async function updateSettings(confirmFeedback: string, printerMac: string | null): Promise<void> {
  const current = await requireAppState()
  await db.appState.put({
    ...current,
    confirmFeedback,
    printerMac,
  })
}

export async function updateThemeMode(mode: string): Promise<void> {
  const current = await requireAppState()
  await db.appState.put({
    ...current,
    themeMode: normalizeThemeMode(mode),
  })
}

export async function toggleLightDarkFromResolved(currentlyDark: boolean): Promise<void> {
  await updateThemeMode(currentlyDark ? AppThemeMode.LIGHT : AppThemeMode.DARK)
}

/** Utenti attivi ordinati per username */
export async function usersActive(): Promise<UserEntity[]> {
  const all = await db.users.filter((u) => u.attivo).toArray()
  return all.sort((a, b) => a.username.localeCompare(b.username))
}

export async function usersAll(): Promise<UserEntity[]> {
  const all = await db.users.toArray()
  return all.sort((a, b) => a.username.localeCompare(b.username))
}

export async function getUserById(id: number): Promise<UserEntity | undefined> {
  return db.users.get(id)
}

export async function createUser(username: string, pin: string, role: string): Promise<void> {
  if (username.length > MENU_NAME_MAX) throw new Error('Username troppo lungo')
  const trimmed = username.trim()
  const norm = normalizeUsername(trimmed)
  if (!norm) throw new Error('Username obbligatorio')
  const clash = await db.users.where('usernameNorm').equals(norm).first()
  if (clash) throw new Error('Username già in uso')
  await db.users.add({
    username: trimmed,
    usernameNorm: norm,
    pinHash: PinHasher.hash(pin),
    role,
    attivo: true,
  })
}

export async function updateUser(
  id: number,
  username: string,
  pin: string | undefined,
  role: string,
  attivo: boolean,
): Promise<void> {
  const existing = await db.users.get(id)
  if (!existing) return
  const trimmed = username.trim()
  const norm = normalizeUsername(trimmed)
  if (!norm) throw new Error('Username obbligatorio')
  if (norm !== existing.usernameNorm) {
    const clash = await db.users.where('usernameNorm').equals(norm).first()
    if (clash && clash.id !== id) throw new Error('Username già in uso')
  }
  const hash = pin ? PinHasher.hash(pin) : existing.pinHash
  await db.users.update(id, { username: trimmed, usernameNorm: norm, pinHash: hash, role, attivo })
}

/** Disattiva utente (soft). Solo da pannello admin; `actingUserId` evita auto-disattivazione. */
export async function deactivateUser(actingUserId: number, targetUserId: number): Promise<void> {
  if (actingUserId === targetUserId) throw new Error('Non puoi disattivare l\'account con cui sei connesso')
  const target = await db.users.get(targetUserId)
  if (!target) throw new Error('Utente non trovato')
  if (!target.attivo) return
  if (target.role === UserRole.ADMIN) {
    const activeAdmins = await db.users.filter((u) => u.attivo && u.role === UserRole.ADMIN).toArray()
    if (activeAdmins.length <= 1) throw new Error('Non si può disattivare l\'ultimo amministratore attivo')
  }
  await db.users.update(targetUserId, { attivo: false })
}

export async function verifyPin(userId: number, pin: string): Promise<boolean> {
  const user = await db.users.get(userId)
  if (!user) return false
  return PinHasher.verify(pin, user.pinHash)
}

export async function resetAdminPinWithRecovery(recoveryCode: string, newPin: string): Promise<boolean> {
  const state = await db.appState.get(1)
  if (!state) return false
  if (!PinHasher.verify(recoveryCode, state.recoveryCodeHash)) return false
  const admins = (await usersActive()).filter((u) => u.role === UserRole.ADMIN)
  if (admins.length === 0) return false
  const admin = admins[0]
  if (admin.id == null) return false
  await db.users.update(admin.id, {
    pinHash: PinHasher.hash(newPin),
  })
  return true
}

async function countPizzaByName(nome: string, excludeId: number): Promise<number> {
  const trimmed = nome.trim()
  return db.pizze.filter((p) => p.nome === trimmed && (excludeId === 0 || p.id !== excludeId)).count()
}

async function countModByName(nome: string, excludeId: number): Promise<number> {
  const trimmed = nome.trim()
  return db.modificatori.filter((m) => m.nome === trimmed && (excludeId === 0 || m.id !== excludeId)).count()
}

async function countBibitaByName(nome: string, excludeId: number): Promise<number> {
  const trimmed = nome.trim()
  return db.bibite.filter((b) => b.nome === trimmed && (excludeId === 0 || b.id !== excludeId)).count()
}

async function ensureUniqueName(count: number) {
  if (count > 0) throw new Error('Nome già presente nel menu')
}

export async function upsertPizza(
  id: number,
  nome: string,
  prezzoCentesimi: number,
  attiva: boolean,
  ordine: number,
): Promise<void> {
  const trimmed = nome.trim().slice(0, MENU_NAME_MAX)
  if (!trimmed) throw new Error('Nome obbligatorio')
  await ensureUniqueName(await countPizzaByName(trimmed, id))
  if (id === 0) {
    await db.pizze.add({
      nome: trimmed,
      prezzoCentesimi,
      attiva,
      ordineVisualizzazione: ordine,
    })
  } else {
    await db.pizze.update(id, {
      nome: trimmed,
      prezzoCentesimi,
      attiva,
      ordineVisualizzazione: ordine,
    })
  }
}

export async function upsertModificatore(
  id: number,
  nome: string,
  prezzoCentesimi: number,
  attiva: boolean,
  ordine: number,
): Promise<void> {
  const trimmed = nome.trim().slice(0, MENU_NAME_MAX)
  if (!trimmed) throw new Error('Nome obbligatorio')
  await ensureUniqueName(await countModByName(trimmed, id))
  if (id === 0) {
    await db.modificatori.add({
      nome: trimmed,
      prezzoCentesimi,
      attiva,
      ordineVisualizzazione: ordine,
    })
  } else {
    await db.modificatori.update(id, {
      nome: trimmed,
      prezzoCentesimi,
      attiva,
      ordineVisualizzazione: ordine,
    })
  }
}

export async function upsertBibita(
  id: number,
  nome: string,
  prezzoCentesimi: number,
  attiva: boolean,
  ordine: number,
): Promise<void> {
  const trimmed = nome.trim().slice(0, MENU_NAME_MAX)
  if (!trimmed) throw new Error('Nome obbligatorio')
  await ensureUniqueName(await countBibitaByName(trimmed, id))
  if (id === 0) {
    await db.bibite.add({
      nome: trimmed,
      prezzoCentesimi,
      attiva,
      ordineVisualizzazione: ordine,
    })
  } else {
    await db.bibite.update(id, {
      nome: trimmed,
      prezzoCentesimi,
      attiva,
      ordineVisualizzazione: ordine,
    })
  }
}

export async function clearMenu(scope: MenuClearScopeValue): Promise<void> {
  switch (scope) {
    case MenuClearScope.ALL:
      await db.pizze.clear()
      await db.modificatori.clear()
      await db.bibite.clear()
      break
    case MenuClearScope.PIZZE:
      await db.pizze.clear()
      break
    case MenuClearScope.MODIFICATORI:
      await db.modificatori.clear()
      break
    case MenuClearScope.BIBITE:
      await db.bibite.clear()
      break
  }
}

export async function menuCounts(): Promise<MenuCounts> {
  return {
    pizze: await db.pizze.count(),
    modificatori: await db.modificatori.count(),
    bibite: await db.bibite.count(),
  }
}

export async function deletePizzaById(id: number): Promise<void> {
  await db.pizze.delete(id)
}
export async function deleteModificatoreById(id: number): Promise<void> {
  await db.modificatori.delete(id)
}
export async function deleteBibitaById(id: number): Promise<void> {
  await db.bibite.delete(id)
}

export async function searchPizzeActive(q: string): Promise<PizzaEntity[]> {
  const qq = q.toLowerCase()
  const list = await db.pizze.filter((p) => p.attiva && p.nome.toLowerCase().includes(qq)).toArray()
  return list.sort((a, b) => {
    const o = a.ordineVisualizzazione - b.ordineVisualizzazione
    return o !== 0 ? o : a.nome.localeCompare(b.nome)
  })
}

export async function searchBibiteActive(q: string): Promise<BibitaEntity[]> {
  const qq = q.toLowerCase()
  const list = await db.bibite.filter((b) => b.attiva && b.nome.toLowerCase().includes(qq)).toArray()
  return list.sort((a, b) => {
    const o = a.ordineVisualizzazione - b.ordineVisualizzazione
    return o !== 0 ? o : a.nome.localeCompare(b.nome)
  })
}

export async function searchModsActive(q: string): Promise<ModificatoreEntity[]> {
  const qq = q.toLowerCase()
  const list = await db.modificatori.filter((m) => m.attiva && m.nome.toLowerCase().includes(qq)).toArray()
  return list.sort((a, b) => {
    const o = a.ordineVisualizzazione - b.ordineVisualizzazione
    return o !== 0 ? o : a.nome.localeCompare(b.nome)
  })
}

export async function modsActive(): Promise<ModificatoreEntity[]> {
  const list = await db.modificatori.filter((m) => m.attiva).toArray()
  return list.sort((a, b) => {
    const o = a.ordineVisualizzazione - b.ordineVisualizzazione
    return o !== 0 ? o : a.nome.localeCompare(b.nome)
  })
}

function buildReceipt(
  nomeCliente: string | null | undefined,
  nomeTavolo: string | null | undefined,
  numero: number,
  pizze: CartPizzaLine[],
  bibite: CartBibitaLine[],
  nomeOperatore?: string | null,
  orderLabelOverride?: string | null,
): ReceiptData {
  const pizzaLines: ReceiptPizzaLine[] = pizze.map((p) => ({
    nome: p.nome,
    prezzoBaseCentesimi: p.prezzoBaseCentesimi,
    extras: p.mods
      .filter((m) => m.tipo === 'EXTRA')
      .map((m): ReceiptModLine => ({ nome: m.nome, prezzoCentesimi: m.prezzoCentesimi })),
    removals: p.mods.filter((m) => m.tipo === 'REMOVAL').map((m) => m.nome),
    nota: p.nota,
  }))
  const bibitaLines: ReceiptBibitaLine[] = bibite.map((b) => ({
    nome: b.nome,
    prezzoUnitarioCentesimi: b.prezzoUnitarioCentesimi,
    quantita: b.quantita,
  }))
  const totale = pizze.reduce((s, p) => s + lineTotalPizza(p), 0) + bibite.reduce((s, b) => s + lineTotalBibita(b), 0)
  return {
    nomeOperatore: nomeOperatore?.trim() || undefined,
    nomeCliente,
    nomeTavolo: nomeTavolo?.trim() || undefined,
    createdAtMillis: Date.now(),
    numeroDisplay: numero,
    orderLabelOverride: orderLabelOverride?.trim() || undefined,
    pizze: pizzaLines,
    bibite: bibitaLines,
    totaleCentesimi: totale,
  }
}

export function previewOrderSnapshot(
  nomeCliente: string | null | undefined,
  nomeTavolo: string | null | undefined,
  numeroDisplay: number,
  pizze: CartPizzaLine[],
  bibite: CartBibitaLine[],
  nomeOperatore?: string | null,
): string {
  if (!cartHasOrderContent(pizze, bibite)) throw new Error("Aggiungi almeno una voce o una nota all'ordine")
  const receipt = buildReceipt(nomeCliente, nomeTavolo, numeroDisplay, pizze, bibite, nomeOperatore, null)
  return formatReceipt(receipt)
}

function bibitaLineKey(row: {
  bibitaId: number | null
  nomeSnapshot: string
  prezzoUnitarioSnapshot: number
}): string {
  return `${row.bibitaId ?? 'x'}|${row.nomeSnapshot}|${row.prezzoUnitarioSnapshot}`
}

/** Nel riepilogo: righe non inviate sempre separate; le inviate uguali si accorpano in visualizzazione. */
function appendSessionSummaryBibita(out: SessionSummaryBibitaRow[], row: SessionSummaryBibitaRow): void {
  if (row.highlight) {
    out.push({ ...row })
    return
  }
  const last = out[out.length - 1]
  if (
    last &&
    !last.highlight &&
    last.nome === row.nome &&
    last.prezzoUnitarioCentesimi === row.prezzoUnitarioCentesimi
  ) {
    last.quantita += row.quantita
    return
  }
  out.push({ ...row })
}

/** Dopo invio comanda: accorpa bibite uguali nel DB e marca tutto inviato. */
async function consolidateSessionBibiteForTable(tableId: number, afterMillis: number): Promise<void> {
  const orders = await ordersForTableSince(tableId, afterMillis)
  if (orders.length === 0) return

  type BibRow = OrderLineBibitaEntity & { orderCreatedAt: number }
  const all: BibRow[] = []
  for (const order of orders) {
    const rows = await db.orderLineBibita.where('orderId').equals(order.id!).toArray()
    for (const row of rows) {
      all.push({ ...row, orderCreatedAt: order.createdAt })
    }
  }
  if (all.length === 0) return

  const groups = new Map<string, BibRow[]>()
  for (const row of all) {
    const k = bibitaLineKey(row)
    const g = groups.get(k) ?? []
    g.push(row)
    groups.set(k, g)
  }

  await db.transaction('rw', [db.orderLineBibita, db.orders], async () => {
    for (const rows of groups.values()) {
      const sorted = [...rows].sort((a, b) => {
        if (a.orderCreatedAt !== b.orderCreatedAt) return a.orderCreatedAt - b.orderCreatedAt
        return (a.id ?? 0) - (b.id ?? 0)
      })
      const keeper = sorted[0]
      const totalQty = sorted.reduce((s, r) => s + r.quantita, 0)
      if (keeper.id != null) {
        await db.orderLineBibita.update(keeper.id, {
          quantita: totalQty,
          inviataInCucina: true,
        })
      }
      for (let i = 1; i < sorted.length; i++) {
        const id = sorted[i].id
        if (id != null) await db.orderLineBibita.delete(id)
      }
    }

    for (const order of orders) {
      const oid = order.id!
      const pizzaCount = await db.orderLinePizza.where('orderId').equals(oid).count()
      const bibCount = await db.orderLineBibita.where('orderId').equals(oid).count()
      if (pizzaCount === 0 && bibCount === 0) {
        await deleteOrderAndLines(oid)
      }
    }
  })
}

export async function saveOrder(
  tableId: number,
  nomeTavoloSnapshot: string,
  createdByUserId: number,
  pizze: CartPizzaLine[],
  bibite: CartBibitaLine[],
  nomeOperatore?: string | null,
  replaceSessionOrderIds?: number[] | null,
): Promise<OrderEntity> {
  if (!cartHasOrderContent(pizze, bibite)) throw new Error("Aggiungi almeno una voce o una nota all'ordine")
  await ensurePizzappDatabaseReady()

  const tavolo = await db.tavoli.get(tableId)
  if (!tavolo) throw new Error('Tavolo non trovato')
  const idsToDelete = [...new Set((replaceSessionOrderIds ?? []).filter((id) => id > 0))]
  const replacing = idsToDelete.length > 0
  const finalPizze = pizze
  const finalBibite = bibite

  return db.transaction('rw', pizzappOrderRwTables(idsToDelete.length > 0), async () => {
    if (idsToDelete.length > 0) {
      await db.tablePrintLog.where('tableId').equals(tableId).delete()
      for (const oid of idsToDelete) {
        await deleteOrderAndLines(oid)
      }
    }
    let state = await db.appState.get(1)
    if (!state) throw new Error('Configurazione mancante: completa il wizard')
    const numero = state.nextOrderNumber
    const op =
      nomeOperatore?.trim() ||
      (await db.users.get(createdByUserId))?.username ||
      undefined
    const receipt = buildReceipt(null, nomeTavoloSnapshot, numero, finalPizze, finalBibite, op, null)
    const snapshot = formatReceipt(receipt)
    const totale = receipt.totaleCentesimi
    const now = Date.now()
    const orderId = (await db.orders.add({
      numeroDisplay: numero,
      nomeCliente: null,
      tableId,
      nomeTavoloSnapshot,
      createdAt: now,
      totaleCentesimi: totale,
      createdByUserId,
      receiptSnapshot: snapshot,
    })) as number

    for (let index = 0; index < finalPizze.length; index++) {
      const line = finalPizze[index]
      const pizzaLineId = (await db.orderLinePizza.add({
        orderId,
        pizzaId: line.pizzaId,
        nomeSnapshot: line.nome,
        prezzoBaseSnapshot: line.prezzoBaseCentesimi,
        noteLibere: line.nota?.trim() ? line.nota : null,
        lineIndex: index,
        inviataInCucina: replacing ? (line.inviataInCucina ?? false) : false,
      })) as number
      const modRows: Omit<OrderLinePizzaModEntity, 'id'>[] = line.mods.map((mod) => ({
        pizzaLineId,
        modificatoreId: mod.modificatoreId,
        nome: mod.nome,
        tipo: mod.tipo,
        prezzoCentesimi: mod.tipo === 'EXTRA' ? mod.prezzoCentesimi : 0,
      }))
      if (modRows.length > 0) {
        await db.orderLinePizzaMod.bulkAdd(modRows)
      }
    }

    if (finalBibite.length > 0) {
      await db.orderLineBibita.bulkAdd(
        finalBibite.map(
          (b): Omit<OrderLineBibitaEntity, 'id'> => ({
            orderId,
            bibitaId: b.bibitaId,
            nomeSnapshot: b.nome,
            prezzoUnitarioSnapshot: b.prezzoUnitarioCentesimi,
            quantita: b.quantita,
            inviataInCucina: replacing ? (b.inviataInCucina ?? false) : false,
          }),
        ),
      )
    }

    const next = OrderNumberService.nextAfter(numero)
    await db.appState.put({ ...state, nextOrderNumber: next })

    await db.tavoli.update(tableId, { comandaInviataAtMillis: 0 })

    const saved = await db.orders.get(orderId)
    if (!saved) throw new Error('Ordine non salvato')
    return saved
  })
}

export async function getOrdersSince(since: number): Promise<OrderEntity[]> {
  const all = await db.orders.filter((o) => o.createdAt >= since).toArray()
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getOrderById(id: number): Promise<OrderEntity | undefined> {
  return db.orders.get(id)
}

export async function purgeOldOrders(): Promise<void> {
  const before = Date.now() - HISTORY_HOURS_MS
  const oldOrders = await db.orders.filter((o) => o.createdAt < before).toArray()
  for (const ord of oldOrders) {
    const oid = ord.id!
    const pizzaLines = await db.orderLinePizza.where('orderId').equals(oid).toArray()
    for (const pl of pizzaLines) {
      const pid = pl.id!
      await db.orderLinePizzaMod.where('pizzaLineId').equals(pid).delete()
    }
    await db.orderLinePizza.where('orderId').equals(oid).delete()
    await db.orderLineBibita.where('orderId').equals(oid).delete()
    await db.orders.delete(oid)
  }
}

export async function clearAllOrders(): Promise<void> {
  await db.orderLinePizzaMod.clear()
  await db.orderLinePizza.clear()
  await db.orderLineBibita.clear()
  await db.orders.clear()
}

export async function loadOrderIntoCart(orderId: number): Promise<OrderCartLoad> {
  const order = await db.orders.get(orderId)
  if (!order) throw new Error('Ordine non trovato')
  const pizzaRows = (await db.orderLinePizza.where('orderId').equals(orderId).toArray()).sort(
    (a, b) => a.lineIndex - b.lineIndex,
  )
  const bibRows = await db.orderLineBibita.where('orderId').equals(orderId).toArray()
  if (pizzaRows.length === 0 && bibRows.length === 0) {
    throw new Error('Questo ordine non ha righe da caricare')
  }
  const pizze: CartPizzaLine[] = []
  for (let idx = 0; idx < pizzaRows.length; idx++) {
    const row = pizzaRows[idx]
    const plId = row.id!
    const modEnts = await db.orderLinePizzaMod.where('pizzaLineId').equals(plId).toArray()
    const mods = modEnts.map((m) => ({
      modificatoreId: m.modificatoreId,
      nome: m.nome,
      tipo: m.tipo,
      prezzoCentesimi: m.prezzoCentesimi,
    }))
    pizze.push(cartPizzaLineFromDbRow(row, newLocalIdFallback(idx), mods))
  }
  const bibite: CartBibitaLine[] = bibRows.map((row, idx) => ({
    localId: newLocalIdFallback(idx + 10000),
    bibitaId: row.bibitaId,
    nome: row.nomeSnapshot,
    prezzoUnitarioCentesimi: row.prezzoUnitarioSnapshot,
    quantita: row.quantita,
    inviataInCucina: row.inviataInCucina ?? false,
  }))
  return {
    nomeCliente: order.nomeCliente,
    tableId: order.tableId ?? null,
    nomeTavoloSnapshot: order.nomeTavoloSnapshot ?? null,
    pizze,
    bibite,
    sessionOrderIdsToReplaceOnSave: [orderId],
  }
}

function newLocalIdFallback(salt: number): number {
  return Math.floor(Date.now() * 1000 + salt + Math.random() * 1e6)
}

function cartPizzaLineFromDbRow(
  row: {
    pizzaId: number | null
    nomeSnapshot: string
    prezzoBaseSnapshot: number
    noteLibere: string | null
    inviataInCucina?: boolean
  },
  localId: number,
  mods: CartPizzaLine['mods'],
): CartPizzaLine {
  if (
    row.pizzaId == null &&
    row.prezzoBaseSnapshot === 0 &&
    row.nomeSnapshot === ORDER_NOTE_LINE_NOME
  ) {
    return createNoteOnlyCartLine(row.noteLibere ?? '', localId)
  }
  return {
    localId,
    pizzaId: row.pizzaId,
    nome: pizzaNomePerOrdine(row.nomeSnapshot),
    prezzoBaseCentesimi: row.prezzoBaseSnapshot,
    mods,
    nota: row.noteLibere,
    inviataInCucina: row.inviataInCucina ?? false,
  }
}

export async function createTavolo(nome: string): Promise<number> {
  const trimmed = nome.trim().slice(0, MENU_NAME_MAX)
  if (!trimmed) throw new Error('Nome tavolo obbligatorio')
  const norm = normalizeUsername(trimmed)
  if (!norm) throw new Error('Nome tavolo non valido')
  const clash = await db.tavoli.where('nomeNorm').equals(norm).first()
  if (clash?.attivo) throw new Error('Nome tavolo già in uso')
  if (clash && clash.id != null && !clash.attivo) {
    await db.tavoli.update(clash.id, {
      nomeNorm: `${clash.nomeNorm}__inactive_${clash.id}__`,
    })
  }
  return (await db.tavoli.add({
    nome: trimmed,
    nomeNorm: norm,
    attivo: true,
    lastPrintedAtMillis: 0,
    comandaInviataAtMillis: 0,
  })) as number
}

export async function deactivateTavolo(id: number): Promise<void> {
  const t = await db.tavoli.get(id)
  if (!t) return
  await db.tavoli.update(id, {
    attivo: false,
    nomeNorm: `${t.nomeNorm}__inactive_${id}__`,
  })
}

export async function getActiveTavoli(): Promise<TavoloEntity[]> {
  const all = await db.tavoli.filter((t) => t.attivo).toArray()
  return all.sort((a, b) => a.nome.localeCompare(b.nome))
}

/** True se il tavolo ha almeno un ordine nella sessione corrente (dopo l'ultima stampa). */
export async function tableHasSessionOrders(tableId: number): Promise<boolean> {
  await ensurePizzappDatabaseReady()
  const tavolo = await db.tavoli.get(tableId)
  if (!tavolo) return false
  const after = tavolo.lastPrintedAtMillis ?? 0
  const count = await db.orders
    .filter((o) => o.tableId === tableId && o.createdAt > after)
    .count()
  return count > 0
}

export async function tableHasUnsentKitchenLines(tableId: number): Promise<boolean> {
  await ensurePizzappDatabaseReady()
  const tavolo = await db.tavoli.get(tableId)
  if (!tavolo) return false
  const orders = await ordersForTableSince(tableId, tavolo.lastPrintedAtMillis ?? 0)
  for (const order of orders) {
    const oid = order.id!
    const pizzas = await db.orderLinePizza.where('orderId').equals(oid).toArray()
    if (pizzas.some((p) => !(p.inviataInCucina ?? false))) return true
    const bibite = await db.orderLineBibita.where('orderId').equals(oid).toArray()
    if (bibite.some((b) => !(b.inviataInCucina ?? false))) return true
  }
  return false
}

export type ActiveTavoloRow = TavoloEntity & {
  hasSessionOrders: boolean
  displayStatus: TavoloDisplayStatus
}

export async function getActiveTavoliWithSessionState(): Promise<ActiveTavoloRow[]> {
  const tavoli = await getActiveTavoli()
  return Promise.all(
    tavoli.map(async (t) => {
      const hasSessionOrders = await tableHasSessionOrders(t.id!)
      const hasUnsent = hasSessionOrders ? await tableHasUnsentKitchenLines(t.id!) : false
      return {
        ...t,
        comandaInviataAtMillis: t.comandaInviataAtMillis ?? 0,
        hasSessionOrders,
        displayStatus: resolveTavoloDisplayStatus(hasSessionOrders, hasUnsent),
      }
    }),
  )
}

/** Marca «comanda inviata» sui tavoli selezionati con righe ancora da inviare. */
export async function inviaComandeSessioni(tableIds: number[]): Promise<number> {
  await ensurePizzappDatabaseReady()
  if (tableIds.length === 0) return 0
  const now = Date.now()
  let count = 0
  const unique = [...new Set(tableIds.filter((id) => id > 0))]
  for (const tableId of unique) {
    if (!(await tableHasSessionOrders(tableId))) continue
    if (!(await tableHasUnsentKitchenLines(tableId))) continue
    const tavolo = await db.tavoli.get(tableId)
    if (!tavolo) continue
    const orders = await ordersForTableSince(tableId, tavolo.lastPrintedAtMillis ?? 0)
    const after = tavolo.lastPrintedAtMillis ?? 0
    for (const order of orders) {
      const oid = order.id!
      const pizzas = await db.orderLinePizza.where('orderId').equals(oid).toArray()
      for (const p of pizzas) {
        if (p.id != null) await db.orderLinePizza.update(p.id, { inviataInCucina: true })
      }
      const bibite = await db.orderLineBibita.where('orderId').equals(oid).toArray()
      for (const b of bibite) {
        if (b.id != null) await db.orderLineBibita.update(b.id, { inviataInCucina: true })
      }
    }
    await consolidateSessionBibiteForTable(tableId, after)
    await db.tavoli.update(tableId, { comandaInviataAtMillis: now })
    count++
  }
  return count
}

export async function commitSessionPrint(tableId: number, summaryText: string): Promise<void> {
  await ensurePizzappDatabaseReady()
  const now = Date.now()
  await db.transaction('rw', [db.tablePrintLog, db.tavoli], async () => {
    await db.tablePrintLog.add({ tableId, printedAtMillis: now, summaryText })
    await db.tavoli.update(tableId, { lastPrintedAtMillis: now })
  })
}

export async function ordersForTableSince(tableId: number, afterMillis: number): Promise<OrderEntity[]> {
  const all = await db.orders.filter((o) => o.tableId === tableId && o.createdAt > afterMillis).toArray()
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function ordersForTableBetween(
  tableId: number,
  afterMillis: number,
  beforeMillisInclusive: number,
): Promise<OrderEntity[]> {
  const all = await db.orders
    .filter(
      (o) =>
        o.tableId === tableId &&
        o.createdAt > afterMillis &&
        o.createdAt <= beforeMillisInclusive,
    )
    .toArray()
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

async function sessionStartMillisForPrintLog(
  tableId: number,
  printedAtMillis: number,
): Promise<number> {
  const logs = await db.tablePrintLog.where('tableId').equals(tableId).toArray()
  const prev = logs
    .filter((l) => l.printedAtMillis < printedAtMillis)
    .sort((a, b) => b.printedAtMillis - a.printedAtMillis)[0]
  return prev?.printedAtMillis ?? 0
}

/** Carrello dalla sessione chiusa associata a una riga di `tablePrintLog`. */
export async function loadSessionFromPrintLog(printLogId: number): Promise<{
  load: OrderCartLoad
  suggestedTableName: string
}> {
  await ensurePizzappDatabaseReady()
  const log = await db.tablePrintLog.get(printLogId)
  if (!log) throw new Error('Stampa non trovata')
  const tavolo = await db.tavoli.get(log.tableId)
  const afterMillis = await sessionStartMillisForPrintLog(log.tableId, log.printedAtMillis)
  const orders = await ordersForTableBetween(log.tableId, afterMillis, log.printedAtMillis)
  if (orders.length === 0) {
    throw new Error(
      'Nessun ordine recuperabile per questa stampa (sessione vuota o dati già rimossi dallo storico)',
    )
  }
  const { pizze, bibite } = await flattenSessionOrdersIntoLines(orders)
  return {
    suggestedTableName: tavolo?.nome?.trim() || `Tavolo ${log.tableId}`,
    load: {
      nomeCliente: null,
      pizze,
      bibite,
      sessionOrderIdsToReplaceOnSave: null,
    },
  }
}

/** Crea un tavolo attivo e salva subito la sessione della stampa come ordine sul tavolo. */
export async function recreateTavoloFromPrintLog(
  printLogId: number,
  nomeTavolo: string,
  createdByUserId: number,
  nomeOperatore?: string | null,
): Promise<{ tableId: number; nome: string }> {
  const { load } = await loadSessionFromPrintLog(printLogId)
  const tableId = await createTavolo(nomeTavolo)
  const row = await db.tavoli.get(tableId)
  const nome = row?.nome?.trim() || nomeTavolo.trim()
  await saveOrder(tableId, nome, createdByUserId, load.pizze, load.bibite, nomeOperatore, null)
  return { tableId, nome }
}

async function flattenSessionOrdersIntoLines(orders: OrderEntity[]): Promise<{ pizze: CartPizzaLine[]; bibite: CartBibitaLine[] }> {
  const pizze: CartPizzaLine[] = []
  const bibite: CartBibitaLine[] = []
  let salt = 0
  for (const order of orders) {
    const oid = order.id!
    const pizzaRows = (await db.orderLinePizza.where('orderId').equals(oid).toArray()).sort((a, b) => a.lineIndex - b.lineIndex)
    for (const row of pizzaRows) {
      salt++
      const plId = row.id!
      const modEnts = await db.orderLinePizzaMod.where('pizzaLineId').equals(plId).toArray()
      const mods = modEnts.map((m) => ({
        modificatoreId: m.modificatoreId,
        nome: m.nome,
        tipo: m.tipo,
        prezzoCentesimi: m.prezzoCentesimi,
      }))
      pizze.push(cartPizzaLineFromDbRow(row, newLocalIdFallback(salt), mods))
    }
    const bibRows = await db.orderLineBibita.where('orderId').equals(oid).toArray()
    for (const row of bibRows) {
      salt++
      bibite.push({
        localId: newLocalIdFallback(salt + 50000),
        bibitaId: row.bibitaId,
        nome: row.nomeSnapshot,
        prezzoUnitarioCentesimi: row.prezzoUnitarioSnapshot,
        quantita: row.quantita,
        inviataInCucina: row.inviataInCucina ?? false,
      })
    }
  }
  return { pizze, bibite }
}

async function loadSessionSummaryRows(
  tableId: number,
): Promise<{
  tavoloNome: string
  orders: OrderEntity[]
  pizze: SessionSummaryPizzaRow[]
  bibite: SessionSummaryBibitaRow[]
  totaleCentesimi: number
} | null> {
  const tavolo = await db.tavoli.get(tableId)
  if (!tavolo) return null
  const orders = await ordersForTableSince(tableId, tavolo.lastPrintedAtMillis ?? 0)
  if (orders.length === 0) return null
  const pizze: SessionSummaryPizzaRow[] = []
  const bibite: SessionSummaryBibitaRow[] = []
  for (const order of orders) {
    const oid = order.id!
    const pizzaRows = (await db.orderLinePizza.where('orderId').equals(oid).toArray()).sort(
      (a, b) => a.lineIndex - b.lineIndex,
    )
    for (const row of pizzaRows) {
      const plId = row.id!
      const modEnts = await db.orderLinePizzaMod.where('pizzaLineId').equals(plId).toArray()
      const highlight = !(row.inviataInCucina ?? false)
      pizze.push({
        nome: pizzaNomePerOrdine(row.nomeSnapshot),
        prezzoBaseCentesimi: row.prezzoBaseSnapshot,
        extras: modEnts
          .filter((m) => m.tipo === 'EXTRA')
          .map((m) => ({ nome: m.nome, prezzoCentesimi: m.prezzoCentesimi })),
        removals: modEnts.filter((m) => m.tipo === 'REMOVAL').map((m) => m.nome),
        nota: row.noteLibere,
        highlight,
      })
    }
    const bibRows = await db.orderLineBibita.where('orderId').equals(oid).toArray()
    for (const row of bibRows) {
      appendSessionSummaryBibita(bibite, {
        nome: row.nomeSnapshot,
        prezzoUnitarioCentesimi: row.prezzoUnitarioSnapshot,
        quantita: row.quantita,
        highlight: !(row.inviataInCucina ?? false),
      })
    }
  }
  const totale =
    pizze.reduce(
      (s, p) =>
        s +
        p.prezzoBaseCentesimi +
        p.extras.reduce((e, x) => e + x.prezzoCentesimi, 0),
      0,
    ) + bibite.reduce((s, b) => s + b.prezzoUnitarioCentesimi * b.quantita, 0)
  return { tavoloNome: tavolo.nome, orders, pizze, bibite, totaleCentesimi: totale }
}

export async function buildSessionSummaryModelForTable(
  tableId: number,
): Promise<SessionSummaryModel | null> {
  await ensurePizzappDatabaseReady()
  const data = await loadSessionSummaryRows(tableId)
  if (!data) return null
  const last = data.orders[data.orders.length - 1]
  const op = (await db.users.get(last.createdByUserId))?.username
  return buildSessionSummaryModel({
    nomeOperatore: op?.trim() || undefined,
    nomeTavolo: data.tavoloNome,
    createdAtMillis: Date.now(),
    numeroDisplay: last.numeroDisplay,
    pizze: data.pizze,
    bibite: data.bibite,
    totaleCentesimi: data.totaleCentesimi,
  })
}

/** Pizze in attesa (non inviate) da tutti i tavoli attivi con sessione — per riepilogo live cucina. */
export async function getLiveKitchenPendingPizzas(): Promise<LiveKitchenTableBlock[]> {
  await ensurePizzappDatabaseReady()
  const tavoli = await getActiveTavoli()
  const blocks: LiveKitchenTableBlock[] = []
  for (const t of tavoli) {
    if (t.id == null) continue
    const after = t.lastPrintedAtMillis ?? 0
    const orders = await ordersForTableSince(t.id, after)
    if (orders.length === 0) continue
    const pizze: LiveKitchenTableBlock['pizze'] = []
    for (const order of orders) {
      const oid = order.id!
      const pizzaRows = (await db.orderLinePizza.where('orderId').equals(oid).toArray()).sort(
        (a, b) => a.lineIndex - b.lineIndex,
      )
      for (const row of pizzaRows) {
        if (row.inviataInCucina ?? false) continue
        const modEnts = await db.orderLinePizzaMod.where('pizzaLineId').equals(row.id!).toArray()
        const line = toLiveKitchenPizzaLine({
          nome: pizzaNomePerOrdine(row.nomeSnapshot),
          prezzoBaseCentesimi: row.prezzoBaseSnapshot,
          extras: modEnts.filter((m) => m.tipo === 'EXTRA').map((m) => ({ nome: m.nome })),
          removals: modEnts.filter((m) => m.tipo === 'REMOVAL').map((m) => m.nome),
          nota: row.noteLibere,
        })
        if (line) pizze.push(line)
      }
    }
    if (pizze.length > 0) {
      blocks.push({ tableId: t.id, tableName: t.nome, pizze })
    }
  }
  return blocks.sort((a, b) => a.tableName.localeCompare(b.tableName, 'it'))
}

export async function formatSessionSummaryText(tableId: number): Promise<string> {
  const tavolo = await db.tavoli.get(tableId)
  if (!tavolo) return 'Tavolo non trovato.'
  const model = await buildSessionSummaryModelForTable(tableId)
  if (!model) return `Nessun ordine in sessione per «${tavolo.nome}».`
  return model.plainText
}

export async function loadMergedSessionIntoCart(tableId: number): Promise<OrderCartLoad> {
  const tavolo = await db.tavoli.get(tableId)
  if (!tavolo) throw new Error('Tavolo non trovato')
  const orders = await ordersForTableSince(tableId, tavolo.lastPrintedAtMillis ?? 0)
  if (orders.length === 0) throw new Error('Nessun ordine in sessione per questo tavolo')
  const { pizze, bibite } = await flattenSessionOrdersIntoLines(orders)
  const orderIds = orders.map((o) => o.id!).filter((id) => id > 0)
  return {
    nomeCliente: null,
    tableId,
    nomeTavoloSnapshot: tavolo.nome,
    pizze,
    bibite,
    sessionOrderIdsToReplaceOnSave: orderIds.length > 0 ? orderIds : null,
  }
}
