import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import type { TranslationKey } from '../../i18n/translations'
import toast from 'react-hot-toast'

const navItems: { to: string; labelKey: TranslationKey; icon: string }[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: '\u{1F4CA}' },
  { to: '/sales', labelKey: 'sales', icon: '\u{2615}' },
  { to: '/expenses', labelKey: 'expenses', icon: '\u{1F4B8}' },
  { to: '/fixed-costs', labelKey: 'fixedCosts', icon: '\u{1F3E0}' },
  { to: '/menu', labelKey: 'menu', icon: '\u{1F4CB}' },
  { to: '/ai-monitor', labelKey: 'aiMonitor', icon: '\u{1F916}' },
  { to: '/reports', labelKey: 'reports', icon: '\u{1F4C8}' },
]

export default function Sidebar() {
  const { t, lang, setLang } = useLanguage()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success(t('loggedOut'))
  }

  const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en')

  return (
    <aside className="w-60 bg-sheen-black min-h-screen flex flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
        <p className="text-xs text-sheen-muted mt-1 font-body">{t('coffeeShopManager')}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body transition-all duration-200
              ${isActive
                ? 'bg-sheen-gold/15 text-sheen-gold font-medium'
                : 'text-gray-400 hover:text-sheen-cream hover:bg-white/5'}`
            }
          >
            <span className="text-base">{item.icon}</span>
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 space-y-1 border-t border-white/10">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body
            text-gray-400 hover:text-sheen-gold hover:bg-sheen-gold/5 transition-all duration-200"
        >
          <span className="text-base">{'\u{1F310}'}</span>
          {lang === 'en' ? 'العربية' : 'English'}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body
            text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all duration-200"
        >
          <span className="text-base">{'\u{1F6AA}'}</span>
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}
