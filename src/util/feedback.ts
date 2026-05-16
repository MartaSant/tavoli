import { ConfirmFeedback, confirmFeedbackFromStorage } from '../auth/userRole'

export async function onOrderConfirmed(mode: string): Promise<void> {
  const fb = confirmFeedbackFromStorage(mode)
  if (fb === ConfirmFeedback.OFF) return
  if (fb === ConfirmFeedback.VIBRATE || fb === ConfirmFeedback.BOTH) {
    try {
      navigator.vibrate?.(40)
    } catch {
      /* ignore */
    }
  }
  if (fb === ConfirmFeedback.SOUND || fb === ConfirmFeedback.BOTH) {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g)
      g.connect(ctx.destination)
      osc.frequency.value = 880
      g.gain.value = 0.08
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
    } catch {
      /* ignore */
    }
  }
}
