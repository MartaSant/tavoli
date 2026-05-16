export const UserRole = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
} as const

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole]

export function userRoleFromStorage(value: string): UserRoleValue {
  return value === UserRole.ADMIN ? UserRole.ADMIN : UserRole.STAFF
}

export const ConfirmFeedback = {
  VIBRATE: 'VIBRATE',
  SOUND: 'SOUND',
  BOTH: 'BOTH',
  OFF: 'OFF',
} as const

export type ConfirmFeedbackValue = (typeof ConfirmFeedback)[keyof typeof ConfirmFeedback]

export function confirmFeedbackFromStorage(value: string): ConfirmFeedbackValue {
  const v = Object.values(ConfirmFeedback).find((x) => x === value)
  return v ?? ConfirmFeedback.VIBRATE
}
