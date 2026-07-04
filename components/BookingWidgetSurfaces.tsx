'use client'

import dynamic from 'next/dynamic'
import type { FirstLoginTourProps } from './FirstLoginTour'
import type { ClubVisibility, ClubsViewProps } from './ClubsView'
import type { CreateSessionViewProps } from './CreateSessionView'
import type { SessionTimeScope } from './SessionsView'
import type { TournamentControlPanelProps } from './TournamentControlPanel'

export type { ClubVisibility, SessionTimeScope }

export const RichNotesEditor = dynamic(() => import('./RichNotesEditor'), { ssr: false })
export const ShortDateInput = dynamic(() => import('./ShortDateInput'), { ssr: false })
export const FirstLoginTour = dynamic<FirstLoginTourProps>(() => import('./FirstLoginTour'), {
  ssr: false,
})
export const BookingSessionsPanel = dynamic(() => import('./BookingSessionsPanel'), {
  ssr: false,
  loading: () => (
    <section className="section sessions-section" data-tour="sessions-list">
      <p className="notice" aria-busy="true">...</p>
    </section>
  ),
})
export const TicketBookingView = dynamic(() => import('./TicketBookingView'), {
  ssr: false,
  loading: () => (
    <section className="section tickets-section">
      <p className="notice" aria-busy="true">...</p>
    </section>
  ),
})
export const GameGuideModal = dynamic(() => import('./GameGuideModal'), { ssr: false })
export const ClubsView = dynamic<ClubsViewProps>(() => import('./ClubsView'), {
  ssr: false,
  loading: () => (
    <section className="section">
      <p className="notice" aria-busy="true">...</p>
    </section>
  ),
})
export const CreateSessionView = dynamic<CreateSessionViewProps>(() => import('./CreateSessionView'), {
  ssr: false,
  loading: () => (
    <section className="section">
      <p className="notice" aria-busy="true">...</p>
    </section>
  ),
})
export const BookingProfileView = dynamic(() => import('./BookingProfileView'), {
  ssr: false,
  loading: () => (
    <section className="section profile-section">
      <p className="notice" aria-busy="true">...</p>
    </section>
  ),
})
export const StaffConsole = dynamic(() => import('./StaffConsole'), {
  ssr: false,
  loading: () => (
    <section className="section staff-console">
      <p className="notice" aria-busy="true">Loading Staff Console...</p>
    </section>
  ),
})
export const LoginPromptModal = dynamic(() => import('./SessionModals').then((module) => module.LoginPromptModal), { ssr: false })
export const InvitePopupModal = dynamic(() => import('./SessionModals').then((module) => module.InvitePopupModal), { ssr: false })
export const ChampionLoginModal = dynamic(() => import('./SessionModals').then((module) => module.ChampionLoginModal), { ssr: false })
export const BirthdayPopupModal = dynamic(() => import('./SessionModals').then((module) => module.BirthdayPopupModal), { ssr: false })
export const TariffPaymentModal = dynamic(() => import('./SessionModals').then((module) => module.TariffPaymentModal), { ssr: false })
export const CheckInModal = dynamic(() => import('./SessionModals').then((module) => module.CheckInModal), { ssr: false })
export const PlayerProfileModal = dynamic(() => import('./SessionModals').then((module) => module.PlayerProfileModal), { ssr: false })
export const TournamentControlPanel = dynamic<TournamentControlPanelProps>(() => import('./TournamentControlPanel'), {
  ssr: false,
  loading: () => (
    <div className="tournament-desk">
      <p className="notice" aria-busy="true">...</p>
    </div>
  ),
})
export const LeaderboardPanel = dynamic(() => import('./LeaderboardPanel'), {
  ssr: false,
  loading: () => (
    <section aria-busy="true" className="section leaderboard-section">
      <p className="notice">...</p>
    </section>
  ),
})
