import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n/LanguageContext'
import type { TranslationKey } from '../../i18n/translations'

const primaryNav: { to: string; labelKey: TranslationKey; icon: string }[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: '\u{1F4CA}' },
  { to: '/sales', labelKey: 'sales', icon: '\u2615' },
  { to: '/expenses', labelKey: 'expenses', icon: '\u{1F4B8}' },
  { to: '/reports', labelKey: 'reports', icon: '\u{1F4C8}' },
]

const moreNav: { to: string; labelKey: TranslationKey; icon: string }[] = [
  { to: '/menu', labelKey: 'menu', icon: '\u{1F4CB}' },
  { to: '/fixed-costs', labelKey: 'fixedCosts', icon: '\u{1F3E0}' },
  { to: '/ai-monitor', labelKey: 'aiMonitor', icon: '\u{1F916}' },
]

export default function BottomNav() {
  const { t, lang, setLang } = useLanguage()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success(t('loggedOut'))
    setMoreOpen(false)
  }

  const toggleLang = () => {
    setLang(lang === 'en' ? 'ar' : 'en')
    setMoreOpen(false)
  }

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      <div
        className={`md:hidden fixed left-0 right-0 z-50 bg-sheen-black rounded-t-2xl transition-transform duration-300 ease-in-out ${
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
        }}
      >
        {/* Pull handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="p-3 space-y-1">
          {moreNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body transition-colors ${
                  isActive
                    ? 'bg-sheen-gold/15 text-sheen-gold font-medium'
                    : 'text-gray-300 active:bg-white/10'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              {t(item.labelKey)}
            </NavLink>
          ))}

          <div className="border-t border-white/10 mt-2 pt-2 space-y-1">
            <button
              onClick={toggleLang}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-300 hover:text-sheen-gold active:bg-sheen-gold/5 transition-colors"
            >
              <span className="text-xl">{'\u{1F310}'}</span>
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-300 hover:text-red-400 active:bg-red-400/5 transition-colors"
            >
              <span className="text-xl">{'\u{1F6AA}'}</span>
              {t('logout')}
            </button>
          </div>
        </div>

        {/* Bottom safe area fill */}
        <div className="h-2" />
      </div>

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sheen-black border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {primaryNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-body transition-colors ${
                  isActive ? 'text-sheen-gold' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className={`leading-tight ${isActive ? 'font-medium' : ''}`}>
                    {t(item.labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-body transition-colors ${
              moreOpen ? 'text-sheen-gold' : 'text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{moreOpen ? '\u{2715}' : '\u22EF'}</span>
            <span className="leading-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
