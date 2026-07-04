'use client'

import { useEffect, useRef } from 'react'
import type { Config, DriveStep, Driver, DriverHook, Side } from 'driver.js'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import type { AppView } from './AppSidebar'

const TOUR_VERSION = 'v1'
const TOUR_STORAGE_PREFIX = 'vrena:first-login-tour'

type FirstLoginTourProps = {
  enabled: boolean
  onViewChange: (view: AppView) => void
  text: TranslationMap
  userId: string
}

function storageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}:${TOUR_VERSION}:${userId}`
}

function hasElement(selector: string) {
  return typeof document !== 'undefined' && Boolean(document.querySelector(selector))
}

function stepElement(primarySelector: string, fallbackSelector = '[data-tour="app-shell"]') {
  return () => document.querySelector(primarySelector) || document.querySelector(fallbackSelector) || document.body
}

function popover(title: string, description: string, side: Side = 'bottom') {
  return {
    title,
    description,
    side,
    align: 'center' as const,
  }
}

function waitForPaint(callback: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback)
  })
}

export default function FirstLoginTour({ enabled, onViewChange, text, userId }: FirstLoginTourProps) {
  const startedRef = useRef(false)
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    if (!enabled || !userId || startedRef.current || typeof window === 'undefined') return

    const key = storageKey(userId)
    if (window.localStorage.getItem(key)) return

    let cancelled = false
    let timer: number | undefined

    async function startTour() {
      const { driver } = await import('driver.js')
      if (cancelled || startedRef.current || window.localStorage.getItem(key)) return

      startedRef.current = true
      onViewChange('sessions')

      timer = window.setTimeout(() => {
        if (cancelled) return

        const moveToLeaderboard: DriverHook = (_element, _step, { driver: tour }) => {
          onViewChange('leaderboard')
          waitForPaint(() => {
            tour.moveNext()
            window.setTimeout(() => tour.refresh(), 120)
          })
        }

        const finishTour: DriverHook = (_element, _step, { driver: tour }) => {
          window.localStorage.setItem(key, new Date().toISOString())
          tour.destroy()
        }

        const joinTarget = hasElement('[data-tour="join-session"]')
          ? '[data-tour="join-session"]'
          : '[data-tour="sessions-list"]'
        const steps: DriveStep[] = [
          {
            element: stepElement('[data-tour="app-shell"]'),
            popover: popover(text.onboardingWelcomeTitle, text.onboardingWelcomeBody),
          },
          {
            element: stepElement('[data-tour="profile-card"]'),
            popover: popover(text.onboardingProfileTitle, text.onboardingProfileBody, 'right'),
          },
          {
            element: stepElement('[data-tour="sessions-list"]'),
            popover: popover(text.onboardingSessionsTitle, text.onboardingSessionsBody),
          },
          {
            element: stepElement(joinTarget),
            popover: popover(text.onboardingJoinTitle, text.onboardingJoinBody, 'left'),
          },
          {
            element: stepElement('[data-tour="create-session-button"]'),
            popover: {
              ...popover(text.onboardingCreateTitle, text.onboardingCreateBody, 'top'),
              onNextClick: moveToLeaderboard,
            },
          },
          {
            element: stepElement('[data-tour="hall-of-fame-tab"]', '[data-tour="leaderboard-panel"]'),
            popover: popover(text.onboardingHallTitle, text.onboardingHallBody, 'right'),
          },
          {
            element: stepElement('[data-tour="player-profile-link"]', '[data-tour="leaderboard-panel"]'),
            popover: popover(text.onboardingPlayersTitle, text.onboardingPlayersBody, 'left'),
          },
          {
            element: stepElement('[data-tour="app-shell"]'),
            popover: {
              ...popover(text.onboardingFinishTitle, text.onboardingFinishBody),
              onDoneClick: finishTour,
            },
          },
        ]

        const config: Config = {
          allowClose: true,
          allowKeyboardControl: true,
          allowScroll: false,
          animate: true,
          disableActiveInteraction: false,
          doneBtnText: text.onboardingDone,
          nextBtnText: text.onboardingNext,
          overlayColor: '#020617',
          overlayOpacity: 0.72,
          popoverClass: 'vrena-tour-popover',
          popoverOffset: 12,
          prevBtnText: text.onboardingPrevious,
          progressText: '{{current}} / {{total}}',
          showProgress: true,
          stagePadding: 8,
          stageRadius: 14,
          steps,
          onDestroyed: () => {
            window.localStorage.setItem(key, new Date().toISOString())
            driverRef.current = null
          },
        }

        const tour = driver(config)
        driverRef.current = tour
        tour.drive()
      }, 900)
    }

    startTour()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [enabled, onViewChange, text, userId])

  return null
}
