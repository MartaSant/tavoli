import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AppThemeMode } from '../domain/appThemeMode'
import { db } from '../db/database'

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => setDark(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return dark
}

export function AppThemeRoot({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const appState = useLiveQuery(() => db.appState.get(1))
  const systemDark = useSystemDark()
  const isWizard = location.pathname === '/wizard'
  const mode = appState?.themeMode
  const dark = isWizard
    ? systemDark
    : mode === AppThemeMode.DARK
      ? true
      : mode === AppThemeMode.LIGHT
        ? false
        : systemDark

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return <>{children}</>
}
