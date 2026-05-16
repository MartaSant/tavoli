import type { TavoloEntity } from '../db/types'

export type TavoloDisplayStatus = 'idle' | 'session' | 'sent'

export function resolveTavoloDisplayStatus(
  hasSessionOrders: boolean,
  comandaInviataAtMillis: number,
): TavoloDisplayStatus {
  if (!hasSessionOrders) return 'idle'
  if (comandaInviataAtMillis > 0) return 'sent'
  return 'session'
}

export function resolveTavoloDisplayStatusFromRow(
  t: TavoloEntity,
  hasSessionOrders: boolean,
): TavoloDisplayStatus {
  return resolveTavoloDisplayStatus(hasSessionOrders, t.comandaInviataAtMillis ?? 0)
}
