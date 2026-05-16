export const OrderNumberService = {
  MIN: 1,
  MAX: 99,

  formatDisplay(n: number): string {
    const v = Math.min(Math.max(n, this.MIN), this.MAX)
    return String(v).padStart(2, '0')
  },

  nextAfter(current: number): number {
    const n = Math.min(Math.max(current, this.MIN), this.MAX)
    return n >= this.MAX ? this.MIN : n + 1
  },
}
