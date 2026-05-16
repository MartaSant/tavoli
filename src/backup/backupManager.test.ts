import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { exportMenuCatalogJson, importJson, importMenuCatalog } from './backupManager'
import { db } from '../db/database'
import { defaultAppState } from '../db/types'

const menuPayload = () =>
  JSON.stringify({
    schemaVersion: 1,
    menuCatalog: true,
    pizze: [
      {
        nome: 'Margherita — Pomodoro, fior di latte, formaggio, olio d\'oliva e basilico',
        prezzoCentesimi: 800,
        attiva: true,
        ordineVisualizzazione: 0,
      },
    ],
    modificatori: [{ nome: 'Extra mozzarella', prezzoCentesimi: 100, attiva: true, ordineVisualizzazione: 0 }],
    bibite: [{ nome: 'Acqua', prezzoCentesimi: 100, attiva: true, ordineVisualizzazione: 0 }],
  })

describe('importMenuCatalog', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.appState.add(defaultAppState())

    await db.pizze.add({
      nome: 'Vecchia',
      prezzoCentesimi: 999,
      attiva: true,
      ordineVisualizzazione: 0,
    })
    await db.modificatori.add({
      nome: 'Vecchio mod',
      prezzoCentesimi: 50,
      attiva: true,
      ordineVisualizzazione: 0,
    })
    await db.bibite.add({
      nome: 'Vecchia bibita',
      prezzoCentesimi: 200,
      attiva: true,
      ordineVisualizzazione: 0,
    })

    await db.users.add({
      username: 'tester',
      usernameNorm: 'tester',
      pinHash: 'x',
      role: 'ADMIN',
      attivo: true,
    })

    const orderId = (await db.orders.add({
      numeroDisplay: 1,
      nomeCliente: null,
      createdAt: Date.now(),
      totaleCentesimi: 1000,
      createdByUserId: 1,
      receiptSnapshot: '{}',
    })) as number

    const plId = (await db.orderLinePizza.add({
      orderId,
      pizzaId: 1,
      nomeSnapshot: 'Vecchia',
      prezzoBaseSnapshot: 999,
      noteLibere: null,
      lineIndex: 0,
      inviataInCucina: false,
    })) as number

    await db.orderLinePizzaMod.add({
      pizzaLineId: plId,
      modificatoreId: 1,
      nome: 'Vecchio mod',
      tipo: 'ADD',
      prezzoCentesimi: 50,
    })

    await db.orderLineBibita.add({
      orderId,
      bibitaId: 1,
      nomeSnapshot: 'Vecchia bibita',
      prezzoUnitarioSnapshot: 200,
      quantita: 1,
      inviataInCucina: false,
    })
  })

  afterAll(async () => {
    await db.delete()
  })

  it('accetta catalogo menu schema 2 (stesso formato)', async () => {
    await importMenuCatalog(
      JSON.stringify({
        schemaVersion: 2,
        menuCatalog: true,
        pizze: [],
        modificatori: [],
        bibite: [],
      }),
    )
  })

  it('rifiuta schemaVersion errata', async () => {
    await expect(
      importMenuCatalog(JSON.stringify({ schemaVersion: 99, menuCatalog: true, pizze: [], modificatori: [], bibite: [] })),
    ).rejects.toThrow('Versione catalogo')
  })

  it('richiede menuCatalog true', async () => {
    await expect(
      importMenuCatalog(JSON.stringify({ schemaVersion: 1, pizze: [], modificatori: [], bibite: [] })),
    ).rejects.toThrow('catalogo menu')
  })

  it('azzera FK sulle righe ordine e sostituisce il menu', async () => {
    await importMenuCatalog(menuPayload())

    const pizze = await db.pizze.toArray()
    expect(pizze).toHaveLength(1)
    expect(pizze[0]?.nome).toContain('Margherita')

    const mods = await db.modificatori.toArray()
    expect(mods).toHaveLength(1)
    expect(mods[0]?.nome).toBe('Extra mozzarella')

    const bibite = await db.bibite.toArray()
    expect(bibite).toHaveLength(1)

    const lines = await db.orderLinePizza.toArray()
    expect(lines[0]?.pizzaId).toBeNull()
    expect(lines[0]?.nomeSnapshot).toBe('Vecchia')

    const mlines = await db.orderLinePizzaMod.toArray()
    expect(mlines[0]?.modificatoreId).toBeNull()

    const blines = await db.orderLineBibita.toArray()
    expect(blines[0]?.bibitaId).toBeNull()

    const users = await db.users.toArray()
    expect(users).toHaveLength(1)
  })

  it('importa public/cataloghi/glovo-pellone-napoli.json', async () => {
    const catalogPath = join(process.cwd(), 'public', 'cataloghi', 'glovo-pellone-napoli.json')
    const json = readFileSync(catalogPath, 'utf8')
    await importMenuCatalog(json)
    expect((await db.pizze.toArray()).length).toBe(32)
    expect((await db.modificatori.toArray()).length).toBeGreaterThan(40)
    expect((await db.bibite.toArray()).length).toBe(17)
  })

  it('importJson rifiuta catalogo menu (usa Importa solo menu)', async () => {
    const catalogPath = join(process.cwd(), 'public', 'cataloghi', 'glovo-pellone-napoli.json')
    const json = readFileSync(catalogPath, 'utf8')
    await expect(importJson(json)).rejects.toThrow(/Importa solo menu/)
  })

  it('exportMenuCatalogJson produce file reimportabile', async () => {
    await importMenuCatalog(menuPayload())
    const exported = await exportMenuCatalogJson()
    const root = JSON.parse(exported) as Record<string, unknown>
    expect(root.menuCatalog).toBe(true)
    expect(Array.isArray(root.pizze)).toBe(true)
    await importMenuCatalog(exported)
    expect((await db.pizze.toArray()).length).toBe(1)
  })
})
