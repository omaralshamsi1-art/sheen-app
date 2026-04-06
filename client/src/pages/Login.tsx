import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'

export default function Login() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      navigate('/dashboard')
    } catch (err) {
      setError(t('loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sheen-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-sheen-white rounded-xl shadow-sm p-8">
          {/* Branding */}
          <div className="text-center mb-8">
            <img src="/images/logo.png" alt="SHEEN" className="w-20 h-20 mx-auto mb-3 rounded-full" />
            <h1 className="font-display text-4xl text-sheen-black tracking-wide">
              SHEEN
            </h1>
            <p className="font-body text-sheen-muted mt-1 text-sm">
              {t('coffeeShopManager')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-body">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-body font-medium text-sheen-black mb-1.5"
              >
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full rounded-lg border border-sheen-muted/30 bg-sheen-cream/40 px-4 py-2.5 font-body text-sm text-sheen-black placeholder:text-sheen-muted/60 focus:outline-none focus:ring-2 focus:ring-sheen-gold/50 focus:border-sheen-gold transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-body font-medium text-sheen-black mb-1.5"
              >
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className="w-full rounded-lg border border-sheen-muted/30 bg-sheen-cream/40 px-4 py-2.5 font-body text-sm text-sheen-black placeholder:text-sheen-muted/60 focus:outline-none focus:ring-2 focus:ring-sheen-gold/50 focus:border-sheen-gold transition-colors"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-sheen-gold hover:bg-sheen-gold/90 text-sheen-black font-body font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {t('signingIn')}
                </span>
              ) : (
                t('signIn')
              )}
            </Button>
          </form>

          {/* View Menu link */}
          <div className="mt-6 text-center">
            <Link
              to="/public-menu"
              className="inline-flex items-center gap-2 font-body text-sm text-sheen-brown hover:text-sheen-gold transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4H20V16C20 18.21 18.21 20 16 20H8C5.79 20 4 18.21 4 16V4Z" />
                <path d="M4 4C4 4 4.5 9 12 9C19.5 9 20 4 20 4" />
                <path d="M12 9V20" />
              </svg>
              {t('viewMenu')}
            </Link>
          </div>
        </div>

        <p className="text-center mt-6 text-xs font-body text-sheen-muted">
          &copy; {new Date().getFullYear()} {t('allRightsReserved')}
        </p>
      </div>
    </div>
  )
}
