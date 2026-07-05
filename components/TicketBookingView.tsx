'use client'

import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { GuestTicketContact } from '../lib/guestTicketBooking'
import type { LanguageCode } from '../lib/i18n/languages'
import ContactChannels from './ContactChannels'
import GuestTicketContactPanel from './GuestTicketContactPanel'

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
  chargedPlayersPerBlock: number
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
  guestPhone?: string
  guestName?: string
  loyaltyPointsRedeemed?: number
  loyaltyDiscountAmount?: number
  discountCode?: string
  discountAmount?: number
}

type GuestTicketAction = 'create-account' | 'guest'

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
  isLoadingTicketLoyalty: boolean
  ticketConfirmation: TicketBookingConfirmation | null
  ticketDurationOptions: number[]
  ticketTimeOptions: TicketTimeOption[]
  ticketPlayerOptions: number[]
  activeTicketDuration: number
  currentTicketPricing: TicketPricingSummary
  currentTicketUnitPrice: number
  currentTicketTotalPrice: number
  isCheckingTicketDiscount: boolean
  ticketDiscountAmount: number
  ticketDiscountCode: string
  ticketDiscountName: string
  ticketDiscountStatus: string
  ticketDiscountSource: 'automatic' | 'voucher'
  loyaltyDiscountAmount: number
  loyaltyPointsBalance: number
  loyaltyPointsToRedeem: string
  loyaltyRedeemValue: number
  estimatedLoyaltyPointsEarned: number
  estimatedLoyaltyReductionValue: number
  maxLoyaltyPointsToRedeem: number
  ticketDurationMessage: string
  useLoyaltyPoints: boolean
  onTicketTypeChange: (value: TicketType) => void
  onTicketDateChange: (value: string) => void
  onTicketTimeChange: (value: string) => void
  onTicketDurationChange: (value: number) => void
  onTicketPlayersChange: (value: number) => void
  onTicketDiscountCodeChange: (value: string) => void
  onTicketUseLoyaltyPointsChange: (checked: boolean) => void
  onTicketLoyaltyPointsChange: (value: string) => void
  onBookTickets: () => Promise<boolean>
  onPromptLogin: () => void
  onPromptCreateAccount: () => void
  formatShortDate: (dateValue: string, language: LanguageCode) => string
  formatVnd: (value: number) => string
  ticketTypeLabel: (ticketType: TicketType, text: Record<string, string>) => string
  ticketTypeDescription: (ticketType: TicketType, text: Record<string, string>) => string
  ticketUnitFormulaText: (text: Record<string, string>, unitPrice: number, players: number) => string
  guestTicketContact: GuestTicketContact
  onGuestTicketContactChange: (contact: GuestTicketContact) => void
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
  isLoadingTicketLoyalty,
  ticketConfirmation,
  ticketDurationOptions,
  ticketTimeOptions,
  ticketPlayerOptions,
  activeTicketDuration,
  currentTicketPricing,
  currentTicketUnitPrice,
  currentTicketTotalPrice,
  isCheckingTicketDiscount,
  ticketDiscountAmount,
  ticketDiscountCode,
  ticketDiscountName,
  ticketDiscountStatus,
  ticketDiscountSource,
  loyaltyDiscountAmount,
  loyaltyPointsBalance,
  loyaltyPointsToRedeem,
  loyaltyRedeemValue,
  estimatedLoyaltyPointsEarned,
  estimatedLoyaltyReductionValue,
  maxLoyaltyPointsToRedeem,
  ticketDurationMessage,
  useLoyaltyPoints,
  onTicketTypeChange,
  onTicketDateChange,
  onTicketTimeChange,
  onTicketDurationChange,
  onTicketPlayersChange,
  onTicketDiscountCodeChange,
  onTicketUseLoyaltyPointsChange,
  onTicketLoyaltyPointsChange,
  onBookTickets,
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
  const isSpecialTicket = ticketType !== 'individual'
  const ticketTotalDisplay = isSpecialTicket ? text.ticketPriceToConfirm : formatVnd(currentTicketTotalPrice)
  const showLoyaltyTools = isLoggedIn && !isSpecialTicket
  const currentTicketService = ticketServices.find((service) => service.id === ticketType)
  const ticketSummaryMeta = currentTicketService
    ? `20-120 min • ${currentTicketService.minPlayers}-${currentTicketService.maxPlayers} ${text.players}`
    : ''
  const ticketSummaryDetail = ticketType === 'individual'
    ? ['1 ticket / person', ticketSummaryMeta].filter(Boolean).join(' • ')
    : [ticketTypeDescription(ticketType, text), ticketSummaryMeta].filter(Boolean).join(' • ')
  const specialTicketServices = ticketServices.filter((service) => service.id !== 'individual')

  useEffect(() => {
    if (ticketConfirmation) setGuestTicketContactOpen(false)
  }, [ticketConfirmation])

  function handleBookTicketsClick() {
    if (!isLoggedIn) {
      setGuestTicketContactOpen(true)
      return
    }
    void onBookTickets()
  }

  async function handleGuestTicketAction(action: GuestTicketAction) {
    setGuestTicketAction(action)
    const booked = await onBookTickets()
    setGuestTicketAction(null)

    if (!booked) return

    setGuestTicketContactOpen(false)
    if (action === 'create-account') onPromptCreateAccount()
  }

  return (
    <section className="section tickets-section">
      <div className="ticket-quick-actions">
        {gameGuideTrigger}
        {tariffTrigger}
      </div>

      <>
          <div className="ticket-flow-grid">
            <div className="ticket-form-panel">
              <div className="ticket-fast-path-summary">
                <div>
                  {isSpecialTicket && <strong>{ticketTypeLabel(ticketType, text)}</strong>}
                  <small>{ticketSummaryDetail}</small>
                </div>
                {isSpecialTicket && (
                  <button className="secondary small-button" type="button" onClick={() => onTicketTypeChange('individual')}>
                    {text.ticketUseIndividual}
                  </button>
                )}
              </div>

              <div className="form-grid compact-form-grid ticket-form-grid">
                <div className="ticket-control ticket-control-date">
                  <label>{text.date} <span className="required">*</span></label>
                  <ShortDateInput
                    ariaLabel={text.date}
                    language={language}
                    onChange={onTicketDateChange}
                    placeholder={text.chooseDate}
                    value={ticketDate}
                  />
                </div>
                <div className="ticket-control ticket-control-time">
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
                <div className="ticket-control ticket-control-duration">
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
                <div className="ticket-control ticket-control-players">
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

              {!isSpecialTicket && (
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
              )}

              <div className="ticket-price-summary">
                <div>
                  <span>{text.duration}</span>
                  <strong>{activeTicketDuration} min</strong>
                </div>
                {!isSpecialTicket && (
                  <div>
                    <span>{text.unitPrice}</span>
                    <strong>{formatVnd(currentTicketUnitPrice)}</strong>
                    <small>{ticketUnitFormulaText(text, currentTicketUnitPrice, ticketPlayers)}</small>
                  </div>
                )}
                <div className="ticket-reserved-line">
                  <span>{text.reservedPlayerSpots}</span>
                  <strong>{currentTicketPricing.chargedPlayerSpots}</strong>
                  <small>{currentTicketPricing.durationBlocks} x {currentTicketPricing.chargedPlayersPerBlock} {text.players}</small>
                </div>
                {!isSpecialTicket && currentTicketPricing.discountRate > 0 && (
                  <div className="ticket-discount-line">
                    <span>{text.discount}</span>
                    <strong>{Math.round(currentTicketPricing.discountRate * 100)}%</strong>
                    <small>-{formatVnd(currentTicketPricing.discountAmount)}</small>
                  </div>
                )}
                {!isSpecialTicket && ticketDiscountAmount > 0 && (
                  <div className="ticket-discount-line">
                    <span>{ticketDiscountSource === 'voucher' ? text.ticketDiscountCodeSummary : text.discount}</span>
                    <strong>-{formatVnd(ticketDiscountAmount)}</strong>
                    <small>{ticketDiscountSource === 'voucher' ? ticketDiscountCode.trim().toUpperCase() : ticketDiscountName}</small>
                  </div>
                )}
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
                <div className="ticket-total-line">
                  <span>{text.totalPrice}</span>
                  <strong>{ticketTotalDisplay}</strong>
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
                onClick={handleBookTicketsClick}
              >
                {isBookingTickets ? text.bookingTickets : text.bookTickets}
              </button>
              {ticketStatus && <p className="notice">{ticketStatus}</p>}
            </div>

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
                      20-120 min · {service.minPlayers}-{service.maxPlayers} {text.players}
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
                <button aria-label={text.close} className="modal-close" type="button" onClick={() => setGuestTicketContactOpen(false)}>
                  <X aria-hidden="true" size={18} />
                </button>
                <GuestTicketContactPanel
                  contact={guestTicketContact}
                  disabled={isBookingTickets}
                  estimatedLoyaltyPointsEarned={estimatedLoyaltyPointsEarned}
                  onChange={onGuestTicketContactChange}
                  onPromptLogin={() => {
                    setGuestTicketContactOpen(false)
                    onPromptLogin()
                  }}
                  text={text}
                />
                {ticketStatus && <p className="notice">{ticketStatus}</p>}
                <div className="guest-ticket-actions">
                  <button
                    className={isBookingTickets && guestTicketAction === 'create-account' ? 'primary create-button loading' : 'primary create-button'}
                    disabled={isBookingTickets}
                    type="button"
                    onClick={() => void handleGuestTicketAction('create-account')}
                  >
                    {isBookingTickets && guestTicketAction === 'create-account' ? text.bookingTickets : text.guestTicketCreateAccountCta}
                  </button>
                  <button
                    className={isBookingTickets && guestTicketAction === 'guest' ? 'secondary create-button loading' : 'secondary create-button'}
                    disabled={isBookingTickets}
                    type="button"
                    onClick={() => void handleGuestTicketAction('guest')}
                  >
                    {isBookingTickets && guestTicketAction === 'guest' ? text.bookingTickets : text.guestTicketBookWithoutAccountCta}
                  </button>
                </div>
              </div>
            </div>
          )}

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
                  <button className="secondary small-button" type="button" onClick={onPromptLogin}>
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
