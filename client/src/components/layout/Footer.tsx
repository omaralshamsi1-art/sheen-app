import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="border-t border-sheen-muted/20 mt-10 pt-6 pb-8 px-4">
      <div className="max-w-5xl mx-auto text-center space-y-2">
        <p className="font-display text-sm font-semibold text-sheen-black">SHEEN Speciality Coffee</p>
        <p className="font-body text-xs text-sheen-muted">
          {t('tradeLicense' as any)}: 63802 &middot; Saqr bin Mohammed City, AlDhait 03, RAK, UAE
        </p>
        <p className="font-body text-xs text-sheen-muted">
          <a href="tel:0557306030" className="hover:text-sheen-brown transition-colors">0557306030</a>
          {' '}&middot;{' '}
          <a href="mailto:info@sheencafe.ae" className="hover:text-sheen-brown transition-colors">info@sheencafe.ae</a>
        </p>
        <div className="flex justify-center gap-4 pt-1">
          <Link to="/terms" className="font-body text-xs text-sheen-muted hover:text-sheen-brown transition-colors underline underline-offset-2">
            {t('termsAndConditions' as any)}
          </Link>
          <Link to="/privacy" className="font-body text-xs text-sheen-muted hover:text-sheen-brown transition-colors underline underline-offset-2">
            {t('privacyPolicy' as any)}
          </Link>
        </div>
        <p className="text-[10px] font-body text-sheen-muted/60 pt-1">
          &copy; {new Date().getFullYear()} {t('allRightsReserved')}
        </p>
      </div>
    </footer>
  )
}
