'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  CONSENT_CHANGE_EVENT,
  GOOGLE_ANALYTICS_ID,
  consentStates,
  readConsentChoice,
  writeConsentChoice,
  type ConsentChoice,
} from '../lib/googleAnalytics'
import { LANGUAGE_CHANGE_EVENT, getInitialLanguage } from '../lib/i18n/detectLanguage'
import type { LanguageCode } from '../lib/i18n/languages'
import styles from './google-analytics-consent.module.css'

const INTERNAL_PATH = /^\/(staff|hr|admin)(\/|$)/
const DESKTOP_FOOTER_SETTINGS_SLOT_ID = 'vrena-booking-privacy-choices-slot'
const MOBILE_FOOTER_SETTINGS_SLOT_ID = 'vrena-booking-mobile-privacy-choices-slot'

type ConsentCopy = {
  title: string
  body: string
  essential: string
  analytics: string
  all: string
  settings: string
  privacy: string
  privacyHref: string
}

const consentCopy: Record<LanguageCode, ConsentCopy> = {
  en: {
    title: 'Help us improve VRena',
    body: 'Allow analytics and advertising cookies to improve booking and keep offers relevant. You can change this anytime.',
    essential: 'Essential only',
    analytics: 'Analytics only',
    all: 'Allow all',
    settings: 'Privacy choices',
    privacy: 'Learn more',
    privacyHref: 'https://vre-vietnam.com/en/privacy-policy',
  },
  vi: {
    title: 'Giúp VRena tốt hơn',
    body: 'Cho phép cookie phân tích và quảng cáo để cải thiện việc đặt chỗ và hiển thị ưu đãi phù hợp. Bạn có thể thay đổi bất cứ lúc nào.',
    essential: 'Chỉ cần thiết',
    analytics: 'Chỉ phân tích',
    all: 'Cho phép tất cả',
    settings: 'Tùy chọn riêng tư',
    privacy: 'Tìm hiểu thêm',
    privacyHref: 'https://vre-vietnam.com/vi/chinh-sach-bao-mat',
  },
  ko: {
    title: '더 나은 VRena를 위해',
    body: '분석 및 광고 쿠키를 허용하면 예약을 개선하고 더 알맞은 혜택을 안내하는 데 도움이 됩니다. 언제든 변경할 수 있습니다.',
    essential: '필수만',
    analytics: '분석만',
    all: '모두 허용',
    settings: '개인정보 설정',
    privacy: '자세히 보기',
    privacyHref: 'https://vre-vietnam.com/ko/privacy-policy',
  },
  ja: {
    title: 'VRenaの改善にご協力ください',
    body: '分析・広告Cookieを許可すると、予約体験の改善や、より関連性の高いご案内に役立ちます。設定はいつでも変更できます。',
    essential: '必須のみ',
    analytics: '分析のみ',
    all: 'すべて許可',
    settings: 'プライバシー設定',
    privacy: '詳しく見る',
    privacyHref: 'https://vre-vietnam.com/ja/privacy-policy',
  },
  fr: {
    title: 'Aidez-nous à améliorer VRena',
    body: 'Autorisez les cookies d’analyse et publicitaires pour améliorer la réservation et proposer des offres pertinentes. Modifiez votre choix à tout moment.',
    essential: 'Essentiels uniquement',
    analytics: 'Analyse uniquement',
    all: 'Tout autoriser',
    settings: 'Choix de confidentialité',
    privacy: 'En savoir plus',
    privacyHref: 'https://vre-vietnam.com/fr/politique-de-confidentialite',
  },
  de: {
    title: 'Helfen Sie uns, VRena zu verbessern',
    body: 'Erlauben Sie Analyse- und Werbe-Cookies, um Buchungen zu verbessern und passende Angebote zu zeigen. Sie können Ihre Auswahl jederzeit ändern.',
    essential: 'Nur erforderlich',
    analytics: 'Nur Analyse',
    all: 'Alle erlauben',
    settings: 'Datenschutzauswahl',
    privacy: 'Mehr erfahren',
    privacyHref: 'https://vre-vietnam.com/en/privacy-policy',
  },
  it: {
    title: 'Aiutaci a migliorare VRena',
    body: 'Consenti i cookie analitici e pubblicitari per migliorare la prenotazione e mostrare offerte pertinenti. Puoi cambiare scelta in qualsiasi momento.',
    essential: 'Solo essenziali',
    analytics: 'Solo analisi',
    all: 'Consenti tutti',
    settings: 'Scelte privacy',
    privacy: 'Scopri di più',
    privacyHref: 'https://vre-vietnam.com/en/privacy-policy',
  },
}

function subscribeToConsent(listener: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, listener)
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, listener)
}

function readServerConsent() {
  return 'pending' as const
}

function subscribeToLanguage(listener: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

function readServerLanguage(): LanguageCode {
  return 'en'
}

function subscribeToFooterTarget(listener: () => void) {
  let currentDesktopTarget = readDesktopFooterTarget()
  let currentMobileTarget = readMobileFooterTarget()
  const observer = new MutationObserver(() => {
    const nextDesktopTarget = readDesktopFooterTarget()
    const nextMobileTarget = readMobileFooterTarget()
    if (nextDesktopTarget === currentDesktopTarget && nextMobileTarget === currentMobileTarget) return
    currentDesktopTarget = nextDesktopTarget
    currentMobileTarget = nextMobileTarget
    listener()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

function readDesktopFooterTarget() {
  return document.getElementById(DESKTOP_FOOTER_SETTINGS_SLOT_ID)
}

function readMobileFooterTarget() {
  return document.getElementById(MOBILE_FOOTER_SETTINGS_SLOT_ID)
}

function readServerFooterTarget() {
  return null
}

function ensureGoogleAnalytics() {
  window.dataLayer = window.dataLayer ?? []
  window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }

  if (window.__vrenaGoogleAnalyticsConfigured) return

  window.__vrenaGoogleAnalyticsConfigured = true
  window.gtag('consent', 'default', {
    ad_personalization: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  })
  window.gtag('js', new Date())
  window.gtag('config', GOOGLE_ANALYTICS_ID, {
    anonymize_ip: true,
    send_page_view: false,
  })
}

function updateGoogleConsent(analyticsAllowed: boolean, marketingAllowed: boolean) {
  const analyticsConsent = analyticsAllowed ? 'granted' : 'denied'
  const advertisingConsent = marketingAllowed ? 'granted' : 'denied'

  window.gtag?.('consent', 'update', {
    analytics_storage: analyticsConsent,
    ad_storage: advertisingConsent,
    ad_user_data: advertisingConsent,
    ad_personalization: advertisingConsent,
  })
}

function trackInitialPageView(pathname: string) {
  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: pathname,
    page_title: document.title,
  })
}

export default function GoogleAnalyticsConsent() {
  const pathname = usePathname()
  const isPublicPage = !INTERNAL_PATH.test(pathname)
  const consentChoice = useSyncExternalStore(subscribeToConsent, readConsentChoice, readServerConsent)
  const language = useSyncExternalStore(subscribeToLanguage, getInitialLanguage, readServerLanguage)
  const desktopFooterTarget = useSyncExternalStore(subscribeToFooterTarget, readDesktopFooterTarget, readServerFooterTarget)
  const mobileFooterTarget = useSyncExternalStore(subscribeToFooterTarget, readMobileFooterTarget, readServerFooterTarget)
  const previousAnalyticsConsent = useRef<boolean | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const hasStoredConsent = consentChoice !== null && consentChoice !== 'pending'
  const analyticsAllowed = isPublicPage && hasStoredConsent && consentStates[consentChoice].analytics
  const marketingAllowed = isPublicPage && hasStoredConsent && consentStates[consentChoice].marketing
  const copy = consentCopy[language]

  useEffect(() => {
    if (!isPublicPage) {
      updateGoogleConsent(false, false)
      return
    }

    ensureGoogleAnalytics()
  }, [isPublicPage])

  useEffect(() => {
    if (!window.gtag) return

    updateGoogleConsent(analyticsAllowed, marketingAllowed)
    if (analyticsAllowed && previousAnalyticsConsent.current !== true) {
      trackInitialPageView(pathname)
    }
    previousAnalyticsConsent.current = analyticsAllowed
  }, [analyticsAllowed, marketingAllowed, pathname])

  function saveConsent(choice: ConsentChoice) {
    writeConsentChoice(choice)
    setIsSettingsOpen(false)
  }

  const showConsentPanel = isPublicPage && (consentChoice === null || isSettingsOpen)
  const showSettings = isPublicPage && hasStoredConsent && !isSettingsOpen
  function settingsButton(className: string) {
    return showSettings ? (
      <button className={className} onClick={() => setIsSettingsOpen(true)} type="button">
        {copy.settings}
      </button>
    ) : null
  }

  return (
    <>
      {isPublicPage ? (
        <Script
          id="vrena-booking-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
          strategy="afterInteractive"
        />
      ) : null}

      {showConsentPanel ? (
        <section aria-labelledby="booking-cookie-consent-title" className={styles.panel} role="dialog">
          <div className={styles.copy}>
            <h2 id="booking-cookie-consent-title">{copy.title}</h2>
            <p>{copy.body}</p>
            <a href={copy.privacyHref} rel="noreferrer" target="_blank">{copy.privacy}</a>
          </div>
          <div className={styles.actions}>
            <button className={styles.primaryButton} onClick={() => saveConsent('all')} type="button">{copy.all}</button>
            <button className={styles.secondaryButton} onClick={() => saveConsent('analytics')} type="button">{copy.analytics}</button>
            <button className={styles.secondaryButton} onClick={() => saveConsent('essential')} type="button">{copy.essential}</button>
          </div>
        </section>
      ) : null}

      {desktopFooterTarget ? createPortal(settingsButton(styles.footerSettingsButton), desktopFooterTarget) : null}
      {mobileFooterTarget ? createPortal(settingsButton(styles.mobileFooterSettingsButton), mobileFooterTarget) : null}
      {showSettings && !desktopFooterTarget && !mobileFooterTarget ? (
        <button className={styles.fallbackSettingsButton} onClick={() => setIsSettingsOpen(true)} type="button">{copy.settings}</button>
      ) : null}
    </>
  )
}
