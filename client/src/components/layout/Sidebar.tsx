import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import { useRole } from '../../hooks/useRole'
import { navItems } from '../../config/roles'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const { t, lang, setLang } = useLanguage()
  const { role } = useRole()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success(t('loggedOut'))
  }

  const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en')

  const visibleItems = navItems.filter((item) => role && item.roles.includes(role))

  return (
    <aside className="hidden md:flex w-60 bg-sheen-black min-h-screen flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
        <p className="text-xs text-sheen-muted mt-1 font-body">{t('coffeeShopManager')}</p>
        {role && (
          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-body font-medium uppercase tracking-wider bg-sheen-gold/15 text-sheen-gold">
            {t(role as any)}
          </span>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map(item => (
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
        <button
          onClick={toggleLang}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body
            text-gray-400 hover:text-sheen-gold hover:bg-sheen-gold/5 transition-all duration-200"
        >
          <span className="text-base">{'\u{1F310}'}</span>
          {lang === 'en' ? 'العربية' : 'English'}
        </button>

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
