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
import Users from './pages/Users'
import PublicMenu from './pages/PublicMenu'
import CustomerOrder from './pages/CustomerOrder'
import Orders from './pages/Orders'
import AuditLog from './pages/AuditLog'
import Ingredients from './pages/Ingredients'
import Stickers from './pages/Stickers'
import Settings from './pages/Settings'
import PettyCash from './pages/PettyCash'
import MyCard from './pages/MyCard'
import MyOrders from './pages/MyOrders'
import LoyaltyScan from './pages/LoyaltyScan'
import OrderNotifier from './components/OrderNotifier'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="flex h-[100dvh] max-w-[100vw] overflow-hidden bg-sheen-cream">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden -webkit-overflow-scrolling-touch">
          <Outlet />
        </main>
      </div>
      <HamburgerMenu />
      <OrderNotifier />
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
          <Route path="/" element={<PublicMenu />} />
          <Route path="/login" element={<Login />} />
          <Route path="/public-menu" element={<PublicMenu />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/fixed-costs" element={<FixedCosts />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/ai-monitor" element={<AIMonitor />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<Users />} />
            <Route path="/order" element={<CustomerOrder />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/stickers" element={<Stickers />} />
            <Route path="/petty-cash" element={<PettyCash />} />
            <Route path="/my-card" element={<MyCard />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/loyalty-scan" element={<LoyaltyScan />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/audit-log" element={<AuditLog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </LanguageProvider>
  )
}
