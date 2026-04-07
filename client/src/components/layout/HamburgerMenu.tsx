import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n/LanguageContext'
import { useRole } from '../../hooks/useRole'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { getOrders } from '../../services/orderService'
import { navItems } from '../../config/roles'
import { navIconMap } from '../icons/NavIcons'

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const { t, lang, setLang } = useLanguage()
  const { user } = useAuth()
  const { role, allowedPages } = useRole()
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  const isStaffOrAdmin = role === 'admin' || role === 'staff'
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['orders', 'pending-sidebar'],
    queryFn: () => getOrders({ status: 'pending' }),
    refetchInterval: 10000,
    enabled: isStaffOrAdmin,
  })
  const pendingCount = pendingOrders.length

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success(t('loggedOut'))
    setOpen(false)
  }

  const toggleLang = () => {
    setLang(lang === 'en' ? 'ar' : 'en')
    setOpen(false)
  }

  const visibleItems = navItems.filter((item) => {
    if (!role) return false
    if (!item.roles.includes(role)) return false
    if (role === 'admin') return true
    if (role === 'staff' && allowedPages && allowedPages.length > 0) {
      return allowedPages.includes(item.to)
    }
    return true
  })

  return (
    <>
      {/* Hamburger button — fixed in top-left, aligned with TopBar */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed top-0 left-0 z-30 w-12 h-12 flex items-center justify-center"
      >
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
          <rect y="0"  width="20" height="2" rx="1" fill="#1A1A1A"/>
          <rect y="6"  width="20" height="2" rx="1" fill="#1A1A1A"/>
          <rect y="12" width="20" height="2" rx="1" fill="#1A1A1A"/>
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-sheen-black flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="SHEEN" className="w-10 h-10 rounded-full" />
            <div>
              <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
              <p className="text-xs text-sheen-muted font-body">{role === 'customer' ? t('coffeeShop') : t('coffeeShopManager')}</p>
              {(displayName || role) && (
                <div className="mt-1 flex items-center gap-2">
                  {displayName && (
                    <span className="text-xs text-sheen-cream font-body truncate max-w-[120px]">{displayName}</span>
                  )}
                  {role && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-body font-medium uppercase tracking-wider bg-sheen-gold/15 text-sheen-gold shrink-0">
                      {t(role as any)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(item => {
            const IconComponent = navIconMap[item.to]
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body transition-all ${
                    isActive
                      ? 'bg-sheen-gold/15 text-sheen-gold font-medium'
                      : 'text-gray-400 hover:text-sheen-cream hover:bg-white/5 active:bg-white/10'
                  }`
                }
              >
                {IconComponent ? <IconComponent /> : <span className="text-lg">{item.icon}</span>}
                <span className="flex-1">{t(item.labelKey)}</span>
                {item.to === '/orders' && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Language + Logout */}
        <div className="p-3 space-y-1 border-t border-white/10">
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-400 hover:text-sheen-gold hover:bg-sheen-gold/5 active:bg-sheen-gold/10 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12H22" />
              <path d="M12 2C14.5 4.73 16 8.29 16 12C16 15.71 14.5 19.27 12 22C9.5 19.27 8 15.71 8 12C8 8.29 9.5 4.73 12 2Z" />
            </svg>
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-400 hover:text-red-400 hover:bg-red-400/5 active:bg-red-400/10 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5C3.89 21 3 20.11 3 19V5C3 3.89 3.89 3 5 3H9" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t('logout')}
          </button>
        </div>
      </div>
    </>
  )
}
