'use client'

import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import type { GuestTicketContact } from '../lib/guestTicketBooking'
import { bookingDurationCopy } from '../lib/bookingDurationCopy'
import type { LanguageCode } from '../lib/i18n/languages'
import ContactChannels, { VRENA_ZALO_URL } from './ContactChannels'
import GuestTicketContactPanel from './GuestTicketContactPanel'

const ShortDateInput = dynamic(() => import('./ShortDateInput'), { ssr: false })

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatTicketDateDisplay(dateValue: string, language: LanguageCode, includeWeekday = false) {
  if (!dateValue) return ''

  return new Date(`${dateValue}T12:00:00`).toLocaleDateString(language, {
    day: 'numeric',
    month: 'short',
    ...(includeWeekday ? { weekday: 'short' as const } : {}),
  })
}

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
  chargedPlayersPerBlock: number
  chargedPlayerSpots: number
  discountRate: number
  discountAmount: number
  grossPrice: number
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
  guestPhone?: string
  guestName?: string
  loyaltyPointsRedeemed?: number
  loyaltyDiscountAmount?: number
  discountCode?: string
  discountAmount?: number
  requiresZaloConfirmation?: boolean
}

type GuestTicketAction = 'create-account' | 'guest'
type TicketStatusVariant = 'info' | 'error'
type GuestTicketActionPreparation = 'ready' | 'confirmation-required' | 'blocked'

export type TicketBookingViewProps = {
  text: Record<string, string>
  language: LanguageCode
  isLoggedIn: boolean
  requiresZaloConfirmation: boolean
  singleArenaOnly: boolean
  gameGuideTrigger: ReactNode
  tariffTrigger: ReactNode
  ticketServices: TicketService[]
  ticketType: TicketType
  ticketDate: string
  ticketTime: string
  ticketPlayers: number
  ticketStatus: string
  ticketStatusVariant: TicketStatusVariant
  ticketSpecialNote: string
  isBookingTickets: boolean
  isLoadingTicketLoyalty: boolean
  ticketConfirmation: TicketBookingConfirmation | null
  ticketDurationOptions: number[]
  ticketTimeOptions: TicketTimeOption[]
  ticketPlayerOptions: number[]
  activeTicketDuration: number
  ticketPriceBlockMinutes: number
  activeTicketArenaCount: number
  currentTicketPricing: TicketPricingSummary
  currentTicketUnitPrice: number
  currentTicketTotalPrice: number
  isCheckingTicketDiscount: boolean
  ticketDiscountAmount: number
  ticketDiscountCode: string
  ticketDiscountStatus: string
  ticketDiscountSource: 'automatic' | 'voucher'
  loyaltyDiscountAmount: number
  loyaltyPointsBalance: number
  loyaltyPointsToRedeem: string
  loyaltyRedeemValue: number
  estimatedLoyaltyPointsEarned: number
  estimatedLoyaltyReductionValue: number
  maxLoyaltyPointsToRedeem: number
  useLoyaltyPoints: boolean
  onTicketTypeChange: (value: TicketType) => void
  onTicketDateChange: (value: string) => void
  onTicketTimeChange: (value: string) => void
  onTicketDurationChange: (value: number) => void
  onTicketArenaCountChange: (value: number) => void
  onTicketPlayersChange: (value: number) => void
  onTicketSpecialNoteChange: (value: string) => void
  onTicketDiscountCodeChange: (value: string) => void
  onTicketUseLoyaltyPointsChange: (checked: boolean) => void
  onTicketLoyaltyPointsChange: (value: string) => void
  onBookTickets: () => Promise<boolean>
  onValidateTicketSelection: () => boolean
  onPrepareGuestTicketAction: (action: GuestTicketAction, options?: { continueWithoutAccount?: boolean }) => Promise<GuestTicketActionPreparation>
  onPromptLogin: () => void
  onPromptCreateAccount: () => void
  formatShortDate: (dateValue: string, language: LanguageCode) => string
  formatVnd: (value: number) => string
  ticketTypeLabel: (ticketType: TicketType, text: Record<string, string>) => string
  ticketTypeDescription: (ticketType: TicketType, text: Record<string, string>) => string
  ticketUnitFormulaText: (text: Record<string, string>, unitPrice: number, players: number, arenaCount: number) => string
  guestTicketContact: GuestTicketContact
  onGuestTicketContactChange: (contact: GuestTicketContact) => void
}

export default function TicketBookingView({
  text,
  language,
  isLoggedIn,
  requiresZaloConfirmation,
  singleArenaOnly,
  gameGuideTrigger,
  tariffTrigger,
  ticketServices,
  ticketType,
  ticketDate,
  ticketTime,
  ticketPlayers,
  ticketStatus,
  ticketStatusVariant,
  ticketSpecialNote,
  isBookingTickets,
  isLoadingTicketLoyalty,
  ticketConfirmation,
  ticketDurationOptions,
  ticketTimeOptions,
  ticketPlayerOptions,
  activeTicketDuration,
  ticketPriceBlockMinutes,
  activeTicketArenaCount,
  currentTicketPricing,
  currentTicketUnitPrice,
  currentTicketTotalPrice,
  isCheckingTicketDiscount,
  ticketDiscountAmount,
  ticketDiscountCode,
  ticketDiscountStatus,
  ticketDiscountSource,
  loyaltyDiscountAmount,
  loyaltyPointsBalance,
  loyaltyPointsToRedeem,
  loyaltyRedeemValue,
  estimatedLoyaltyPointsEarned,
  estimatedLoyaltyReductionValue,
  maxLoyaltyPointsToRedeem,
  useLoyaltyPoints,
  onTicketTypeChange,
  onTicketDateChange,
  onTicketTimeChange,
  onTicketDurationChange,
  onTicketArenaCountChange,
  onTicketPlayersChange,
  onTicketSpecialNoteChange,
  onTicketDiscountCodeChange,
  onTicketUseLoyaltyPointsChange,
  onTicketLoyaltyPointsChange,
  onBookTickets,
  onValidateTicketSelection,
  onPrepareGuestTicketAction,
  onPromptLogin,
  onPromptCreateAccount,
  formatShortDate,
  formatVnd,
  ticketTypeLabel,
  ticketTypeDescription,
  ticketUnitFormulaText,
  guestTicketContact,
  onGuestTicketContactChange,
}: TicketBookingViewProps) {
  const [guestTicketContactOpen, setGuestTicketContactOpen] = useState(false)
  const [guestTicketAction, setGuestTicketAction] = useState<GuestTicketAction | null>(null)
  const guestTicketActionInFlightRef = useRef(false)
  const [guestAccountChoicePhone, setGuestAccountChoicePhone] = useState('')
  const isGuestAccountChoiceConfirmation = Boolean(guestAccountChoicePhone) && guestAccountChoicePhone === guestTicketContact.phone
  const isSpecialTicket = ticketType !== 'individual'
  const ticketTotalDisplay = isSpecialTicket ? text.ticketPriceToConfirm : formatVnd(currentTicketTotalPrice)
  const showLoyaltyTools = isLoggedIn && !isSpecialTicket && !requiresZaloConfirmation
  const specialTicketServices = ticketServices.filter((service) => service.id !== 'individual')
  const ticketAccountValueNote = estimatedLoyaltyPointsEarned > 0
    ? text.ticketAccountValueWithPoints
      .replace('{points}', String(estimatedLoyaltyPointsEarned))
      .replace('{value}', formatVnd(estimatedLoyaltyReductionValue))
    : text.ticketAccountValueNoPoints
  const ticketAccountValueLines = ticketAccountValueNote.split('\n')
  const showDiscountedTotal = !isSpecialTicket && currentTicketPricing.grossPrice > currentTicketTotalPrice
  const groupDiscountPercent = Math.round(currentTicketPricing.discountRate * 100)
  const showDiscountedUnitPrice = !isSpecialTicket && ticketDiscountSource === 'automatic' && groupDiscountPercent > 0
  const discountedTicketUnitPrice = showDiscountedUnitPrice
    ? Math.round(currentTicketUnitPrice * (1 - currentTicketPricing.discountRate))
    : currentTicketUnitPrice
  const ticketTotalReductionLabel = !isSpecialTicket && ticketDiscountAmount > 0
    ? ticketDiscountSource === 'automatic' && currentTicketPricing.discountRate > 0
      ? `-${Math.round(currentTicketPricing.discountRate * 100)}%`
      : `-${formatVnd(ticketDiscountAmount)}`
    : ''
  const ticketDateDisplay = ticketDate === localDateString()
    ? text.ticketTodayDateLabel.replace('{date}', formatTicketDateDisplay(ticketDate, language))
    : formatTicketDateDisplay(ticketDate, language, true)
  const ticketGroupDiscountSummary = currentTicketPricing.discountRate > 0
    ? text.ticketGroupDiscountApplied
      .replace('{discount}', String(Math.round(currentTicketPricing.discountRate * 100)))
      .replace('{players}', String(ticketPlayers))
    : text.ticketGroupDiscountStartsAtFive

  function handleBookTicketsClick() {
    if (!isLoggedIn) {
      if (!onValidateTicketSelection()) return
      setGuestAccountChoicePhone('')
      setGuestTicketContactOpen(true)
      return
    }
    void onBookTickets()
  }

  function handleCloseGuestTicketContact() {
    setGuestAccountChoicePhone('')
    setGuestTicketContactOpen(false)
  }

  async function handleGuestTicketAction(action: GuestTicketAction) {
    if (guestTicketActionInFlightRef.current || isBookingTickets) return
    guestTicketActionInFlightRef.current = true
    setGuestTicketAction(action)
    try {
      const preparation = await onPrepareGuestTicketAction(action, {
        continueWithoutAccount: action === 'guest' && guestAccountChoicePhone === guestTicketContact.phone,
      })
      if (preparation !== 'ready') {
        if (action === 'guest' && preparation === 'confirmation-required') {
          setGuestAccountChoicePhone(guestTicketContact.phone)
        }
        return
      }

      const booked = await onBookTickets()
      if (!booked) return

      setGuestTicketContactOpen(false)
      if (action === 'create-account') onPromptCreateAccount()
    } finally {
      guestTicketActionInFlightRef.current = false
      setGuestTicketAction(null)
    }
  }

  return (
    <section className={`section tickets-section${ticketConfirmation ? ' ticket-confirmed' : ''}`}>
      <div className="ticket-quick-actions">
        {gameGuideTrigger}
        {tariffTrigger}
      </div>

      <>
          <div className="ticket-flow-grid">
            <div className="ticket-form-panel">
              {isSpecialTicket && (
                <div className="ticket-fast-path-summary">
                  <div>
                    <strong>{ticketTypeLabel(ticketType, text)}</strong>
                    <small>{ticketTypeDescription(ticketType, text)}</small>
                  </div>
                  <button className="secondary small-button" type="button" onClick={() => onTicketTypeChange('individual')}>
                    {text.ticketUseIndividual}
                  </button>
                </div>
              )}

              <div className="form-grid compact-form-grid ticket-form-grid">
                <div className="ticket-control ticket-control-date">
                  <label>{text.date}</label>
                  <ShortDateInput
                    ariaLabel={text.date}
                    displayValueOverride={ticketDateDisplay}
                    language={language}
                    onChange={onTicketDateChange}
                    placeholder={text.chooseDate}
                    value={ticketDate}
                  />
                </div>
                <div className="ticket-control ticket-control-time">
                  <label htmlFor="ticket-available-time">{text.availableTime}</label>
                  <select id="ticket-available-time" value={ticketTime} onChange={(event) => onTicketTimeChange(event.target.value)}>
                    <option value="">{text.chooseTime}</option>
                    {ticketTimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ticket-control ticket-control-duration">
                  <label htmlFor="ticket-duration">{bookingDurationCopy[language].ticket}</label>
                  <select
                    disabled={ticketDurationOptions.length === 0}
                    id="ticket-duration"
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
                <div className="ticket-control ticket-control-players">
                  <label htmlFor="ticket-player-count">{text.numberOfPlayers}</label>
                  <select id="ticket-player-count" value={ticketPlayers} onChange={(event) => onTicketPlayersChange(Number(event.target.value))}>
                    {ticketPlayerOptions.map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? text.ticketFormulaPlayer : text.players}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ticket-control ticket-control-arenas">
                  <label htmlFor="ticket-arena-count">{text.ticketArenaCountLabel}</label>
                  <select
                    disabled={singleArenaOnly}
                    id="ticket-arena-count"
                    value={activeTicketArenaCount}
                    onChange={(event) => onTicketArenaCountChange(Number(event.target.value))}
                  >
                    <option value={1}>{singleArenaOnly ? text.ticketCafeArena : text.ticketOneArena}</option>
                    {!singleArenaOnly && <option value={2} disabled={ticketPlayers <= 4}>{text.ticketTwoArenas}</option>}
                  </select>
                </div>
              </div>

              {!isSpecialTicket && !requiresZaloConfirmation && (
                <details className="ticket-voucher-details">
                  <summary>{text.ticketDiscountCodeLabel}{ticketDiscountCode ? ` · ${ticketDiscountCode}` : ''}</summary>
                  <label className="ticket-discount-code-field">
                    <span>{text.ticketDiscountCodeLabel}</span>
                    <input
                      autoCapitalize="characters"
                      autoComplete="off"
                      inputMode="text"
                      placeholder={text.ticketDiscountCodePlaceholder}
                      value={ticketDiscountCode}
                      onChange={(event) => onTicketDiscountCodeChange(event.target.value)}
                    />
                    {(isCheckingTicketDiscount || ticketDiscountStatus) && (
                      <small>{isCheckingTicketDiscount ? text.ticketDiscountCodeChecking : ticketDiscountStatus}</small>
                    )}
                  </label>
                </details>
              )}

              {isSpecialTicket && (
                <label className="ticket-special-note-field">
                  <span>{text.ticketSpecialNoteLabel}</span>
                  <textarea
                    disabled={isBookingTickets || guestTicketAction !== null}
                    maxLength={500}
                    onChange={(event) => onTicketSpecialNoteChange(event.target.value)}
                    placeholder={text.ticketSpecialNotePlaceholder}
                    value={ticketSpecialNote}
                  />
                  <small>{text.ticketSpecialNoteCharacterCount.replace('{count}', String(ticketSpecialNote.length))}</small>
                </label>
              )}

              <div className="ticket-price-summary">
                <div>
                  <span>{bookingDurationCopy[language].ticket}</span>
                  <strong>{activeTicketDuration} min</strong>
                </div>
                {!isSpecialTicket && (
                  <div>
                    <span className="ticket-unit-heading">
                      {text.unitPrice}
                      {showDiscountedUnitPrice && <em className="ticket-total-reduction">-{groupDiscountPercent}%</em>}
                    </span>
                    {showDiscountedUnitPrice && (
                      <small className="ticket-total-original">{formatVnd(currentTicketUnitPrice)}</small>
                    )}
                    <strong className={showDiscountedUnitPrice ? 'ticket-unit-discounted' : undefined}>
                      {formatVnd(discountedTicketUnitPrice)}
                    </strong>
                    <small>{ticketPriceBlockMinutes === 20 ? text.ticketUnitPriceBasisLegacy : ticketUnitFormulaText(text, currentTicketUnitPrice, ticketPlayers, activeTicketArenaCount)}</small>
                  </div>
                )}
                <div className="ticket-reserved-line">
                  <span>{text.numberOfPlayers}</span>
                  <strong>{ticketPlayers} {ticketPlayers === 1 ? text.ticketFormulaPlayer : text.players}</strong>
                </div>
                <div className="ticket-total-line">
                  <span className="ticket-total-heading">
                    {text.totalPrice}
                    {ticketTotalReductionLabel && <em className="ticket-total-reduction">{ticketTotalReductionLabel}</em>}
                  </span>
                  {showDiscountedTotal && (
                    <small className="ticket-total-original">{formatVnd(currentTicketPricing.grossPrice)}</small>
                  )}
                  <strong>{ticketTotalDisplay}</strong>
                </div>
                {showLoyaltyTools && (
                  <div className="ticket-loyalty-redemption">
                    <p className="ticket-loyalty-zero">
                      {estimatedLoyaltyPointsEarned > 0
                        ? text.ticketLoyaltyEarnEstimate
                          .replace('{points}', String(estimatedLoyaltyPointsEarned))
                          .replace('{value}', formatVnd(estimatedLoyaltyReductionValue))
                        : text.ticketLoyaltyEarnZero}
                    </p>
                    {loyaltyPointsBalance <= 0 && !isLoadingTicketLoyalty ? (
                      null
                    ) : (
                      <>
                        <div>
                          <span>{text.ticketLoyaltyBalance}</span>
                          <strong>{loyaltyPointsBalance} {text.loyaltyPoints}</strong>
                          <small>
                            {loyaltyRedeemValue > 0
                              ? text.ticketLoyaltyRedeemRate.replace('{value}', formatVnd(loyaltyRedeemValue))
                              : isLoadingTicketLoyalty
                                ? text.ticketLoyaltyLoading
                                : text.ticketLoyaltyUnavailable}
                          </small>
                        </div>
                        <label className="ticket-loyalty-toggle">
                          <input
                            checked={useLoyaltyPoints}
                            disabled={maxLoyaltyPointsToRedeem <= 0}
                            onChange={(event) => onTicketUseLoyaltyPointsChange(event.target.checked)}
                            type="checkbox"
                          />
                          <span>{text.ticketUseLoyaltyPoints}</span>
                        </label>
                        {useLoyaltyPoints && (
                          <label className="ticket-loyalty-input">
                            <span>{text.ticketLoyaltyPointsToUse}</span>
                            <input
                              inputMode="numeric"
                              max={maxLoyaltyPointsToRedeem}
                              min={0}
                              onChange={(event) => onTicketLoyaltyPointsChange(event.target.value)}
                              type="number"
                              value={loyaltyPointsToRedeem}
                            />
                            <small>{text.ticketLoyaltyMax.replace('{points}', String(maxLoyaltyPointsToRedeem))}</small>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}
                {showLoyaltyTools && loyaltyDiscountAmount > 0 && (
                  <div className="ticket-discount-line">
                    <span>{text.ticketLoyaltyDiscount}</span>
                    <strong>-{formatVnd(loyaltyDiscountAmount)}</strong>
                    <small>{loyaltyPointsToRedeem || 0} {text.loyaltyPoints}</small>
                  </div>
                )}
              </div>

              {!isSpecialTicket && (
                <div className="ticket-group-pricing-note" aria-live="polite">
                  <strong>{ticketGroupDiscountSummary}</strong>
                  <span>{text.ticketGroupDiscountRule}</span>
                </div>
              )}

              {ticketType !== 'individual' && (
                <p className="field-help ticket-helper-note">{text.ticketSpecialBookingNote}</p>
              )}
              {!requiresZaloConfirmation && <p className="field-help ticket-helper-note">{text.ticketDiscountDeskNote}</p>}

              <div className="ticket-checkout-action">
                <div className="ticket-mobile-total"><span>{text.totalPrice}</span><strong>{ticketTotalDisplay}</strong></div>
                {requiresZaloConfirmation && <p className="ticket-confirmation-requirement">{text.bookingVenueCafeBookingNoticeStatus}</p>}
                <button
                  className={isBookingTickets ? 'primary create-button loading' : 'primary create-button'}
                  disabled={isBookingTickets || guestTicketAction !== null}
                  type="button"
                  onClick={handleBookTicketsClick}
                >
                  {isBookingTickets
                    ? requiresZaloConfirmation ? text.submittingBookingRequest : text.bookingTickets
                    : requiresZaloConfirmation ? text.submitBookingRequest : text.bookTickets}
                </button>
              </div>
              {!isLoggedIn && !isSpecialTicket && (
                <button className="ticket-account-value-note" type="button" onClick={onPromptCreateAccount}>
                  {ticketAccountValueLines.map((line, index) => (
                    <span key={`${line}-${index}`}>{line}</span>
                  ))}
                </button>
              )}
              {ticketStatus && <p className={ticketStatusVariant === 'error' ? 'notice ticket-status-message ticket-status-error' : 'notice ticket-status-message'}>{ticketStatus}</p>}
            </div>

            <p className="field-help ticket-duration-explanation">{bookingDurationCopy[language].hint}</p>
            <div className="ticket-type-list ticket-event-options">
              <label>{text.ticketEventHelpTitle}</label>
              <p className="ticket-event-options-copy">{text.ticketEventHelpBody}</p>
              <div className="ticket-service-grid">
                {specialTicketServices.map((service) => (
                  <button
                    className={ticketType === service.id ? 'ticket-service-card active' : 'ticket-service-card'}
                    key={service.id}
                    type="button"
                    onClick={() => onTicketTypeChange(service.id)}
                  >
                    <strong>{ticketTypeLabel(service.id, text)}</strong>
                    <span>{ticketTypeDescription(service.id, text)}</span>
                    <small>
                      {bookingDurationCopy[language].event} · {service.minPlayers}-{service.maxPlayers} {text.players}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ContactChannels className="ticket-mobile-contact" label={text.contactUs} />

          {!isLoggedIn && guestTicketContactOpen && (
            <div className="modal-backdrop guest-ticket-modal-backdrop">
              <div className="login-modal guest-ticket-modal" role="dialog" aria-modal="true" aria-label={text.guestTicketTitle}>
                <button aria-label={text.close} className="modal-close" type="button" onClick={handleCloseGuestTicketContact}>
                  <X aria-hidden="true" size={18} />
                </button>
                {isGuestAccountChoiceConfirmation ? (
                  <div className="guest-ticket-account-confirmation">
                    <div className="guest-ticket-copy">
                      <strong>{text.guestTicketRegisteredConfirmTitle}</strong>
                      <span>{text.guestTicketRegisteredConfirmBody}</span>
                    </div>
                    <div className="guest-ticket-confirm-phone">
                      <span>{text.guestTicketRegisteredConfirmPhone}</span>
                      <strong>{guestTicketContact.phone}</strong>
                    </div>
                    {ticketStatus && (
                      <p className={ticketStatusVariant === 'error' ? 'notice ticket-status-message ticket-status-error' : 'notice ticket-status-message'}>{ticketStatus}</p>
                    )}
                    <div className="guest-ticket-actions">
                      <button
                        className="primary create-button"
                        disabled={isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => {
                          setGuestTicketContactOpen(false)
                          onPromptLogin()
                        }}
                      >
                        {text.guestTicketRegisteredConfirmLoginCta}
                      </button>
                      <button
                        className={isBookingTickets && guestTicketAction === 'guest' ? 'secondary create-button loading' : 'secondary create-button'}
                        disabled={isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => void handleGuestTicketAction('guest')}
                      >
                        {isBookingTickets && guestTicketAction === 'guest' ? text.bookingTickets : text.guestTicketRegisteredConfirmContinueCta}
                      </button>
                      <button
                        className="link-button guest-ticket-back-button"
                        disabled={isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => setGuestAccountChoicePhone('')}
                      >
                        {text.onboardingPrevious}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <GuestTicketContactPanel
                      contact={guestTicketContact}
                      disabled={isBookingTickets || guestTicketAction !== null}
                      estimatedLoyaltyPointsEarned={estimatedLoyaltyPointsEarned}
                      onChange={onGuestTicketContactChange}
                      onPromptLogin={() => {
                        setGuestTicketContactOpen(false)
                        onPromptLogin()
                      }}
                      text={text}
                    />
                    {ticketStatus && <p className={ticketStatusVariant === 'error' ? 'notice ticket-status-message ticket-status-error' : 'notice ticket-status-message'}>{ticketStatus}</p>}
                    <div className="guest-ticket-actions">
                      <button
                        className={isBookingTickets && guestTicketAction === 'create-account' ? 'primary create-button loading' : 'primary create-button'}
                        disabled={isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => void handleGuestTicketAction('create-account')}
                      >
                        {isBookingTickets && guestTicketAction === 'create-account' ? text.bookingTickets : text.guestTicketCreateAccountCta}
                      </button>
                      <button
                        className={isBookingTickets && guestTicketAction === 'guest' ? 'secondary create-button loading' : 'secondary create-button'}
                        disabled={isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => void handleGuestTicketAction('guest')}
                      >
                        {isBookingTickets && guestTicketAction === 'guest' ? text.bookingTickets : text.guestTicketBookWithoutAccountCta}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {ticketConfirmation && (
            <div className="ticket-confirmation">
              <div>
                <span>{ticketConfirmation.requiresZaloConfirmation ? text.bookingRequestSubmitted : text.bookingConfirmed}</span>
                <strong>{ticketConfirmation.ticketLabel}</strong>
              </div>
              <div className="ticket-confirmation-grid">
                <span>{formatShortDate(ticketConfirmation.date, language)}</span>
                <span>{ticketConfirmation.time}</span>
                <span>{ticketConfirmation.players} {text.players}</span>
                <span>{ticketConfirmation.ticketType === 'individual' ? formatVnd(ticketConfirmation.totalPrice) : text.ticketPriceToConfirm}</span>
              </div>
              {ticketConfirmation.ticketType === 'individual' && Boolean(ticketConfirmation.loyaltyPointsRedeemed && ticketConfirmation.loyaltyDiscountAmount) && (
                <p>
                  {text.ticketLoyaltyRedeemed}: <strong>{ticketConfirmation.loyaltyPointsRedeemed} {text.loyaltyPoints}</strong> (-{formatVnd(ticketConfirmation.loyaltyDiscountAmount || 0)})
                </p>
              )}
              {ticketConfirmation.ticketType === 'individual' && Boolean(ticketConfirmation.discountCode && ticketConfirmation.discountAmount) && (
                <p>
                  {text.ticketDiscountCodeSummary}: <strong>{ticketConfirmation.discountCode}</strong> (-{formatVnd(ticketConfirmation.discountAmount || 0)})
                </p>
              )}
              {ticketConfirmation.reference && (
                <p>
                  {text.bookingReference}: <strong>{ticketConfirmation.reference}</strong>
                </p>
              )}
              {ticketConfirmation.requiresZaloConfirmation && (
                <p className="ticket-confirmation-zalo">
                  <strong>{text.bookingRequestPendingZalo}</strong>
                  <a href={VRENA_ZALO_URL} rel="noreferrer" target="_blank">
                    {text.bookingVenueCafeOpenZalo}
                  </a>
                </p>
              )}
              {ticketConfirmation.guestPhone && (
                <p>
                  {text.guestTicketResumeHint
                    .replace('{phone}', ticketConfirmation.guestPhone)
                    .replace('{reference}', ticketConfirmation.reference || '-')}
                </p>
              )}
              {!isLoggedIn && (
                <div className="guest-ticket-next-steps">
                  <strong>{text.guestTicketSavedTitle}</strong>
                  <span>{text.guestTicketSavedBody}</span>
                  <button className="secondary small-button" type="button" onClick={onPromptCreateAccount}>
                    {text.guestTicketCreateAccountCta}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
    </section>
  )
}
