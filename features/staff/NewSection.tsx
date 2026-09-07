'use client'

import {
  CalendarDays,
  Plus,
  Trash2
} from 'lucide-react'
import { PhoneNumberInput } from '../../components/CountryCodePicker'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { bookingDurationCopy } from '../../lib/bookingDurationCopy'
import { uiText } from '../../lib/i18n/translations'
import { staffBookingHours, validStaffBookingTime } from '../../lib/staff/bookingHours'
import { staffBookingCopy } from '../../lib/staff/bookingCopy'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  shortDateLabel,
  todayString
} from '../../lib/staff/dates'
import {
  dongDigits,
  formatDongInput,
  formatVnd
} from '../../lib/staff/formatting'
import {
  orderStatuses,
  paymentMethods
} from '../../lib/staff/options'
import { paymentStatusFromAmount, paymentStatusLabel } from '../../lib/staff/payments'
import {
  formatDiscountRuleValue,
  isStaffGroupDiscount,
  validBookingTotalOverride
} from '../../lib/staff/pricing'
import {
  customerName
} from '../../lib/staff/profiles'
import type {
  BookingForm,
  StaffConsoleLanguage,
  StaffPaymentMethod
} from '../../lib/staff/types'
import { ButtonIconText } from './shared'

export type NewSectionProps = {
  text: StaffConsoleCopy
  booking: import("../../lib/staff/types").BookingForm
  onOpenSessionCalendar: ((dateValue: string, venueKey?: "ha-do-centrosa" | "cafe-des-stagiaires" | undefined) => void) | undefined
  setOperationsDate: React.Dispatch<React.SetStateAction<string>>
  setActiveTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffTab>>
  canCreateOrders: boolean
  saving: boolean
  bookingText: (typeof staffBookingCopy)["en" | "vi"]
  setBooking: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").BookingForm>>
  setGuestBooking: (enabled: boolean) => void
  setCustomerNameFocused: React.Dispatch<React.SetStateAction<boolean>>
  showCustomerNameSuggestions: boolean
  customerSuggestionIndex: number
  handleCustomerNameChange: (value: string) => void
  setCustomerSuggestionIndex: React.Dispatch<React.SetStateAction<number>>
  visibleCustomerSuggestions: import("../../lib/staff/types").StaffProfile[]
  canOfferNewCustomer: boolean
  selectCustomerSuggestion: (profileId: string) => void
  sharedText: (typeof uiText)[StaffConsoleLanguage]
  bookingGames: import("../../lib/staff/types").StaffGame[]
  selectedGame: import("../../lib/staff/types").StaffGame
  bookingDateInputRef: React.RefObject<HTMLInputElement | null>
  selectedBookingArena: string
  bookingArenas: string[]
  selectedDiscount: import("../../lib/staff/types").StaffDiscount | null
  availableBookingDiscounts: import("../../lib/staff/types").StaffDiscount[]
  addBookingPaymentSplit: () => void
  updateBookingPaymentSplit: (splitId: string, patch: Partial<import("../../lib/staff/types").PaymentSplitDraft>) => void
  removeBookingPaymentSplit: (splitId: string) => void
  bookingPaidTotal: number
  bookingRemainingTotal: number
  quote: { unitPrice: number; subtotal: number; discountTotal: number; discountLabel: string; total: number; ruleName: string; duration: number }
  bookingVenueName: "VRena Hà Đô Centrosa" | "VRena Café des Stagiaires"
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  status: string
  createOrder: () => Promise<void>
}

export default function NewSection({
  text,
  booking,
  onOpenSessionCalendar,
  setOperationsDate,
  setActiveTab,
  canCreateOrders,
  saving,
  bookingText,
  setBooking,
  setGuestBooking,
  setCustomerNameFocused,
  showCustomerNameSuggestions,
  customerSuggestionIndex,
  handleCustomerNameChange,
  setCustomerSuggestionIndex,
  visibleCustomerSuggestions,
  canOfferNewCustomer,
  selectCustomerSuggestion,
  sharedText,
  bookingGames,
  selectedGame,
  bookingDateInputRef,
  selectedBookingArena,
  bookingArenas,
  selectedDiscount,
  availableBookingDiscounts,
  addBookingPaymentSplit,
  updateBookingPaymentSplit,
  removeBookingPaymentSplit,
  bookingPaidTotal,
  bookingRemainingTotal,
  quote,
  bookingVenueName,
  resolvedLanguage,
  status,
  createOrder,
}: NewSectionProps) {
  const hours = staffBookingHours(booking.venueKey, quote.duration)
  const validTime = validStaffBookingTime(booking.venueKey, quote.duration, booking.time)
  return (
    <div className="staff-grid">
      <div className="staff-card staff-card-wide">
        <div className="staff-card-heading">
          <h3>{text.labels.newBooking}</h3>
          <button
            aria-label={text.aria.openSessionCalendar}
            className="staff-calendar-shortcut"
            type="button"
            onClick={() => {
              const targetDate = booking.date || todayString()
              if (onOpenSessionCalendar) {
                onOpenSessionCalendar(targetDate, booking.venueKey)
                return
              }
              setOperationsDate(targetDate)
              setActiveTab('today')
            }}
          >
            <ButtonIconText icon={<CalendarDays aria-hidden="true" size={15} />}>{text.actions.calendar}</ButtonIconText>
          </button>
        </div>
        {!canCreateOrders && <p className="staff-readonly-note">{text.messages.readOnlyBooking}</p>}
        <fieldset className="staff-readonly-fieldset" disabled={!canCreateOrders || saving}>
          <div className="form-grid compact-form-grid">
            <label>
              {bookingText.bookingSource}
              <select value={booking.bookingSource} onChange={(event) => setBooking((current) => ({ ...current, bookingSource: event.target.value as BookingForm['bookingSource'] }))}>
                {Object.entries(bookingText.sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              {bookingText.shop}
              <select value={booking.venueKey} onChange={(event) => setBooking((current) => ({
                ...current,
                venueKey: event.target.value as BookingForm['venueKey'],
                gameId: '', arenaId: '', discountId: '',
                time: event.target.value === 'cafe-des-stagiaires' && current.time < '16:00' ? '16:00' : current.time,
              }))}>
                <option value="ha-do-centrosa">VRena Hà Đô Centrosa</option>
                <option value="cafe-des-stagiaires">VRena Café des Stagiaires</option>
              </select>
            </label>
            <label className="full staff-guest-toggle">
              <input type="checkbox" checked={booking.guestBooking} onChange={(event) => setGuestBooking(event.target.checked)} />
              <span>{text.labels.guestBooking}</span>
            </label>
            {booking.guestBooking && <p className="field-help full">{text.messages.guestBookingHelp}</p>}
            {!booking.guestBooking && <>
              <div
                className="staff-customer-name-field full"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setCustomerNameFocused(false)
                }}
                onFocus={() => setCustomerNameFocused(true)}
              >
                <label htmlFor="staff-booking-customer-name">{text.labels.customerName}</label>
                <input
                  id="staff-booking-customer-name"
                  maxLength={120}
                  autoComplete="off"
                  placeholder={bookingText.searchCustomer}
                  aria-activedescendant={showCustomerNameSuggestions && customerSuggestionIndex >= 0 ? `staff-customer-option-${customerSuggestionIndex}` : undefined}
                  aria-autocomplete="list"
                  aria-controls={!booking.guestBooking && showCustomerNameSuggestions ? 'staff-customer-name-suggestions' : undefined}
                  aria-expanded={!booking.guestBooking && showCustomerNameSuggestions}
                  disabled={booking.guestBooking}
                  role="combobox"
                  value={booking.customerName}
                  onChange={(event) => handleCustomerNameChange(event.target.value)}
                  onClick={() => setCustomerNameFocused(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') { setCustomerNameFocused(false); setCustomerSuggestionIndex(-1) }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      setCustomerNameFocused(true)
                      const count = visibleCustomerSuggestions.length + (canOfferNewCustomer ? 1 : 0)
                      setCustomerSuggestionIndex((current) => count ? (current + (event.key === 'ArrowDown' ? 1 : -1) + count) % count : -1)
                    }
                    if (event.key === 'Enter' && showCustomerNameSuggestions && customerSuggestionIndex >= 0) {
                      event.preventDefault()
                      const match = visibleCustomerSuggestions[customerSuggestionIndex]
                      if (match) selectCustomerSuggestion(match.id)
                      else setCustomerNameFocused(false)
                    }
                  }}
                />
                {showCustomerNameSuggestions && (
                  <div className="staff-customer-suggestions" id="staff-customer-name-suggestions" role="listbox">
                    {visibleCustomerSuggestions.map((item, index) => (
                      <button
                        id={`staff-customer-option-${index}`}
                        aria-selected={customerSuggestionIndex === index || booking.customerId === item.id}
                        className="staff-customer-suggestion"
                        key={item.id}
                        role="option"
                        type="button"
                        onClick={() => selectCustomerSuggestion(item.id)}
                      >
                        <span>{customerName(item, text)}</span>
                        <small>{[item.phone, item.email].filter(Boolean).join(' · ') || text.noContact}</small>
                      </button>
                    ))}
                    {canOfferNewCustomer && <button
                      id={`staff-customer-option-${visibleCustomerSuggestions.length}`}
                      className="staff-customer-suggestion"
                      role="option"
                      aria-selected={customerSuggestionIndex === visibleCustomerSuggestions.length}
                      type="button"
                      onClick={() => { setCustomerNameFocused(false); setCustomerSuggestionIndex(-1) }}
                    >
                      <span>+ {bookingText.createProfile.replace('{name}', booking.customerName.trim())}</span>
                      <small>{bookingText.createWithBooking}</small>
                    </button>}
                    {!visibleCustomerSuggestions.length && !canOfferNewCustomer && <p className="field-help">{bookingText.searchCustomer}</p>}
                  </div>
                )}
              </div>
              <p className="field-help full">{booking.customerId ? bookingText.profileSelected : bookingText.createWithBooking}</p>
              <label>
                {text.labels.phone}
                <PhoneNumberInput
                  buttonLabel={sharedText.countryCode}
                  className="staff-phone-control"
                  disabled={booking.guestBooking}
                  inputLabel={text.labels.phone}
                  onChange={(phone) => setBooking({ ...booking, customerPhone: phone })}
                  searchPlaceholder={sharedText.searchCountry}
                  value={booking.customerPhone}
                />
              </label>
              <label>
                {text.labels.email}
                <input type="email" autoComplete="off" disabled={booking.guestBooking} value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
              </label>
            </>}
            <label>
              {text.labels.game}
              <select disabled={!bookingGames.length} value={selectedGame?.id || ''} onChange={(event) => setBooking({ ...booking, gameId: event.target.value, arenaId: '', discountId: '' })}>
                {!bookingGames.length && <option value="">{bookingText.noGames}</option>}
                {bookingGames.map((game) => (
                  <option key={game.id} value={game.id}>{game.name}</option>
                ))}
              </select>
            </label>
            <label>
              {text.labels.date}
              <StaffPickerField ariaLabel={text.aria.bookingDate} inputRef={bookingDateInputRef} placeholder={text.chooseDate} type="date" value={booking.date} onChange={(value) => setBooking({ ...booking, date: value })} />
            </label>
            <label>
              {text.labels.time}
              <StaffPickerField ariaLabel={text.aria.bookingTime} placeholder={text.chooseTime} minTime={hours.min} maxTime={hours.max} type="time" value={booking.time} onChange={(value) => setBooking({ ...booking, time: value })} />
            </label>
            <label>
              {text.labels.players}
              <input min={1} max={16} type="number" value={booking.players} onChange={(event) => setBooking({ ...booking, players: Number(event.target.value) })} />
            </label>
            <p className="field-help full">{bookingText.openingHours}: {hours.min}–{hours.close} · {bookingText.latestStart}: {hours.max}</p>
            {!validTime && <p className="notice full" role="alert">{bookingText.outsideHours}</p>}
            <label>
              {text.labels.arena}
              <select value={selectedBookingArena} onChange={(event) => setBooking({ ...booking, arenaId: event.target.value })}>
                {bookingArenas.map((arena, index) => (
                  <option key={arena} value={arena}>{text.labels.arena} {index + 1}</option>
                ))}
              </select>
            </label>
            <label>
              {text.labels.discountVoucher}
              <select
                value={booking.discountId}
                onChange={(event) => setBooking({
                  ...booking,
                  discountId: event.target.value,
                  manualDiscountType: '',
                  manualDiscountValue: 0,
                })}
              >
                <option value="">{bookingText.automaticDiscount}</option>
                {booking.discountId && !selectedDiscount && <option value={booking.discountId}>{bookingText.discountChanged}</option>}
                {availableBookingDiscounts.filter((discount) => !isStaffGroupDiscount(discount)).map((discount) => (
                  <option key={discount.id} value={discount.id}>{discount.code ? `${discount.code} · ` : ''}{discount.name} · {formatDiscountRuleValue(discount, text)}</option>
                ))}
              </select>
            </label>
            <p className="field-help full">{bookingText.groupDiscountHelp}</p>
            <div className="staff-manual-discount full">
              <span className="staff-field-label">{text.labels.uniqueDiscount}</span>
              <div>
                <select
                  aria-label={text.labels.uniqueDiscount}
                  value={booking.manualDiscountType}
                  onChange={(event) => setBooking({
                    ...booking,
                    discountId: '',
                    manualDiscountType: event.target.value as BookingForm['manualDiscountType'],
                    manualDiscountValue: event.target.value ? booking.manualDiscountValue : 0,
                  })}
                >
                  <option value="">{text.noUniqueDiscount}</option>
                  <option value="fixed_amount">{text.vndAmount}</option>
                  <option value="percentage">{text.discountTypes.percentage}</option>
                </select>
                <input
                  aria-label={bookingText.discountValue}
                  disabled={!booking.manualDiscountType}
                  min={0}
                  max={booking.manualDiscountType === 'percentage' ? 100 : undefined}
                  placeholder={booking.manualDiscountType === 'percentage' ? '%' : 'VND'}
                  type="number"
                  value={booking.manualDiscountValue || ''}
                  onChange={(event) => setBooking({
                    ...booking,
                    discountId: '',
                    manualDiscountValue: Number(event.target.value),
                  })}
                />
              </div>
              <p className="field-help">{text.messages.uniqueDiscountHelp}</p>
            </div>
            <div className="staff-payment-splits full">
              <div className="staff-list-head">
                <h4>{text.labels.paymentSplits}</h4>
                <button className="staff-payment-add secondary" type="button" onClick={addBookingPaymentSplit}>
                  <ButtonIconText icon={<Plus aria-hidden="true" size={14} />}>{text.actions.addSplit}</ButtonIconText>
                </button>
              </div>
              <div className="staff-payment-split-list">
                {booking.paymentSplits.map((split, index) => (
                  <div className="staff-payment-split-row" key={split.id}>
                    <select
                      aria-label={text.aria.paymentMethod}
                      value={split.payment_method}
                      onChange={(event) => updateBookingPaymentSplit(split.id, { payment_method: event.target.value as StaffPaymentMethod })}
                    >
                      {paymentMethods.map((method) => <option key={method} value={method}>{text.paymentMethods[method]}</option>)}
                    </select>
                    <input
                      aria-label={text.aria.paymentAmount}
                      inputMode="numeric"
                      placeholder="0 đ"
                      value={formatDongInput(split.amount)}
                      onChange={(event) => updateBookingPaymentSplit(split.id, { amount: dongDigits(event.target.value) })}
                    />
                    <button className="staff-payment-remove" aria-label={`${bookingText.removeSplit} ${index + 1}`} title={bookingText.removeSplit} type="button" onClick={() => removeBookingPaymentSplit(split.id)}>
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="field-help">
                {text.labels.paid} {formatVnd(bookingPaidTotal)} · {text.labels.remaining} {formatVnd(bookingRemainingTotal)}
                {' · '}
                {text.labels.status} {paymentStatusLabel(paymentStatusFromAmount(quote.total, bookingPaidTotal), text)}
              </p>
            </div>
            <label>
              {text.labels.orderStatus}
              <select value={booking.orderStatus} onChange={(event) => setBooking({ ...booking, orderStatus: event.target.value as BookingForm['orderStatus'] })}>
                {orderStatuses.map((status) => <option key={status} value={status}>{text.orderStatuses[status]}</option>)}
              </select>
            </label>
          </div>
          <label className="staff-note-field">
            {text.labels.internalNote}
            <textarea value={booking.note} onChange={(event) => setBooking({ ...booking, note: event.target.value })} />
          </label>
        </fieldset>
      </div>

      <div className="staff-card staff-summary-card">
        <h3>{text.labels.summary}</h3>
        <p className="field-help">{bookingText.durationHelp}</p>
        <div className="staff-price-lines">
          <span>{bookingText.shop}</span><strong>{bookingVenueName}</strong>
          <span>{text.labels.game}</span><strong>{selectedGame?.name || bookingText.noGames}</strong>
          <span>{text.labels.date} / {text.labels.time}</span><strong>{shortDateLabel(booking.date)} · {booking.time}</strong>
          <span>{text.labels.players}</span><strong>{booking.players}</strong>
          <span>{text.labels.customer}</span><strong>{booking.guestBooking ? text.labels.guestBooking : booking.customerName || text.walkIn}</strong>
          <span>{text.labels.rule}</span><strong>{quote.ruleName}</strong>
          <span>{bookingDurationCopy[resolvedLanguage].game}</span><strong>{quote.duration} min</strong>
          <span>{text.labels.subtotal}</span><strong>{formatVnd(quote.subtotal)}</strong>
          <span>{text.labels.discountType}</span><strong>{quote.discountLabel}</strong>
          <span>{text.labels.discount}</span><strong>-{formatVnd(quote.discountTotal)}</strong>
          <span>{text.labels.total}</span><strong>{formatVnd(quote.total)}</strong>
        </div>
        <fieldset className="staff-total-override" disabled={!canCreateOrders || saving}>
          <label className="staff-override-toggle"><input type="checkbox" checked={booking.overrideTotalEnabled} onChange={(event) => setBooking({ ...booking, overrideTotalEnabled: event.target.checked, overrideTotal: event.target.checked ? String(quote.total) : '', overrideReason: event.target.checked ? booking.overrideReason : '' })} /><span>{bookingText.overrideTotal}</span></label>
          {booking.overrideTotalEnabled && <>
            <label>{bookingText.finalTotal}<input required min={0} max={2147483647} step={1} type="number" value={booking.overrideTotal} onChange={(event) => setBooking({ ...booking, overrideTotal: event.target.value })} /></label>
            <label>{bookingText.overrideReason}<textarea required value={booking.overrideReason} onChange={(event) => setBooking({ ...booking, overrideReason: event.target.value })} /></label>
            <p className="field-help">{bookingText.overrideHelp}</p>
          </>}
        </fieldset>
        {status && <p className="notice compact-notice" role="status">{status}</p>}
        <button className={saving ? 'primary create-button loading' : 'primary create-button'} disabled={!canCreateOrders || saving || !selectedGame || !validTime || !Number.isInteger(booking.players) || booking.players < 1 || booking.players > 16 || !validBookingTotalOverride(booking) || (!booking.guestBooking && !booking.customerName.trim())} type="button" onClick={createOrder}>
          {text.actions.confirmBooking}
        </button>
      </div>
    </div>
  )
}
