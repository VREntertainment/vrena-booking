'use client'

import { type AppView } from '../../components/AppSidebar'
import { type CalendarNavigation } from '../../lib/bookingCalendar'
import {
  Profile,
  Session
} from '../../lib/bookingWidgetDomain'
import { type LanguageCode } from '../../lib/i18n/languages'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'

export const REALTIME_REFRESH_DEBOUNCE_MS = 650

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export const VRENA_WEBSITE_URL = 'https://www.vre-vietnam.com'

export const PRIVACY_POLICY_URL = `${VRENA_WEBSITE_URL}/privacy-policy`

export const TERMS_CONDITIONS_URL = `${VRENA_WEBSITE_URL}/terms-and-conditions`

export const CONSENT_WAIVER_URL = `${VRENA_WEBSITE_URL}/consent-form`

export const LEGAL_CONSENT_VERSION = '2026-07-06'

export const CLUB_BANNER_MAX_BYTES = 2 * 1024 * 1024

export const CLUB_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const AVATAR_IMAGE_MAX_BYTES = 2 * 1024 * 1024

export const AVATAR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const CLUB_MESSAGE_MAX_LENGTH = 150

export const CLUB_MESSAGE_LIMIT = 30

export const SESSION_MESSAGE_PAGE_SIZE = 30

export const TICKET_NEXT_AVAILABLE_SCAN_DAYS = 35

export type BookingWidgetProps = {
  embedded?: boolean
  externalLanguage?: LanguageCode
  initialText?: TranslationMap
  initialSelectedPlayerId?: string
  initialSelectedPlayerSessionId?: string
  initialView?: AppView
  initialCalendarNavigation?: CalendarNavigation | null
  onActiveViewChange?: (view: AppView, query?: string) => void
  onProfileChange?: (profile: Profile | null) => void
  restoreStoredView?: boolean
}

export type ActionToast = {
  id: number
  message: string
}

export const BOOKING_ACTIVE_VIEW_STORAGE_KEY = 'vrena.booking.activeView'

export const NAVIGATION_COLLAPSE_STORAGE_KEY = 'vrena.console.sidebarCollapsed.v1'

export const bookingAppViews: AppView[] = ['sessions', 'tickets', 'create', 'leaderboard', 'clubs', 'profile', 'hr', 'staff']

export function isBookingAppView(value: unknown): value is AppView {
  return typeof value === 'string' && bookingAppViews.includes(value as AppView)
}

export function bookingUpdateKind(session: Pick<Session, 'booking_type'>) {
  return session.booking_type === 'ticket' ? 'ticket' : 'session'
}

export function bookingUpdateChanges(rows: Array<[string, unknown, unknown]>) {
  return rows
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([label, before, after]) => ({ label, before: before as string | number | boolean | null, after: after as string | number | boolean | null }))
}
