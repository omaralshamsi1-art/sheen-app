import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n/LanguageContext'
import type { TranslationKey } from '../../i18n/translations'

const navItems: { to: string; labelKey: TranslationKey; icon: string }[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: '\u{1F4CA}' },
  { to: '/sales', labelKey: 'sales', icon: '\u2615' },
  { to: '/expenses', labelKey: 'expenses', icon: '\u{1F4B8}' },
  { to: '/fixed-costs', labelKey: 'fixedCosts', icon: '\u{1F3E0}' },
  { to: '/menu', labelKey: 'menu', icon: '\u{1F4CB}' },
  { to: '/ai-monitor', labelKey: 'aiMonitor', icon: '\u{1F916}' },
  { to: '/reports', labelKey: 'reports', icon: '\u{1F4C8}' },
]

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const { t, lang, setLang } = useLanguage()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success(t('loggedOut'))
    setOpen(false)
  }

  const toggleLang = () => {
    setLang(lang === 'en' ? 'ar' : 'en')
    setOpen(false)
  }

  return (
    <>
      {/* Hamburger button — fixed in top-left, inside TopBar area */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed z-30 flex items-center justify-center"
        style={{
          top: 'env(safe-area-inset-top)',
          left: 0,
          width: '3rem',
          height: '3.25rem',
        }}
      >
        <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect y="0"  width="22" height="2" rx="1" fill="#1A1A1A"/>
          <rect y="7"  width="22" height="2" rx="1" fill="#1A1A1A"/>
          <rect y="14" width="22" height="2" rx="1" fill="#1A1A1A"/>
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
          <div>
            <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
            <p className="text-xs text-sheen-muted mt-1 font-body">{t('coffeeShopManager')}</p>
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
          {navItems.map(item => (
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
              <span className="text-lg">{item.icon}</span>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Language + Logout */}
        <div className="p-3 space-y-1 border-t border-white/10">
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-400 hover:text-sheen-gold hover:bg-sheen-gold/5 active:bg-sheen-gold/10 transition-all"
          >
            <span className="text-lg">{'\u{1F310}'}</span>
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-400 hover:text-red-400 hover:bg-red-400/5 active:bg-red-400/10 transition-all"
          >
            <span className="text-lg">{'\u{1F6AA}'}</span>
            {t('logout')}
          </button>
        </div>
      </div>
    </>
  )
}
