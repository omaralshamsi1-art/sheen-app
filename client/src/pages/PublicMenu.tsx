import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMenuItems } from '../hooks/useFixedCosts'
import { useLanguage } from '../i18n/LanguageContext'
import { getItemImage } from '../data/itemImages'
import type { MenuItem, MenuCategory } from '../types'

const CATEGORIES: MenuCategory[] = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites', 'Beans']

export default function PublicMenu() {
  const { t, lang, setLang } = useLanguage()
  const { data: menuItems = [], isLoading } = useMenuItems()
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('Coffee')
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dx > dy && dx > 8) isSwiping.current = true
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 30) return
    const idx = CATEGORIES.indexOf(activeCategory)
    if (dx < 0 && idx < CATEGORIES.length - 1) {
      setSlideDir('left')
      setTimeout(() => { setActiveCategory(CATEGORIES[idx + 1]); setSlideDir(null) }, 150)
    } else if (dx > 0 && idx > 0) {
      setSlideDir('right')
      setTimeout(() => { setActiveCategory(CATEGORIES[idx - 1]); setSlideDir(null) }, 150)
    }
  }

  const activeItems = useMemo(
    () => menuItems.filter((item: MenuItem) => item.category === activeCategory && item.is_active),
    [menuItems, activeCategory],
  )

  return (
    <div className="min-h-screen bg-sheen-cream">
      {/* Header */}
      <header className="bg-sheen-black sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="SHEEN" className="w-10 h-10 rounded-full" />
            <div>
              <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
              <p className="text-xs text-sheen-muted font-body">{t('ourMenu')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="text-xs font-body text-gray-400 hover:text-sheen-gold transition-colors px-2 py-1 rounded"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
            <Link
              to="/login"
              className="text-xs font-body text-sheen-gold hover:text-sheen-gold/80 transition-colors border border-sheen-gold/30 rounded-lg px-3 py-1.5"
            >
              {t('signIn')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none no-scrollbar" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-body font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-sheen-brown text-sheen-white shadow-md'
                  : 'bg-sheen-white text-sheen-black border border-sheen-muted/30 hover:bg-sheen-gold/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-sheen-brown border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeItems.length === 0 ? (
          <p className="text-center py-12 text-sheen-muted font-body">{t('noItemsInCategory')}</p>
        ) : (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`grid ${activeCategory === 'Beans' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'} gap-4 transition-all duration-150 ${
              slideDir === 'left' ? 'opacity-0 -translate-x-8' :
              slideDir === 'right' ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
            }`}
          >
            {activeItems.map((item: MenuItem) => (
              <div
                key={item.id}
                className={`bg-sheen-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-lg ${activeCategory === 'Beans' ? 'group' : ''}`}
              >
                {getItemImage(item.name, (item as any).image_url) ? (
                  <div
                    className={`overflow-hidden ${activeCategory === 'Beans' ? 'h-64 cursor-pointer' : 'h-36'}`}
                    onClick={() => activeCategory === 'Beans' && setLightboxImg(getItemImage(item.name, (item as any).image_url) || null)}
                  >
                    <img
                      src={getItemImage(item.name, (item as any).image_url)}
                      alt={item.name}
                      className={`w-full h-full object-cover transition-transform duration-300 ${activeCategory === 'Beans' ? 'group-hover:scale-110' : ''}`}
                    />
                  </div>
                ) : (
                  <div className={`w-full ${activeCategory === 'Beans' ? 'h-64 bg-sheen-black' : 'h-36 bg-sheen-cream'} flex items-center justify-center text-4xl`}>
                    {activeCategory === 'Beans' ? '☕' : '☕'}
                  </div>
                )}
                <div className={activeCategory === 'Beans' ? 'p-4' : 'p-3'}>
                  <h3 className={`font-body font-medium text-sheen-black ${activeCategory === 'Beans' ? 'text-base' : 'text-sm'} truncate`}>{item.name}</h3>
                  {/* Bean details */}
                  {activeCategory === 'Beans' && item.description && (
                    <div className="mt-2 space-y-2">
                      {(() => {
                        const parts = item.description.split(' | ')
                        const roastType = parts[0] || ''
                        const tastingLine = parts.find(p => p.startsWith('Tasting Notes:'))
                        const tastingNotes = tastingLine ? tastingLine.replace('Tasting Notes: ', '').split(', ') : []
                        const details = parts.filter(p => !p.startsWith('Tasting Notes:') && p !== roastType)
                        return (
                          <>
                            <p className="font-body text-xs text-sheen-gold uppercase tracking-wider font-medium">{roastType}</p>
                            {tastingNotes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {tastingNotes.map(note => (
                                  <span key={note} className="px-2 py-0.5 rounded-full bg-sheen-cream text-sheen-brown text-[10px] font-body font-medium border border-sheen-muted/20">
                                    {note}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {details.map(d => {
                                const [label, ...val] = d.split(': ')
                                return (
                                  <div key={label}>
                                    <p className="font-body text-[9px] text-sheen-muted uppercase tracking-wider">{label}</p>
                                    <p className="font-body text-xs text-sheen-black font-medium">{val.join(': ')}</p>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className={`font-display font-semibold text-sheen-brown ${activeCategory === 'Beans' ? 'text-xl' : 'text-lg'}`}>
                      {item.selling_price} <span className="text-sm">AED</span>
                    </p>
                    <Link
                      to="/login"
                      className={`rounded-lg bg-sheen-brown text-white font-body font-medium hover:bg-sheen-brown/90 transition-colors ${activeCategory === 'Beans' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs'}`}
                    >
                      {t('orderNow')}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Image Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
        </div>
      )}

      {/* Footer */}
      <footer className="text-center py-6 border-t border-sheen-muted/20 mt-8">
        <p className="text-xs font-body text-sheen-muted">
          &copy; {new Date().getFullYear()} {t('allRightsReserved')}
        </p>
      </footer>
    </div>
  )
}
