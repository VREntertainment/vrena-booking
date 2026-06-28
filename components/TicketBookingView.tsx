'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import type { LanguageCode } from '../lib/i18n'

const ShortDateInput = dynamic(() => import('./ShortDateInput'), { ssr: false })

type TicketType = 'individual' | 'birthday' | 'corporate'

type TicketService = {
  id: TicketType
  duration: number
  minPlayers: number
  maxPlayers: number
  arenaCount: 1 | 2
  defaultGame: string
}

type TicketTimeOption = {
  value: string
  label: string
}

type TicketPricingSummary = {
  unitPrice: number
  durationBlocks: number
  chargedPlayerSpots: number
  discountRate: number
  discountAmount: number
}

type TicketBookingConfirmation = {
  sessionId: string
  reference: string
  ticketType: TicketType
  ticketLabel: string
  date: string
  time: string
  players: number
  totalPrice: number
}

export type TicketBookingViewProps = {
  text: Record<string, string>
  language: LanguageCode
  isLoggedIn: boolean
  gameGuideTrigger: ReactNode
  tariffTrigger: ReactNode
  ticketServices: TicketService[]
  ticketType: TicketType
  ticketDate: string
  ticketTime: string
  ticketPlayers: number
  ticketStatus: string
  isBookingTickets: boolean
  ticketConfirmation: TicketBookingConfirmation | null
  ticketDurationOptions: number[]
  ticketTimeOptions: TicketTimeOption[]
  ticketPlayerOptions: number[]
  ticketArenaCapacityPerSlot: number
  activeTicketDuration: number
  currentTicketPricing: TicketPricingSummary
  currentTicketUnitPrice: number
  currentTicketTotalPrice: number
  ticketDurationMessage: string
  onTicketTypeChange: (value: TicketType) => void
  onTicketDateChange: (value: string) => void
  onTicketTimeChange: (value: string) => void
  onTicketDurationChange: (value: number) => void
  onTicketPlayersChange: (value: number) => void
  onBookTickets: () => void
  onPromptLogin: () => void
  formatShortDate: (dateValue: string, language: LanguageCode) => string
  formatVnd: (value: number) => string
  ticketTypeLabel: (ticketType: TicketType, text: Record<string, string>) => string
  ticketTypeDescription: (ticketType: TicketType, text: Record<string, string>) => string
  ticketUnitFormulaText: (text: Record<string, string>, unitPrice: number, players: number) => string
}

export default function TicketBookingView({
  text,
  language,
  isLoggedIn,
  gameGuideTrigger,
  tariffTrigger,
  ticketServices,
  ticketType,
  ticketDate,
  ticketTime,
  ticketPlayers,
  ticketStatus,
  isBookingTickets,
  ticketConfirmation,
  ticketDurationOptions,
  ticketTimeOptions,
  ticketPlayerOptions,
  ticketArenaCapacityPerSlot,
  activeTicketDuration,
  currentTicketPricing,
  currentTicketUnitPrice,
  currentTicketTotalPrice,
  ticketDurationMessage,
  onTicketTypeChange,
  onTicketDateChange,
  onTicketTimeChange,
  onTicketDurationChange,
  onTicketPlayersChange,
  onBookTickets,
  onPromptLogin,
  formatShortDate,
  formatVnd,
  ticketTypeLabel,
  ticketTypeDescription,
  ticketUnitFormulaText,
}: TicketBookingViewProps) {
  return (
    <section className="section tickets-section">
      <div className="ticket-explainer" role="note">
        <strong>{text.ticketsExplainerTitle}</strong>
        <span>{text.ticketsExplainerBody}</span>
        {gameGuideTrigger}
      </div>
      {tariffTrigger}

      {!isLoggedIn ? (
        <div className="ticket-login-panel">
          <strong>{text.ticketLoginRequiredTitle}</strong>
          <p className="muted">{text.ticketLoginRequiredBody}</p>
          <button className="primary" type="button" onClick={onPromptLogin}>
            {text.loginPromptButton}
          </button>
        </div>
      ) : (
        <>
          <div className="ticket-flow-grid">
            <div className="ticket-type-list">
              <label>{text.ticketType}</label>
              <div className="ticket-service-grid">
                {ticketServices.map((service) => (
                  <button
                    className={ticketType === service.id ? 'ticket-service-card active' : 'ticket-service-card'}
                    key={service.id}
                    type="button"
                    onClick={() => onTicketTypeChange(service.id)}
                  >
                    <strong>{ticketTypeLabel(service.id, text)}</strong>
                    <span>{ticketTypeDescription(service.id, text)}</span>
                    <small>
                      20-120 min · {service.minPlayers}-{service.maxPlayers} {text.players}
                    </small>
                  </button>
                ))}
              </div>
            </div>

            <div className="ticket-form-panel">
              <div className="form-grid compact-form-grid ticket-form-grid">
                <div>
                  <label>{text.date} <span className="required">*</span></label>
                  <ShortDateInput
                    ariaLabel={text.date}
                    language={language}
                    onChange={onTicketDateChange}
                    placeholder={text.chooseDate}
                    value={ticketDate}
                  />
                </div>
                <div>
                  <label>{text.availableTime} <span className="required">*</span></label>
                  <select value={ticketTime} onChange={(event) => onTicketTimeChange(event.target.value)}>
                    <option value="">{text.chooseTime}</option>
                    {ticketTimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{text.duration}</label>
                  <select
                    disabled={ticketDurationOptions.length === 0}
                    value={ticketDurationOptions.includes(activeTicketDuration) ? activeTicketDuration : ''}
                    onChange={(event) => onTicketDurationChange(Number(event.target.value))}
                  >
                    {ticketDurationOptions.length === 0 && (
                      <option value="">{text.noAvailableDuration}</option>
                    )}
                    {ticketDurationOptions.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} min
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{text.numberOfPlayers} <span className="required">*</span></label>
                  <select value={ticketPlayers} onChange={(event) => onTicketPlayersChange(Number(event.target.value))}>
                    {ticketPlayerOptions.map((count) => (
                      <option key={count} value={count}>
                        {count} {text.players}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ticket-price-summary">
                <div>
                  <span>{text.ticketType}</span>
                  <strong>{ticketTypeLabel(ticketType, text)}</strong>
                </div>
                <div>
                  <span>{text.duration}</span>
                  <strong>{activeTicketDuration} min</strong>
                </div>
                <div>
                  <span>{text.unitPrice}</span>
                  <strong>{formatVnd(currentTicketUnitPrice)}</strong>
                  <small>{ticketUnitFormulaText(text, currentTicketUnitPrice, ticketPlayers)}</small>
                </div>
                <div>
                  <span>{text.reservedPlayerSpots}</span>
                  <strong>{currentTicketPricing.chargedPlayerSpots}</strong>
                  <small>{currentTicketPricing.durationBlocks} x {ticketArenaCapacityPerSlot} {text.players}</small>
                </div>
                {currentTicketPricing.discountRate > 0 && (
                  <div className="ticket-discount-line">
                    <span>{text.discount}</span>
                    <strong>{Math.round(currentTicketPricing.discountRate * 100)}%</strong>
                    <small>-{formatVnd(currentTicketPricing.discountAmount)}</small>
                  </div>
                )}
                <div className="ticket-total-line">
                  <span>{text.totalPrice}</span>
                  <strong>{formatVnd(currentTicketTotalPrice)}</strong>
                </div>
              </div>

              {ticketDurationMessage && <p className="field-help ticket-helper-note">{ticketDurationMessage}</p>}
              {ticketType !== 'individual' && (
                <p className="field-help ticket-helper-note">{text.ticketSpecialBookingNote}</p>
              )}
              <p className="field-help ticket-helper-note">{text.ticketDiscountDeskNote}</p>

              <button
                className={isBookingTickets ? 'primary create-button loading' : 'primary create-button'}
                disabled={isBookingTickets}
                type="button"
                onClick={onBookTickets}
              >
                {isBookingTickets ? text.bookingTickets : text.bookTickets}
              </button>
              {ticketStatus && <p className="notice">{ticketStatus}</p>}
            </div>
          </div>

          {ticketConfirmation && (
            <div className="ticket-confirmation">
              <div>
                <span>{text.bookingConfirmed}</span>
                <strong>{ticketConfirmation.ticketLabel}</strong>
              </div>
              <div className="ticket-confirmation-grid">
                <span>{formatShortDate(ticketConfirmation.date, language)}</span>
                <span>{ticketConfirmation.time}</span>
                <span>{ticketConfirmation.players} {text.players}</span>
                <span>{formatVnd(ticketConfirmation.totalPrice)}</span>
              </div>
              {ticketConfirmation.reference && (
                <p>
                  {text.bookingReference}: <strong>{ticketConfirmation.reference}</strong>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
