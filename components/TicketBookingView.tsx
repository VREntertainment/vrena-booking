'use client'

import dynamic from 'next/dynamic'
import { birthdayPackages, birthdayPackageById, birthdayPackageNote, withoutBirthdayPackageNote } from '../lib/birthdayPackages'
import { birthdayPackageCopy } from '../lib/birthdayPackageCopy'
import { ArrowRight, X } from 'lucide-react'
import { ticketClarityCopy } from '../lib/ticketClarityCopy'
import { useRef, useState, type ReactNode } from 'react'
import type { GuestTicketContact } from '../lib/guestTicketBooking'
import { bookingDurationCopy } from '../lib/bookingDurationCopy'
import { vietnamClock } from '../lib/booking/arenaAvailability'
import type { LanguageCode } from '../lib/i18n/languages'
import ContactChannels from './ContactChannels'
import BookingPhoneDialog from './BookingPhoneDialog'
import GuestTicketContactPanel from './GuestTicketContactPanel'

const ShortDateInput = dynamic(() => import('./ShortDateInput'), { ssr: false })

function localDateString(date = new Date()) {
  return vietnamClock(date).date
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
  manualDiscountReview?: boolean
}

type GuestTicketAction = 'create-account' | 'guest'
type TicketStatusVariant = 'info' | 'error'
type GuestTicketActionPreparation = 'ready' | 'confirmation-required' | 'blocked'

export type TicketBookingViewProps = {
  text: Record<string, string>
  language: LanguageCode
  isLoggedIn: boolean
  isAuthLoading: boolean
  needsAccountPhone: boolean
  manualDiscountReview: boolean
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
  birthdayPackageId: string
  onBirthdayPackageChange: (id: string) => void
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
  isAuthLoading,
  needsAccountPhone,
  manualDiscountReview,
  singleArenaOnly,
  tariffTrigger,
  ticketServices,
  ticketType,
  ticketDate,
  ticketTime,
  ticketPlayers,
  ticketStatus,
  ticketStatusVariant,
  birthdayPackageId,
  onBirthdayPackageChange,
  ticketSpecialNote,
  isBookingTickets,
  isLoadingTicketLoyalty,
  ticketConfirmation,
  ticketDurationOptions,
  ticketTimeOptions,
  ticketPlayerOptions,
  activeTicketDuration,
  activeTicketArenaCount,
  currentTicketPricing,
  currentTicketTotalPrice,
  isCheckingTicketDiscount,
  ticketDiscountAmount,
  ticketDiscountCode,
  ticketDiscountStatus,
  ticketDiscountSource,
  loyaltyDiscountAmount,
  loyaltyPointsBalance,
  loyaltyPointsToRedeem,
  estimatedLoyaltyPointsEarned,
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
  guestTicketContact,
  onGuestTicketContactChange,
}: TicketBookingViewProps) {
  const [guestTicketContactOpen, setGuestTicketContactOpen] = useState(false)
  const [guestTicketAction, setGuestTicketAction] = useState<GuestTicketAction | null>(null)
  const guestTicketActionInFlightRef = useRef(false)
  const [guestAccountChoicePhone, setGuestAccountChoicePhone] = useState('')
  const isGuestAccountChoiceConfirmation = Boolean(guestAccountChoicePhone) && guestAccountChoicePhone === guestTicketContact.phone
  const clarity = ticketClarityCopy[language]
  const birthdayCopy = birthdayPackageCopy[language]
  const birthdayPackage = birthdayPackageById(birthdayPackageId)
  const isSpecialTicket = ticketType !== 'individual'
  const ticketTotalDisplay = birthdayPackage ? formatVnd(birthdayPackage.price) : isSpecialTicket ? clarity.quote : formatVnd(currentTicketTotalPrice)
  const showLoyaltyTools = isLoggedIn && !isSpecialTicket && !manualDiscountReview && loyaltyPointsBalance > 0
  const specialTicketServices = ticketServices.filter((service) => service.id !== 'individual')
  const showDiscountedTotal = !isSpecialTicket && currentTicketPricing.grossPrice > currentTicketTotalPrice
  const ticketTotalReductionLabel = !isSpecialTicket && ticketDiscountAmount > 0
    ? ticketDiscountSource === 'automatic' && currentTicketPricing.discountRate > 0
      ? `-${Math.round(currentTicketPricing.discountRate * 100)}%`
      : `-${formatVnd(ticketDiscountAmount)}`
    : ''
  const ticketDateDisplay = ticketDate === localDateString()
    ? text.ticketTodayDateLabel.replace('{date}', formatTicketDateDisplay(ticketDate, language))
    : formatTicketDateDisplay(ticketDate, language, true)

  function handleBookTicketsClick() {
    if (!isLoggedIn || needsAccountPhone) {
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
    <section className={`section tickets-section ticket-streamlined${ticketConfirmation ? ' ticket-confirmed' : ''}`}>
      <>
          <div className="ticket-flow-grid">
            <div className="ticket-form-panel">
              {isSpecialTicket && (
                <div className="ticket-fast-path-summary">
                  <div>
                    <strong>{ticketTypeLabel(ticketType, text)}</strong>
                  </div>
                  <button className="secondary small-button" type="button" onClick={() => onTicketTypeChange('individual')}>
                    {text.ticketUseIndividual}
                  </button>
                </div>
              )}

              {ticketType === 'birthday' && (
                <div className="birthday-package-selection">
                  <label htmlFor="birthday-package">{birthdayCopy.label}</label>
                  <select id="birthday-package" value={birthdayPackageId} onChange={event => onBirthdayPackageChange(event.target.value)} disabled={isBookingTickets}>
                    <option value="">{birthdayCopy.custom}</option>
                    {birthdayPackages.map(item => <option key={item.id} value={item.id}>{item.name} · {birthdayCopy.duration} · {item.players} {text.players} · {formatVnd(item.price)}</option>)}
                  </select>

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
                  <label htmlFor="ticket-duration">{clarity.duration}</label>
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
                    aria-describedby="ticket-arena-recommendation"
                    value={activeTicketArenaCount}
                    onChange={(event) => onTicketArenaCountChange(Number(event.target.value))}
                  >
                    <option value={1}>{text.ticketOneArenaChoice}</option>
                    {!singleArenaOnly && <option value={2}>{text.ticketTwoArenasChoice}</option>}
                  </select>
                  <p className="field-help" id="ticket-arena-recommendation" aria-live="polite">
                    {activeTicketArenaCount === 1
                      ? ticketPlayers <= (singleArenaOnly ? 8 : 4) ? text.ticketArenaTogether : singleArenaOnly ? text.ticketArenaTakeTurns : text.ticketArenaRecommendTwo
                      : ticketPlayers <= 4 ? text.ticketArenaExtraSpace : ticketPlayers <= 8 ? text.ticketArenasTogether : text.ticketArenasTakeTurns}
                  </p>
                </div>
              </div>

              {!isSpecialTicket && (
                <details className="ticket-voucher-details">
                  <summary>{text.ticketDiscountCodeLabel}{ticketDiscountCode ? ` · ${ticketDiscountCode}` : ''}</summary>
                  <label className="ticket-discount-code-field">
                    <span>{text.ticketDiscountCodeLabel}</span>
                    <input
                      maxLength={64}
                      autoCapitalize="characters"
                      autoComplete="off"
                      inputMode="text"
                      placeholder={text.ticketDiscountCodePlaceholder}
                      value={ticketDiscountCode}
                      onChange={(event) => onTicketDiscountCodeChange(event.target.value)}
                    />
                    {manualDiscountReview && <small>{text.ticketCafeDiscountConfirmationNote}</small>}
                    {(isCheckingTicketDiscount || ticketDiscountStatus) && (
                      <small>{isCheckingTicketDiscount ? text.ticketDiscountCodeChecking : ticketDiscountStatus}</small>
                    )}
                  </label>
                </details>
              )}

              {isSpecialTicket && (
                <details className="ticket-extras">
                  <summary>{clarity.requests}</summary>
                <label className="ticket-special-note-field">
                  <span>{text.ticketSpecialNoteLabel}</span>
                  <textarea
                    disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
                    maxLength={birthdayPackage ? 500 - birthdayPackageNote(birthdayPackage).length - 1 : 500}
                    onChange={(event) => onTicketSpecialNoteChange(birthdayPackage ? `${birthdayPackageNote(birthdayPackage)}\n${event.target.value}` : event.target.value)}
                    placeholder={text.ticketSpecialNotePlaceholder}
                    value={birthdayPackage ? withoutBirthdayPackageNote(ticketSpecialNote) : ticketSpecialNote}
                  />
                </label>
                </details>
              )}

              <div className="ticket-price-summary">
                {showLoyaltyTools && (
                  <div className="ticket-loyalty-redemption">
                    <div className="ticket-loyalty-heading">
                      <label className="ticket-loyalty-toggle">
                        <input checked={useLoyaltyPoints} onChange={(event) => onTicketUseLoyaltyPointsChange(event.target.checked)} type="checkbox" />
                        <span>{text.ticketUseLoyaltyPoints}</span>
                      </label>
                      <span className="ticket-loyalty-balance" role="status">
                        {isLoadingTicketLoyalty ? text.ticketLoyaltyLoading : text.ticketLoyaltyAvailableBalance.replace('{points}', String(loyaltyPointsBalance))}
                      </span>
                    </div>
                    {useLoyaltyPoints && maxLoyaltyPointsToRedeem > 0 && (
                      <div className="ticket-loyalty-details">
                        <label className="ticket-loyalty-input">
                          <span>{text.ticketLoyaltyPointsToUse}</span>
                          <input inputMode="numeric" max={maxLoyaltyPointsToRedeem} min={0}
                            onChange={(event) => onTicketLoyaltyPointsChange(event.target.value)} type="number" value={loyaltyPointsToRedeem} />
                        </label>
                        {loyaltyDiscountAmount > 0 && <div className="ticket-discount-line"><strong>-{formatVnd(loyaltyDiscountAmount)}</strong></div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="ticket-checkout-action">
                <div className="ticket-mobile-total" aria-live="polite">
                  <span>{birthdayPackage ? birthdayCopy.label : text.totalPrice}{ticketTotalReductionLabel && ` · ${ticketTotalReductionLabel}`}</span>
                  {showDiscountedTotal && <small className="ticket-total-original">{formatVnd(currentTicketPricing.grossPrice)}</small>}
                  <strong>{ticketTotalDisplay}</strong>
                  <small>{isSpecialTicket ? clarity.confirm : clarity.pay}</small>
                </div>
                <button
                  className={isBookingTickets ? 'primary create-button loading' : 'primary create-button'}
                  disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
                  type="button"
                  onClick={handleBookTicketsClick}
                >
                  {isBookingTickets
                    ? text.bookingTickets
                    : text.bookTickets}
                  {!isBookingTickets && <ArrowRight size={20} aria-hidden="true" />}
                </button>
              </div>
              {ticketStatus && <p className={ticketStatusVariant === 'error' ? 'notice ticket-status-message ticket-status-error' : 'notice ticket-status-message'}>{ticketStatus}</p>}
            </div>

            <details className="ticket-duration-information ticket-extras">
              <summary>{clarity.help}</summary>
              <div className="ticket-help-content">
                <div className="ticket-quick-actions">{tariffTrigger}</div>
                <p className="field-help">{ticketType === 'birthday' ? birthdayCopy.note : bookingDurationCopy[language].hint}</p>
                {isSpecialTicket && <p className="field-help">{text.ticketSpecialBookingNote}</p>}
                <p className="field-help">{text.sessionTariffPayment}</p>
                {ticketType === 'birthday' && <p className="field-help">{text.birthdayTicketDescription}</p>}
                <ContactChannels venue={manualDiscountReview ? 'cafe-des-stagiaires' : 'ha-do-centrosa'} className="ticket-venue-contact" label={text.contactUs} showPhone={false} />
              </div>
            </details>
            <div className="ticket-type-list ticket-event-options">
              <div className="ticket-service-grid">
                {specialTicketServices.map((service) => (
                  <button
                    className={ticketType === service.id ? 'ticket-service-card active' : 'ticket-service-card'}
                    key={service.id}
                    type="button"
                    onClick={() => onTicketTypeChange(service.id)}
                  >
                    <strong>{ticketTypeLabel(service.id, text)}</strong>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoggedIn && guestTicketContactOpen && <BookingPhoneDialog
            language={language} text={text} phone={guestTicketContact.phone}
            onPhoneChange={phone => onGuestTicketContactChange({ ...guestTicketContact, phone })}
            onConfirm={onBookTickets} onClose={handleCloseGuestTicketContact}
            busy={isBookingTickets} error={ticketStatusVariant === 'error' ? ticketStatus : ''} />}
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
                        disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
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
                        disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => void handleGuestTicketAction('guest')}
                      >
                        {isBookingTickets && guestTicketAction === 'guest' ? text.bookingTickets : text.guestTicketRegisteredConfirmContinueCta}
                      </button>
                      <button
                        className="link-button guest-ticket-back-button"
                        disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
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
                      disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
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
                        disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
                        type="button"
                        onClick={() => void handleGuestTicketAction('create-account')}
                      >
                        {isBookingTickets && guestTicketAction === 'create-account' ? text.bookingTickets : text.guestTicketCreateAccountCta}
                      </button>
                      <button
                        className={isBookingTickets && guestTicketAction === 'guest' ? 'secondary create-button loading' : 'secondary create-button'}
                        disabled={isAuthLoading || isBookingTickets || guestTicketAction !== null}
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
                <span>{text.bookingConfirmed}</span>{' '}
                <strong>{ticketConfirmation.ticketLabel}</strong>
              </div>
              <p>{text.sessionTariffPayment}</p>
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
              {ticketConfirmation.ticketType === 'individual' && Boolean(ticketConfirmation.discountCode && (ticketConfirmation.discountAmount || ticketConfirmation.manualDiscountReview)) && (
                <p>
                  {text.ticketDiscountCodeSummary}: <strong>{ticketConfirmation.discountCode}</strong> {Boolean(ticketConfirmation.discountAmount) && <> (-{formatVnd(ticketConfirmation.discountAmount || 0)})</>}
                  {ticketConfirmation.manualDiscountReview && <><br />{text.ticketCafeDiscountConfirmationNote}</>}
                </p>
              )}
              {ticketConfirmation.reference && (
                <p>
                  {text.bookingReference}: <strong>{ticketConfirmation.reference}</strong>
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
