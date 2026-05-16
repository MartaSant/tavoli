const locale = 'it-IT'

export const MoneyFormatter = {
  format(centesimi: number): string {
    const euros = centesimi / 100
    const nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${nf.format(euros)} €`
  },

  parseToCentesimi(input: string): number | null {
    const cleaned = input.replace(/€/g, '').trim().replace(/\s/g, '')
    if (!cleaned) return null
    const normalized = cleaned.replace(',', '.')
    const value = Number(normalized)
    if (Number.isNaN(value) || value < 0) return null
    return Math.floor(value * 100)
  },
}
