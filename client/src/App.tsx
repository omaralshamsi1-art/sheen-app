import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LanguageProvider } from './i18n/LanguageContext'

import Sidebar from './components/layout/Sidebar'
import HamburgerMenu from './components/layout/HamburgerMenu'
import ToastProvider from './components/ui/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'
import Expenses from './pages/Expenses'
import FixedCosts from './pages/FixedCosts'
import Menu from './pages/Menu'
import AIMonitor from './pages/AIMonitor'
import Reports from './pages/Reports'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-sheen-cream">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <HamburgerMenu />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/fixed-costs" element={<FixedCosts />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/ai-monitor" element={<AIMonitor />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </LanguageProvider>
  )
}
