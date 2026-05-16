import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './auth/SessionContext'
import { OrderCartProvider } from './context/OrderCartContext'
import { purgeOldOrders } from './data/repositories'
import { MainScreen } from './screens/MainScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ReceiptPage } from './screens/ReceiptPage'
import { RecoveryScreen } from './screens/RecoveryScreen'
import { RootRedirect } from './screens/RootRedirect'
import { WizardScreen } from './screens/WizardScreen'
import { AppThemeRoot } from './theme/AppThemeRoot'

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useSession()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function MainSessionLayout() {
  return (
    <Protected>
      <OrderCartProvider>
        <Outlet />
      </OrderCartProvider>
    </Protected>
  )
}

/** Vite `BASE_URL` ends with `/`; React Router `basename` must not. */
function viteRouterBasename(): string | undefined {
  const trimmed = import.meta.env.BASE_URL.replace(/\/$/, '')
  return trimmed === '' ? undefined : trimmed
}

export default function App() {
  useEffect(() => {
    void purgeOldOrders()
  }, [])

  return (
    <SessionProvider>
      <BrowserRouter basename={viteRouterBasename()}>
        <AppThemeRoot>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/wizard" element={<WizardScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/recovery" element={<RecoveryScreen />} />
            <Route element={<MainSessionLayout />}>
              <Route path="/main" element={<MainScreen />} />
              <Route path="/main/receipt" element={<ReceiptPage />} />
            </Route>
          </Routes>
        </AppThemeRoot>
      </BrowserRouter>
    </SessionProvider>
  )
}
