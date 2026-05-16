export type TavoloDisplayStatus = 'idle' | 'session' | 'sent'

export function resolveTavoloDisplayStatus(
  hasSessionOrders: boolean,
  hasUnsentKitchenLines: boolean,
): TavoloDisplayStatus {
  if (!hasSessionOrders) return 'idle'
  if (hasUnsentKitchenLines) return 'session'
  return 'sent'
}
