import Dexie, { type EntityTable, type Table } from 'dexie'
import { normalizeUsername } from '../domain/usernameNormalizer'
import { getPizzappDexieName } from './dexieDbName'

/** Object store attesi nella versione corrente dello schema. */
export const REQUIRED_STORES = [
  'users',
  'pizze',
  'modificatori',
  'bibite',
  'appState',
  'orders',
  'orderLinePizza',
  'orderLinePizzaMod',
  'orderLineBibita',
  'tavoli',
  'tablePrintLog',
] as const

const STORES_V3_AND_UP = {
  users: '++id, &usernameNorm, username, attivo, role',
  pizze: '++id, nome, attiva, ordineVisualizzazione',
  modificatori: '++id, nome, attiva, ordineVisualizzazione',
  bibite: '++id, nome, attiva, ordineVisualizzazione',
  appState: 'id',
  orders: '++id, createdAt, numeroDisplay, tableId',
  orderLinePizza: '++id, orderId, lineIndex',
  orderLinePizzaMod: '++id, pizzaLineId',
  orderLineBibita: '++id, orderId',
  tavoli: '++id, &nomeNorm, nome, attivo',
  tablePrintLog: '++id, tableId, printedAtMillis',
} as const
import type {
  AppStateEntity,
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
} from './types'

export class PizzappDB extends Dexie {
  users!: EntityTable<UserEntity, 'id'>
  pizze!: EntityTable<PizzaEntity, 'id'>
  modificatori!: EntityTable<ModificatoreEntity, 'id'>
  bibite!: EntityTable<BibitaEntity, 'id'>
  appState!: EntityTable<AppStateEntity, 'id'>
  orders!: EntityTable<OrderEntity, 'id'>
  orderLinePizza!: EntityTable<OrderLinePizzaEntity, 'id'>
  orderLinePizzaMod!: EntityTable<OrderLinePizzaModEntity, 'id'>
  orderLineBibita!: EntityTable<OrderLineBibitaEntity, 'id'>
  tavoli!: EntityTable<TavoloEntity, 'id'>
  tablePrintLog!: EntityTable<TablePrintLogEntity, 'id'>

  constructor() {
    super(getPizzappDexieName())
    this.version(1).stores({
      users: '++id, username, attivo, role',
      pizze: '++id, nome, attiva, ordineVisualizzazione',
      modificatori: '++id, nome, attiva, ordineVisualizzazione',
      bibite: '++id, nome, attiva, ordineVisualizzazione',
      appState: 'id',
      orders: '++id, createdAt, numeroDisplay',
      orderLinePizza: '++id, orderId, lineIndex',
      orderLinePizzaMod: '++id, pizzaLineId',
      orderLineBibita: '++id, orderId',
    })
    this.version(2)
      .stores({
        users: '++id, &usernameNorm, username, attivo, role',
        pizze: '++id, nome, attiva, ordineVisualizzazione',
        modificatori: '++id, nome, attiva, ordineVisualizzazione',
        bibite: '++id, nome, attiva, ordineVisualizzazione',
        appState: 'id',
        orders: '++id, createdAt, numeroDisplay',
        orderLinePizza: '++id, orderId, lineIndex',
        orderLinePizzaMod: '++id, pizzaLineId',
        orderLineBibita: '++id, orderId',
      })
      .upgrade(async (tx) => {
        const rows = await tx.table('users').toArray()
        const used = new Set<string>()
        for (const u of rows as { id?: number; username: string; usernameNorm?: string }[]) {
          let base = normalizeUsername(u.username)
          if (!base) base = 'user'
          let norm = base
          let n = 1
          while (used.has(norm)) {
            n += 1
            norm = `${base}_${n}`
          }
          used.add(norm)
          await tx.table('users').update(u.id!, { usernameNorm: norm })
        }
      })
    this.version(3)
      .stores({ ...STORES_V3_AND_UP })
      .upgrade(async () => {
        /* nuovi campi opzionali sugli ordini */
      })
    // Bump per DB bloccati a v3 senza tavoli/tablePrintLog (migrazione incompleta).
    this.version(4).stores({ ...STORES_V3_AND_UP })
    this.version(5).stores({ ...STORES_V3_AND_UP }).upgrade(async (tx) => {
      const rows = await tx.table('tavoli').toArray()
      for (const row of rows as { id?: number; comandaInviataAtMillis?: number }[]) {
        if (row.id != null && row.comandaInviataAtMillis == null) {
          await tx.table('tavoli').update(row.id, { comandaInviataAtMillis: 0 })
        }
      }
    })
  }
}

export const db = new PizzappDB()

/**
 * Apre il DB, applica migrazioni e — se mancano object store — ricrea IndexedDB.
 * Evita NotFoundError quando una transazione include store assenti (es. tablePrintLog).
 */
export async function ensurePizzappDatabaseReady(): Promise<void> {
  await db.open()
  const missing = REQUIRED_STORES.filter((name) => !db.tables.some((t) => t.name === name))
  if (missing.length === 0) return
  console.warn('[PizzappDB] schema incompleto, ricreo IndexedDB:', missing.join(', '))
  db.close()
  await db.delete()
  await db.open()
  const stillMissing = REQUIRED_STORES.filter((name) => !db.tables.some((t) => t.name === name))
  if (stillMissing.length > 0) {
    throw new Error(`Database locale non inizializzato (${stillMissing.join(', ')})`)
  }
}

export function pizzappOrderRwTables(includePrintLog: boolean): Table[] {
  const tables: Table[] = [
    db.orders,
    db.orderLinePizza,
    db.orderLinePizzaMod,
    db.orderLineBibita,
    db.appState,
    db.tavoli,
    db.users,
  ]
  if (includePrintLog) tables.push(db.tablePrintLog)
  return tables
}
