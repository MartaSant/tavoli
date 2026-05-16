/**
 * Cataloghi possono usare `Titolo — ingredienti…` in `PizzaEntity.nome`.
 * In ricerca si mostra il nome completo; in carrello / scontrino solo il titolo.
 */
export const PIZZA_TITOLO_INGREDIENTI_SEP = ' — '

export function pizzaNomePerOrdine(nomeCompleto: string): string {
  const s = nomeCompleto.trim()
  const sep = PIZZA_TITOLO_INGREDIENTI_SEP
  const i = s.indexOf(sep)
  if (i === -1) return s
  const titolo = s.slice(0, i).trim()
  return titolo === '' ? s : titolo
}
