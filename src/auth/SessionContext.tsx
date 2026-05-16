import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { UserEntity } from '../db/types'

interface SessionContextValue {
  user: UserEntity | null
  login: (user: UserEntity) => void
  logout: () => void
  isAdmin: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserEntity | null>(null)

  const login = useCallback((u: UserEntity) => setUser(u), [])
  const logout = useCallback(() => setUser(null), [])

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, login, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession fuori SessionProvider')
  return ctx
}
