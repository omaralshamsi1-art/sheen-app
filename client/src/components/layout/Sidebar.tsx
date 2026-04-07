import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import { useRole } from '../../hooks/useRole'
import { useAuth } from '../../hooks/useAuth'
import { navItems } from '../../config/roles'
import { navIconMap } from '../icons/NavIcons'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const { t, lang, setLang } = useLanguage()
  const { user } = useAuth()
  const { role, allowedPages } = useRole()
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success(t('loggedOut'))
  }

  const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en')

  const visibleItems = navItems.filter((item) => {
    if (!role) return false
    if (!item.roles.includes(role)) return false
    // Admin sees everything; staff filtered by allowed_pages if set
    if (role === 'admin') return true
    if (role === 'staff' && allowedPages && allowedPages.length > 0) {
      return allowedPages.includes(item.to)
    }
    return true
  })

  return (
    <aside className="hidden md:flex w-60 bg-sheen-black min-h-screen flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/images/logo.png" alt="SHEEN" className="w-10 h-10 rounded-full" />
          <div>
            <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
            <p className="text-xs text-sheen-muted font-body">{role === 'customer' ? t('coffeeShop') : t('coffeeShopManager')}</p>
          </div>
        </div>
        {(displayName || role) && (
          <div className="mt-2 flex items-center gap-2">
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

      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map(item => {
          const IconComponent = navIconMap[item.to]
          return (
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
              {IconComponent ? <IconComponent /> : <span className="text-base">{item.icon}</span>}
              {t(item.labelKey)}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-3 space-y-1 border-t border-white/10">
        <button
          onClick={toggleLang}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body
            text-gray-400 hover:text-sheen-gold hover:bg-sheen-gold/5 transition-all duration-200"
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
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body
            text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all duration-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5C3.89 21 3 20.11 3 19V5C3 3.89 3.89 3 5 3H9" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}
