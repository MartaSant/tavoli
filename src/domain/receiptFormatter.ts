import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { MoneyFormatter } from './money'
import { OrderNumberService } from './orderNumber'
import { ORDER_NOTE_LINE_NOME } from './orderNoteLine'
import type { ReceiptData, ReceiptPizzaLine } from './receiptModels'

const WIDTH = 32

export function formatReceipt(data: ReceiptData): string {
  const sb: string[] = []
  if (data.nomeOperatore?.trim()) sb.push(`Operatore: ${data.nomeOperatore.trim()}`.slice(0, WIDTH))
  if (data.nomeTavolo?.trim()) sb.push(`Tavolo: ${data.nomeTavolo.trim()}`.slice(0, WIDTH))
  if (data.nomeCliente?.trim()) sb.push(`Cliente: ${data.nomeCliente.trim()}`)
  const whenStr = format(data.createdAtMillis, 'dd/MM/yyyy HH:mm', { locale: it })
  const orderLine =
    data.orderLabelOverride?.trim() ||
    `${whenStr}    Ordine #${OrderNumberService.formatDisplay(data.numeroDisplay)}`
  sb.push(orderLine.slice(0, WIDTH))
  sb.push('-'.repeat(WIDTH))

  const noteLines = data.pizze.filter(isReceiptNoteOnlyLine)
  const pizzaLines = data.pizze.filter((p) => !isReceiptNoteOnlyLine(p))

  if (noteLines.length > 0) {
    sb.push('NOTE')
    for (const note of noteLines) {
      const text = note.nota?.trim() || note.nome
      sb.push(`  ${text}`.slice(0, WIDTH))
    }
  }

  if (pizzaLines.length > 0) {
    sb.push('PIZZE')
    for (const pizza of pizzaLines) {
      appendPriceLine(sb, `  ${pizza.nome}`, pizza.prezzoBaseCentesimi)
      for (const extra of pizza.extras) {
        appendPriceLine(sb, `    + ${extra.nome}`, extra.prezzoCentesimi)
      }
      for (const removal of pizza.removals) {
        sb.push(`    - ${removal}`.slice(0, WIDTH))
      }
      if (pizza.nota?.trim()) {
        sb.push(`    Nota: ${pizza.nota}`.slice(0, WIDTH))
      }
    }
  }

  if (data.bibite.length > 0) {
    sb.push('-'.repeat(WIDTH))
    sb.push('BIBITE')
    for (const bibita of data.bibite) {
      const label =
        bibita.quantita > 1 ? `  ${bibita.nome} x${bibita.quantita}` : `  ${bibita.nome}`
      appendPriceLine(sb, label, bibita.prezzoUnitarioCentesimi * bibita.quantita)
    }
  }

  sb.push('-'.repeat(WIDTH))
  appendPriceLine(sb, 'TOTALE', data.totaleCentesimi)
  return sb.join('\n').replace(/\s+$/gm, '').trimEnd()
}

function isReceiptNoteOnlyLine(pizza: ReceiptPizzaLine): boolean {
  return (
    pizza.nome === ORDER_NOTE_LINE_NOME &&
    pizza.prezzoBaseCentesimi === 0 &&
    pizza.extras.length === 0 &&
    pizza.removals.length === 0
  )
}

function appendPriceLine(sb: string[], left: string, centesimi: number) {
  const price = MoneyFormatter.format(centesimi)
  const dots = '.'.repeat(Math.max(1, WIDTH - left.length - price.length))
  const line = `${left} ${dots} ${price}`.slice(0, WIDTH)
  sb.push(line)
}
