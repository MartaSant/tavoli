import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { MoneyFormatter } from './money'
import { ORDER_NOTE_LINE_NOME } from './orderNoteLine'
import { OrderNumberService } from './orderNumber'

const WIDTH = 32

export interface SessionSummaryLine {
  text: string
  highlight: boolean
}

export interface SessionSummaryModel {
  lines: SessionSummaryLine[]
  plainText: string
}

export interface SessionSummaryPizzaRow {
  nome: string
  prezzoBaseCentesimi: number
  extras: { nome: string; prezzoCentesimi: number }[]
  removals: string[]
  nota: string | null | undefined
  highlight: boolean
}

export interface SessionSummaryBibitaRow {
  nome: string
  prezzoUnitarioCentesimi: number
  quantita: number
  highlight: boolean
}

export interface SessionSummaryBuildInput {
  nomeOperatore?: string | null
  nomeTavolo: string
  createdAtMillis: number
  numeroDisplay: number
  pizze: SessionSummaryPizzaRow[]
  bibite: SessionSummaryBibitaRow[]
  totaleCentesimi: number
}

function appendPriceLine(left: string, centesimi: number): string {
  const price = MoneyFormatter.format(centesimi)
  const dots = '.'.repeat(Math.max(1, WIDTH - left.length - price.length))
  return `${left} ${dots} ${price}`.slice(0, WIDTH)
}

function isNoteOnly(p: SessionSummaryPizzaRow): boolean {
  return (
    p.nome === ORDER_NOTE_LINE_NOME &&
    p.prezzoBaseCentesimi === 0 &&
    p.extras.length === 0 &&
    p.removals.length === 0
  )
}

export function buildSessionSummaryModel(input: SessionSummaryBuildInput): SessionSummaryModel {
  const lines: SessionSummaryLine[] = []
  const plainParts: string[] = []

  const push = (text: string, highlight: boolean) => {
    lines.push({ text, highlight })
    plainParts.push(text)
  }

  if (input.nomeOperatore?.trim()) {
    push(`Operatore: ${input.nomeOperatore.trim()}`.slice(0, WIDTH), false)
  }
  push(`Tavolo: ${input.nomeTavolo.trim()}`.slice(0, WIDTH), false)
  const whenStr = format(input.createdAtMillis, 'dd/MM/yyyy HH:mm', { locale: it })
  push('Riepilogo sessione tavolo'.slice(0, WIDTH), false)
  push(`${whenStr}    Ordine #${OrderNumberService.formatDisplay(input.numeroDisplay)}`.slice(0, WIDTH), false)
  push('-'.repeat(WIDTH), false)

  const noteLines = input.pizze.filter(isNoteOnly)
  const pizzaLines = input.pizze.filter((p) => !isNoteOnly(p))

  if (noteLines.length > 0) {
    push('NOTE', false)
    for (const note of noteLines) {
      push(`  ${note.nota?.trim() || note.nome}`.slice(0, WIDTH), note.highlight)
    }
  }

  if (pizzaLines.length > 0) {
    push('PIZZE', false)
    for (const pizza of pizzaLines) {
      push(appendPriceLine(`  ${pizza.nome}`, pizza.prezzoBaseCentesimi), pizza.highlight)
      for (const extra of pizza.extras) {
        push(appendPriceLine(`    + ${extra.nome}`, extra.prezzoCentesimi), pizza.highlight)
      }
      for (const removal of pizza.removals) {
        push(`    - ${removal}`.slice(0, WIDTH), pizza.highlight)
      }
      if (pizza.nota?.trim()) {
        push(`    Nota: ${pizza.nota}`.slice(0, WIDTH), pizza.highlight)
      }
    }
  }

  if (input.bibite.length > 0) {
    push('-'.repeat(WIDTH), false)
    push('BIBITE', false)
    for (const bibita of input.bibite) {
      const label =
        bibita.quantita > 1 ? `  ${bibita.nome} x${bibita.quantita}` : `  ${bibita.nome}`
      push(
        appendPriceLine(label, bibita.prezzoUnitarioCentesimi * bibita.quantita),
        bibita.highlight,
      )
    }
  }

  push('-'.repeat(WIDTH), false)
  push(appendPriceLine('TOTALE', input.totaleCentesimi), false)

  const plainText = plainParts.join('\n').replace(/\s+$/gm, '').trimEnd()
  return { lines, plainText }
}
