import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n/LanguageContext'
import { useRole } from '../../hooks/useRole'
import { navItems } from '../../config/roles'
import { navIconMap } from '../icons/NavIcons'

export default function BottomNav() {
  const { t, lang, setLang } = useLanguage()
  const { role } = useRole()
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

  const visibleItems = navItems.filter((item) => role && item.roles.includes(role))
  const primaryNav = visibleItems.slice(0, 4)
  const moreNav = visibleItems.slice(4)

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
      {moreNav.length > 0 && (
        <div
          className={`md:hidden fixed left-0 right-0 z-50 bg-sheen-black rounded-t-2xl transition-transform duration-300 ease-in-out ${
            moreOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{
            bottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          <div className="p-3 space-y-1">
            {moreNav.map(item => {
              const IconComponent = navIconMap[item.to]
              return (
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
                  {IconComponent ? <IconComponent /> : null}
                  {t(item.labelKey)}
                </NavLink>
              )
            })}

            <div className="border-t border-white/10 mt-2 pt-2 space-y-1">
              <button
                onClick={toggleLang}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-300 hover:text-sheen-gold active:bg-sheen-gold/5 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12H22" />
                  <path d="M12 2C14.5 4.73 16 8.29 16 12C16 15.71 14.5 19.27 12 22C9.5 19.27 8 15.71 8 12C8 8.29 9.5 4.73 12 2Z" />
                </svg>
                {lang === 'en' ? 'العربية' : 'English'}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-gray-300 hover:text-red-400 active:bg-red-400/5 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5C3.89 21 3 20.11 3 19V5C3 3.89 3.89 3 5 3H9" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {t('logout')}
              </button>
            </div>
          </div>

          <div className="h-2" />
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sheen-black border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {primaryNav.map(item => {
            const IconComponent = navIconMap[item.to]
            return (
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
                    <span className="leading-none">{IconComponent ? <IconComponent /> : null}</span>
                    <span className={`leading-tight ${isActive ? 'font-medium' : ''}`}>
                      {t(item.labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}

          {moreNav.length > 0 && (
            <button
              onClick={() => setMoreOpen(prev => !prev)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-body transition-colors ${
                moreOpen ? 'text-sheen-gold' : 'text-gray-400'
              }`}
            >
              <span className="leading-none text-xl">{moreOpen ? '\u{2715}' : '\u22EF'}</span>
              <span className="leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
