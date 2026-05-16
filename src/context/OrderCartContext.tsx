import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BibitaEntity, ModificatoreEntity, PizzaEntity } from '../db/types'
import {
  loadMergedSessionIntoCart as mergeTableSessionIntoCart,
  loadOrderIntoCart,
  previewOrderSnapshot,
  saveOrder,
  searchBibiteActive,
  modsActive,
  searchModsActive,
  searchPizzeActive,
  getAppState,
} from '../data/repositories'
import type { CartBibitaLine, CartPizzaLine, OrderCartLoad } from '../data/cartTypes'
import { lineTotalBibita, lineTotalPizza, newLocalId } from '../data/cartTypes'
import { cartHasOrderContent, createNoteOnlyCartLine } from '../domain/orderNoteLine'
import { pizzaNomePerOrdine } from '../domain/pizzaNome'
import { useSession } from '../auth/SessionContext'
import { onOrderConfirmed } from '../util/feedback'

interface OrderCartContextValue {
  selectedTableId: number | null
  selectedTableNome: string | null
  setSelectedTable: (id: number | null, nome: string | null) => void
  /** Svuota righe e ricerche; imposta solo il tavolo (nuovo ordine sul tavolo). */
  prepareNewOrderForTable: (id: number, nome: string | null) => void
  pizzaLines: CartPizzaLine[]
  bibitaLines: CartBibitaLine[]
  pizzaSearch: string
  setPizzaSearch: (s: string) => void
  bibitaSearch: string
  setBibitaSearch: (s: string) => void
  modSearch: string
  setModSearch: (s: string) => void
  pizzaResults: PizzaEntity[]
  bibitaResults: BibitaEntity[]
  modResults: ModificatoreEntity[]
  allMods: ModificatoreEntity[]
  refreshMods: () => Promise<void>
  searchPizze: (q: string) => Promise<void>
  searchBibite: (q: string) => Promise<void>
  searchMods: (q: string) => Promise<void>
  clearModSearch: () => void
  addPizza: (p: PizzaEntity) => void
  addNoteLine: (text: string) => boolean
  addBibita: (b: BibitaEntity) => void
  removePizza: (localId: number) => void
  duplicatePizza: (localId: number) => void
  updatePizzaNote: (localId: number, nota: string) => void
  addMod: (localId: number, mod: ModificatoreEntity, tipo: string) => void
  removeMod: (localId: number, modIndex: number) => void
  adjustBibita: (localId: number, delta: number) => void
  removeBibita: (localId: number) => void
  resetCart: () => void
  applyCartLoad: (load: OrderCartLoad) => void
  totalCentesimi: number
  message: string | null
  setMessage: (m: string | null) => void
  previewOrder: () => Promise<string | null>
  confirmOrder: (onSaved?: (snap: string) => void | Promise<void>) => Promise<void>
  loadCartFromOrder: (orderId: number) => Promise<void>
  loadMergedSessionIntoCart: (tableId: number) => Promise<void>
  isCartNonEmpty: () => boolean
}

const OrderCartContext = createContext<OrderCartContextValue | null>(null)

export function OrderCartProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [selectedTableNome, setSelectedTableNome] = useState<string | null>(null)
  const [pizzaLines, setPizzaLines] = useState<CartPizzaLine[]>([])
  const [bibitaLines, setBibitaLines] = useState<CartBibitaLine[]>([])
  const [pizzaSearch, setPizzaSearch] = useState('')
  const [bibitaSearch, setBibitaSearch] = useState('')
  const [modSearch, setModSearch] = useState('')
  const [pizzaResults, setPizzaResults] = useState<PizzaEntity[]>([])
  const [bibitaResults, setBibitaResults] = useState<BibitaEntity[]>([])
  const [modResults, setModResults] = useState<ModificatoreEntity[]>([])
  const [allMods, setAllMods] = useState<ModificatoreEntity[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const sessionOrderIdsToReplaceOnSaveRef = useRef<number[] | null>(null)

  const refreshMods = useCallback(async () => {
    setAllMods(await modsActive())
  }, [])

  const searchPizze = useCallback(async (q: string) => {
    setPizzaSearch(q)
    setPizzaResults(q.trim() ? await searchPizzeActive(q) : [])
  }, [])

  const searchBibite = useCallback(async (q: string) => {
    setBibitaSearch(q)
    setBibitaResults(q.trim() ? await searchBibiteActive(q) : [])
  }, [])

  const searchMods = useCallback(async (q: string) => {
    setModSearch(q)
    setModResults(q.trim() ? await searchModsActive(q) : [])
  }, [])

  const clearModSearch = useCallback(() => {
    setModSearch('')
    setModResults([])
  }, [])

  const clearCartLinesAndSearchOnly = useCallback(() => {
    setPizzaLines([])
    setBibitaLines([])
    setPizzaSearch('')
    setBibitaSearch('')
    setPizzaResults([])
    setBibitaResults([])
    clearModSearch()
    setMessage(null)
  }, [clearModSearch])

  const addPizza = useCallback((pizza: PizzaEntity) => {
    setPizzaLines((lines) => [
      ...lines,
      {
        localId: newLocalId(),
        pizzaId: pizza.id ?? null,
        nome: pizzaNomePerOrdine(pizza.nome),
        prezzoBaseCentesimi: pizza.prezzoCentesimi,
        mods: [],
        nota: null,
      },
    ])
    setPizzaSearch('')
    setPizzaResults([])
  }, [])

  const addNoteLine = useCallback((text: string): boolean => {
    const trimmed = text.trim()
    if (!trimmed) {
      setMessage('Scrivi una nota')
      return false
    }
    setPizzaLines((lines) => [...lines, createNoteOnlyCartLine(trimmed, newLocalId())])
    setMessage(null)
    return true
  }, [])

  const addBibita = useCallback((bibita: BibitaEntity) => {
    setBibitaLines((lines) => {
      const existing = lines.findIndex((l) => l.bibitaId === bibita.id)
      if (existing >= 0) {
        return lines.map((l, i) =>
          i === existing ? { ...l, quantita: l.quantita + 1 } : l,
        )
      }
      return [
        ...lines,
        {
          localId: newLocalId(),
          bibitaId: bibita.id ?? null,
          nome: bibita.nome,
          prezzoUnitarioCentesimi: bibita.prezzoCentesimi,
          quantita: 1,
        },
      ]
    })
    setBibitaSearch('')
    setBibitaResults([])
  }, [])

  const removePizza = useCallback((localId: number) => {
    setPizzaLines((lines) => lines.filter((l) => l.localId !== localId))
  }, [])

  const duplicatePizza = useCallback((localId: number) => {
    setPizzaLines((lines) => {
      const line = lines.find((l) => l.localId === localId)
      if (!line) return lines
      return [
        ...lines,
        {
          ...line,
          localId: newLocalId(),
          mods: line.mods.map((m) => ({ ...m })),
        },
      ]
    })
  }, [])

  const updatePizzaNote = useCallback((localId: number, nota: string) => {
    setPizzaLines((lines) =>
      lines.map((l) => (l.localId === localId ? { ...l, nota } : l)),
    )
  }, [])

  const addMod = useCallback(
    (localId: number, mod: ModificatoreEntity, tipo: string) => {
      setPizzaLines((lines) =>
        lines.map((line) => {
          if (line.localId !== localId) return line
          return {
            ...line,
            mods: [
              ...line.mods,
              {
                modificatoreId: mod.id ?? null,
                nome: mod.nome,
                tipo,
                prezzoCentesimi: mod.prezzoCentesimi,
              },
            ],
          }
        }),
      )
      clearModSearch()
    },
    [clearModSearch],
  )

  const removeMod = useCallback((localId: number, modIndex: number) => {
    setPizzaLines((lines) =>
      lines.map((line) => {
        if (line.localId !== localId) return line
        return { ...line, mods: line.mods.filter((_, i) => i !== modIndex) }
      }),
    )
  }, [])

  const adjustBibita = useCallback((localId: number, delta: number) => {
    setBibitaLines((lines) =>
      lines
        .map((line) => {
          if (line.localId !== localId) return line
          const q = line.quantita + delta
          if (q <= 0) return null
          return { ...line, quantita: q }
        })
        .filter((x): x is CartBibitaLine => x != null),
    )
  }, [])

  const removeBibita = useCallback((localId: number) => {
    setBibitaLines((lines) => lines.filter((l) => l.localId !== localId))
  }, [])

  const resetCart = useCallback(() => {
    sessionOrderIdsToReplaceOnSaveRef.current = null
    setSelectedTableId(null)
    setSelectedTableNome(null)
    setPizzaLines([])
    setBibitaLines([])
  }, [])

  const setSelectedTable = useCallback((id: number | null, nome: string | null) => {
    sessionOrderIdsToReplaceOnSaveRef.current = null
    setSelectedTableId(id)
    setSelectedTableNome(nome?.trim() ? nome.trim() : null)
  }, [])

  const prepareNewOrderForTable = useCallback(
    (id: number, nome: string | null) => {
      clearCartLinesAndSearchOnly()
      sessionOrderIdsToReplaceOnSaveRef.current = null
      setSelectedTable(id, nome)
    },
    [clearCartLinesAndSearchOnly, setSelectedTable],
  )

  const applyCartLoad = useCallback(
    (load: OrderCartLoad) => {
      sessionOrderIdsToReplaceOnSaveRef.current = load.sessionOrderIdsToReplaceOnSave ?? null
      setSelectedTableId(load.tableId ?? null)
      setSelectedTableNome(load.nomeTavoloSnapshot?.trim() ? load.nomeTavoloSnapshot.trim() : null)
      setPizzaLines(load.pizze)
      setBibitaLines(load.bibite)
      setPizzaSearch('')
      setBibitaSearch('')
      setPizzaResults([])
      setBibitaResults([])
      clearModSearch()
      setMessage(null)
    },
    [clearModSearch],
  )

  const totalCentesimi = useMemo(
    () =>
      pizzaLines.reduce((s, p) => s + lineTotalPizza(p), 0) +
      bibitaLines.reduce((s, b) => s + lineTotalBibita(b), 0),
    [pizzaLines, bibitaLines],
  )

  const previewOrder = useCallback(async (): Promise<string | null> => {
    try {
      if (!cartHasOrderContent(pizzaLines, bibitaLines)) {
        setMessage("Aggiungi almeno una voce o una nota all'ordine")
        return null
      }
      if (selectedTableId == null) {
        setMessage('Seleziona un tavolo')
        return null
      }
      const state = await getAppState()
      if (!state) throw new Error('Stato app mancante')
      const snap = previewOrderSnapshot(
        null,
        selectedTableNome ?? '',
        state.nextOrderNumber,
        pizzaLines,
        bibitaLines,
        user?.username,
      )
      setMessage(null)
      return snap
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Errore')
      return null
    }
  }, [selectedTableId, selectedTableNome, pizzaLines, bibitaLines, user?.username])

  const confirmOrder = useCallback(
    async (onSaved?: (snap: string) => void | Promise<void>) => {
      try {
        if (!user?.id) throw new Error('Non autenticato')
        if (selectedTableId == null) throw new Error('Seleziona un tavolo')
        const nomeT = selectedTableNome?.trim()
        if (!nomeT) throw new Error('Tavolo non valido')
        const state = await getAppState()
        if (!state) throw new Error('Stato app mancante')
        const order = await saveOrder(
          selectedTableId,
          nomeT,
          user.id,
          pizzaLines,
          bibitaLines,
          user.username,
          sessionOrderIdsToReplaceOnSaveRef.current?.length
            ? sessionOrderIdsToReplaceOnSaveRef.current
            : undefined,
        )
        await onOrderConfirmed(state.confirmFeedback)
        resetCart()
        await Promise.resolve(onSaved?.(order.receiptSnapshot))
        setMessage(null)
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Errore')
      }
    },
    [user, selectedTableId, selectedTableNome, pizzaLines, bibitaLines, resetCart],
  )

  const loadCartFromOrder = useCallback(
    async (orderId: number) => {
      try {
        const load = await loadOrderIntoCart(orderId)
        applyCartLoad(load)
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Errore')
      }
    },
    [applyCartLoad],
  )

  const loadMergedSessionIntoCartFn = useCallback(
    async (tableId: number) => {
      try {
        clearCartLinesAndSearchOnly()
        const load = await mergeTableSessionIntoCart(tableId)
        applyCartLoad(load)
      } catch (e) {
        sessionOrderIdsToReplaceOnSaveRef.current = null
        setSelectedTableId(null)
        setSelectedTableNome(null)
        setMessage(e instanceof Error ? e.message : 'Errore')
      }
    },
    [applyCartLoad, clearCartLinesAndSearchOnly],
  )

  const isCartNonEmpty = useCallback(
    () => cartHasOrderContent(pizzaLines, bibitaLines),
    [pizzaLines, bibitaLines],
  )

  const value = useMemo(
    () => ({
      selectedTableId,
      selectedTableNome,
      setSelectedTable,
      prepareNewOrderForTable,
      pizzaLines,
      bibitaLines,
      pizzaSearch,
      setPizzaSearch,
      bibitaSearch,
      setBibitaSearch,
      modSearch,
      setModSearch,
      pizzaResults,
      bibitaResults,
      modResults,
      allMods,
      refreshMods,
      searchPizze,
      searchBibite,
      searchMods,
      clearModSearch,
      addPizza,
      addNoteLine,
      addBibita,
      removePizza,
      duplicatePizza,
      updatePizzaNote,
      addMod,
      removeMod,
      adjustBibita,
      removeBibita,
      resetCart,
      applyCartLoad,
      totalCentesimi,
      message,
      setMessage,
      previewOrder,
      confirmOrder,
      loadCartFromOrder,
      loadMergedSessionIntoCart: loadMergedSessionIntoCartFn,
      isCartNonEmpty,
    }),
    [
      selectedTableId,
      selectedTableNome,
      setSelectedTable,
      prepareNewOrderForTable,
      pizzaLines,
      bibitaLines,
      pizzaSearch,
      bibitaSearch,
      modSearch,
      pizzaResults,
      bibitaResults,
      modResults,
      allMods,
      refreshMods,
      searchPizze,
      searchBibite,
      searchMods,
      clearModSearch,
      addPizza,
      addNoteLine,
      addBibita,
      removePizza,
      duplicatePizza,
      updatePizzaNote,
      addMod,
      removeMod,
      adjustBibita,
      removeBibita,
      resetCart,
      applyCartLoad,
      totalCentesimi,
      message,
      previewOrder,
      confirmOrder,
      loadCartFromOrder,
      loadMergedSessionIntoCartFn,
      isCartNonEmpty,
    ],
  )

  return <OrderCartContext.Provider value={value}>{children}</OrderCartContext.Provider>
}

export function useOrderCart(): OrderCartContextValue {
  const ctx = useContext(OrderCartContext)
  if (!ctx) throw new Error('useOrderCart fuori OrderCartProvider')
  return ctx
}
