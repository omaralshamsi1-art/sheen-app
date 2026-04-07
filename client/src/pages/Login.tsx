import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'

type LoginMode = 'password' | 'otp'

export default function Login() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Email + Password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message); return }
      navigate('/dashboard')
    } catch {
      setError(t('loginError'))
    } finally {
      setLoading(false)
    }
  }

  // Send OTP code to email
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email })
      if (otpError) { setError(otpError.message); return }
      setOtpSent(true)
      setSuccess(t('otpSent'))
    } catch {
      setError(t('loginError'))
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP code
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode.trim()) return
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: 'email',
      })
      if (verifyError) { setError(verifyError.message); return }
      navigate('/dashboard')
    } catch {
      setError(t('loginError'))
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth
  const handleGoogleSignIn = async () => {
    setError(null)
    setGoogleLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      })
      if (authError) { setError(authError.message); setGoogleLoading(false) }
    } catch {
      setError(t('loginError'))
      setGoogleLoading(false)
    }
  }

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )

  return (
    <div className="min-h-screen bg-sheen-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-sheen-white rounded-xl shadow-sm p-8">
          {/* Branding */}
          <div className="text-center mb-8">
            <img src="/images/logo.png" alt="SHEEN" className="w-20 h-20 mx-auto mb-3 rounded-full" />
            <h1 className="font-display text-4xl text-sheen-black tracking-wide">SHEEN</h1>
            <Link
              to="/public-menu"
              className="inline-block mt-2 font-body font-semibold text-sm transition-opacity hover:opacity-75"
              style={{ color: '#ab7f2c' }}
            >
              {t('viewMenu')}
            </Link>
          </div>

          {/* Error / Success messages */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-body">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-body">
              {success}
            </div>
          )}

          {/* Login Mode Tabs */}
          <div className="flex gap-1 mb-5 bg-sheen-cream/60 rounded-lg p-1">
            <button
              onClick={() => { setMode('password'); setOtpSent(false); setError(null); setSuccess(null) }}
              className={`flex-1 py-2 rounded-md text-sm font-body font-medium transition-colors ${
                mode === 'password' ? 'bg-white text-sheen-black shadow-sm' : 'text-sheen-muted'
              }`}
            >
              {t('password')}
            </button>
            <button
              onClick={() => { setMode('otp'); setError(null); setSuccess(null) }}
              className={`flex-1 py-2 rounded-md text-sm font-body font-medium transition-colors ${
                mode === 'otp' ? 'bg-white text-sheen-black shadow-sm' : 'text-sheen-muted'
              }`}
            >
              {t('emailOTP')}
            </button>
          </div>

          {/* Password Login Form */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-body font-medium text-sheen-black mb-1.5">
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
                <label htmlFor="password" className="block text-sm font-body font-medium text-sheen-black mb-1.5">
                  {t('password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    className="w-full rounded-lg border border-sheen-muted/30 bg-sheen-cream/40 px-4 py-2.5 pr-11 font-body text-sm text-sheen-black placeholder:text-sheen-muted/60 focus:outline-none focus:ring-2 focus:ring-sheen-gold/50 focus:border-sheen-gold transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sheen-muted hover:text-sheen-black transition-colors"
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <span className="inline-flex items-center gap-2"><Spinner />{t('signingIn')}</span> : t('signIn')}
              </Button>
            </form>
          )}

          {/* Email OTP Form */}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <label htmlFor="otp-email" className="block text-sm font-body font-medium text-sheen-black mb-1.5">
                  {t('email')}
                </label>
                <input
                  id="otp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="w-full rounded-lg border border-sheen-muted/30 bg-sheen-cream/40 px-4 py-2.5 font-body text-sm text-sheen-black placeholder:text-sheen-muted/60 focus:outline-none focus:ring-2 focus:ring-sheen-gold/50 focus:border-sheen-gold transition-colors"
                />
              </div>
              <p className="text-xs font-body text-sheen-muted">{t('otpDescription')}</p>
              <Button type="submit" disabled={loading || !email.trim()} className="w-full">
                {loading ? <span className="inline-flex items-center gap-2"><Spinner />{t('sending')}</span> : t('sendCode')}
              </Button>
            </form>
          )}

          {/* OTP Verification */}
          {mode === 'otp' && otpSent && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <p className="font-body text-sm text-sheen-black text-center">
                {t('otpSentTo')} <span className="font-semibold">{email}</span>
              </p>
              <div>
                <label htmlFor="otp-code" className="block text-sm font-body font-medium text-sheen-black mb-1.5">
                  {t('verificationCode')}
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-sheen-muted/30 bg-sheen-cream/40 px-4 py-2.5 font-body text-2xl text-center tracking-[0.5em] text-sheen-black placeholder:text-sheen-muted/30 focus:outline-none focus:ring-2 focus:ring-sheen-gold/50 focus:border-sheen-gold transition-colors"
                />
              </div>
              <Button type="submit" disabled={loading || otpCode.length < 6} className="w-full">
                {loading ? <span className="inline-flex items-center gap-2"><Spinner />{t('verifying')}</span> : t('verify')}
              </Button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpCode(''); setSuccess(null) }}
                className="w-full text-center text-sm font-body text-sheen-muted hover:text-sheen-black transition-colors"
              >
                {t('changeEmail')}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-sheen-muted/20" />
            <span className="text-xs font-body text-sheen-muted">{t('orContinueWith')}</span>
            <div className="flex-1 h-px bg-sheen-muted/20" />
          </div>

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-sheen-muted/30 bg-white font-body text-sm font-medium text-sheen-black hover:bg-sheen-cream/50 transition-colors disabled:opacity-60"
          >
            {googleLoading ? (
              <Spinner />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {t('signInWithGoogle')}
          </button>
        </div>

        <p className="text-center mt-6 text-xs font-body text-sheen-muted">
          &copy; {new Date().getFullYear()} {t('allRightsReserved')}
        </p>
      </div>
    </div>
  )
}
