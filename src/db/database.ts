import Dexie, { type EntityTable } from 'dexie'
import { normalizeUsername } from '../domain/usernameNormalizer'
import { getPizzappDexieName } from './dexieDbName'
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
      .stores({
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
      })
      .upgrade(async () => {
        /* nuovi campi opzionali sugli ordini */
      })
  }
}

export const db = new PizzappDB()
