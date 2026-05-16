export const AppThemeMode = {
  LIGHT: 'LIGHT',
  DARK: 'DARK',
  SYSTEM: 'SYSTEM',
} as const

export type AppThemeModeValue = (typeof AppThemeMode)[keyof typeof AppThemeMode]

export function normalizeThemeMode(raw: string | null | undefined): string {
  if (raw === AppThemeMode.LIGHT || raw === AppThemeMode.DARK || raw === AppThemeMode.SYSTEM) return raw
  return AppThemeMode.SYSTEM
}
