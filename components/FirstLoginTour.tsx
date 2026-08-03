'use client'

import { useEffect, useRef } from 'react'
import type { Config, DriveStep, Driver, DriverHook, Side } from 'driver.js'
import { shouldStartFirstLoginTour } from '../lib/firstLoginTour'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import { supabase } from '../lib/supabase/client'
import { vrenaPalette } from '../lib/theme/vrenaPalette'
import type { AppView } from './AppSidebar'
import 'driver.js/dist/driver.css'
import './FirstLoginTour.css'

const TOUR_VERSION = 'v1'
const TOUR_STORAGE_PREFIX = 'vrena:first-login-tour'
const TOUR_STEP_COUNT = 10

export type FirstLoginTourProps = {
  enabled: boolean
  onViewChange: (view: AppView) => void
  replayNonce?: number
  text: TranslationMap
  userId: string
}

function storageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}:${TOUR_VERSION}:${userId}`
}

function resumeStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}:${TOUR_VERSION}:resume:${userId}`
}

function readResumeStep(key: string) {
  try {
    const storedStep = window.localStorage.getItem(key)
    if (storedStep === null) return null

    const step = Number(storedStep)
    return Number.isInteger(step) && step >= 0 && step < TOUR_STEP_COUNT ? step : null
  } catch {
    return null
  }
}

function saveResumeStep(key: string, step: number) {
  try {
    window.localStorage.setItem(key, String(step))
  } catch {
    // The tour can still start over if browser storage is unavailable.
  }
}

function hasCompletedTour(key: string) {
  try {
    return Boolean(window.localStorage.getItem(key))
  } catch {
    return false
  }
}

function saveTourCompletion(key: string, userId: string) {
  try {
    window.localStorage.setItem(key, new Date().toISOString())
  } catch {
    // The player can still finish or replay the tour if browser storage is unavailable.
  }

  void supabase
    .from('profiles')
    .update({ onboarding_tour_completed_at: new Date().toISOString() })
    .eq('id', userId)
}

function clearResumeStep(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // The tour can still finish normally if browser storage is unavailable.
  }
}

function stepElement(primarySelector: string, fallbackSelector = '[data-tour="app-shell"]') {
  return () => document.querySelector(primarySelector) || document.querySelector(fallbackSelector) || document.body
}

function firstAvailableStepElement(selectors: string[], fallbackSelector = '[data-tour="app-shell"]') {
  return () => {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }

    return document.querySelector(fallbackSelector) || document.body
  }
}

function popover(title: string, description: string, side: Side = 'bottom') {
  return {
    title,
    description,
    side,
    align: 'center' as const,
  }
}

export default function FirstLoginTour({ enabled, onViewChange, replayNonce = 0, text, userId }: FirstLoginTourProps) {
  const startedRef = useRef(false)
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    if (!enabled || !userId || startedRef.current || typeof window === 'undefined') return

    const key = storageKey(userId)
    const resumeKey = resumeStorageKey(userId)
    const isManualReplay = replayNonce > 0
    const resumeStep = readResumeStep(resumeKey)

    let cancelled = false
    let timer: number | undefined

    async function startTour() {
      const localCompletion = hasCompletedTour(key)
      const { data: accountProfile } = await supabase
        .from('profiles')
        .select('onboarding_tour_completed_at')
        .eq('id', userId)
        .maybeSingle()
      const accountCompletion = Boolean(accountProfile?.onboarding_tour_completed_at)
      if (localCompletion && !accountCompletion) {
        void supabase
          .from('profiles')
          .update({ onboarding_tour_completed_at: new Date().toISOString() })
          .eq('id', userId)
      }
      const completed = localCompletion || accountCompletion
      if (!shouldStartFirstLoginTour({ completed, isManualReplay, resumeStep })) return

      const { driver } = await import('driver.js')
      if (cancelled || startedRef.current) return

      startedRef.current = true

      timer = window.setTimeout(() => {
        if (cancelled) return

        const moveTourToView = (
          tour: Driver,
          view: AppView,
          resumeStep: number,
          targetSelector: string,
          move: () => void,
        ) => {
          saveResumeStep(resumeKey, resumeStep)
          onViewChange(view)

          const fallbackDeadline = Date.now() + 10_000
          const continueTour = () => {
            if (cancelled || driverRef.current !== tour || !tour.isActive()) return

            const targetIsReady = Boolean(document.querySelector(targetSelector))
            if (targetIsReady || Date.now() >= fallbackDeadline) {
              move()
              return
            }

            window.requestAnimationFrame(continueTour)
          }

          window.requestAnimationFrame(continueTour)
        }

        const moveToSessions: DriverHook = (_element, _step, { driver: tour }) => {
          moveTourToView(tour, 'sessions', 2, '[data-tour="sessions-list"]', () => tour.moveNext())
        }

        const moveBackToCreateSession: DriverHook = (_element, _step, { driver: tour }) => {
          moveTourToView(tour, 'sessions', 4, '[data-tour="create-session-button"]', () => tour.movePrevious())
        }

        const moveToLeaderboard: DriverHook = (_element, _step, { driver: tour }) => {
          moveTourToView(tour, 'leaderboard', 6, '[data-tour="leaderboard-panel"]', () => tour.moveNext())
        }

        const finishTour: DriverHook = (_element, _step, { driver: tour }) => {
          saveTourCompletion(key, userId)
          clearResumeStep(resumeKey)
          onViewChange('sessions')
          tour.destroy()
        }

        const dismissTour: DriverHook = (_element, _step, { driver: tour }) => {
          saveTourCompletion(key, userId)
          clearResumeStep(resumeKey)
          tour.destroy()
        }

        const steps: DriveStep[] = [
          {
            popover: {
              ...popover(text.onboardingWelcomeTitle, text.onboardingWelcomeBody),
              popoverClass: 'vrena-tour-popover vrena-tour-welcome',
            },
          },
          {
            element: stepElement('[data-tour="profile-card"]'),
            popover: {
              ...popover(text.onboardingProfileTitle, text.onboardingProfileBody, 'right'),
              onNextClick: moveToSessions,
            },
          },
          {
            element: stepElement('[data-tour="sessions-list"]'),
            popover: popover(text.onboardingSessionsTitle, text.onboardingSessionsBody),
          },
          {
            element: firstAvailableStepElement(['[data-tour="join-session"]', '[data-tour="sessions-list"]']),
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
            element: stepElement('[data-tour="tickets-tab"]'),
            popover: popover(text.onboardingTicketsTitle, text.onboardingTicketsBody, 'right'),
          },
          {
            element: stepElement('[data-tour="hall-of-fame-tab"]', '[data-tour="leaderboard-panel"]'),
            popover: {
              ...popover(text.onboardingHallTitle, text.onboardingHallBody, 'right'),
              onPrevClick: moveBackToCreateSession,
            },
          },
          {
            element: stepElement('[data-tour="player-profile-link"]', '[data-tour="leaderboard-panel"]'),
            popover: popover(text.onboardingPlayersTitle, text.onboardingPlayersBody, 'left'),
          },
          {
            element: stepElement('[data-tour="clubs-tab"]'),
            popover: popover(text.onboardingClubsTitle, text.onboardingClubsBody, 'right'),
          },
          {
            popover: {
              ...popover(text.onboardingFinishTitle, text.onboardingFinishBody),
              doneBtnText: text.onboardingDone,
              onDoneClick: finishTour,
              popoverClass: 'vrena-tour-popover vrena-tour-finale',
            },
          },
        ]

        const config: Config = {
          allowClose: true,
          allowKeyboardControl: true,
          allowScroll: false,
          animate: true,
          disableActiveInteraction: true,
          doneBtnText: text.onboardingDone,
          nextBtnText: text.onboardingNext,
          overlayColor: vrenaPalette.neutral[950],
          overlayOpacity: 0.72,
          onDestroyStarted: dismissTour,
          popoverClass: 'vrena-tour-popover',
          popoverOffset: 12,
          prevBtnText: text.onboardingPrevious,
          progressText: '{{current}} / {{total}}',
          showProgress: true,
          stagePadding: 8,
          stageRadius: 14,
          steps,
          onDestroyed: () => {
            startedRef.current = false
            driverRef.current = null
          },
        }

        const tour = driver(config)
        driverRef.current = tour
        tour.drive(resumeStep ?? 0)
        clearResumeStep(resumeKey)
      }, 900)
    }

    startTour()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      driverRef.current?.destroy()
      startedRef.current = false
      driverRef.current = null
    }
  }, [enabled, onViewChange, replayNonce, text, userId])

  return null
}
