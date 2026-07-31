'use client'

import Image from 'next/image'
import { CalendarPlus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import ContactChannels from './ContactChannels'

function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
}

type LoginPromptModalProps = {
  closeText: string
  title: string
  message: string
  buttonText: string
  secondaryButtonText?: string
  onClose: () => void
  onLogin: () => void
  onSecondaryAction?: () => void
}

export function LoginPromptModal({
  closeText,
  title,
  message,
  buttonText,
  secondaryButtonText,
  onClose,
  onLogin,
  onSecondaryAction,
}: LoginPromptModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title">
      <div className="login-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <h3 id="login-prompt-title">{title}</h3>
        <p>{message}</p>
        <div className="login-prompt-actions">
          <button className="primary create-button" type="button" onClick={onLogin}>
            {buttonText}
          </button>
          {secondaryButtonText && onSecondaryAction && (
            <button className="secondary create-button" type="button" onClick={onSecondaryAction}>
              {secondaryButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type InvitePopupModalProps = {
  closeText: string
  title: string
  body: string
  sessionName: string
  sessionImage: string
  invitedText: string
  dateText: string
  timeText: string
  durationText: string
  openText: string
  calendarText: string
  onClose: () => void
  onOpen: () => void
  onCalendar: () => void
}

export function InvitePopupModal({
  closeText,
  title,
  body,
  sessionName,
  sessionImage,
  invitedText,
  dateText,
  timeText,
  durationText,
  openText,
  calendarText,
  onClose,
  onOpen,
  onCalendar,
}: InvitePopupModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="invite-popup-title">
      <div className="login-modal invite-popup">
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <h3 id="invite-popup-title">{title}</h3>
        <p>{body}</p>
        <div className="mini-session invite-session">
          <div className="mini-session-title mini-session-title-with-image">
            <Image className="mini-session-image" src={sessionImage} alt="" width={84} height={84} />
            <strong>{sessionName}</strong>
            <span className="pill ok">{invitedText}</span>
          </div>
          <div className="row-meta">
            <span>{dateText}</span>
            <span>{timeText}</span>
            <span>{durationText}</span>
          </div>
        </div>
        <div className="invite-popup-actions">
          <button className="primary create-button" type="button" onClick={onOpen}>
            {openText}
          </button>
          <button className="secondary create-button" type="button" onClick={onCalendar}>
            <ButtonIconText icon={<CalendarPlus aria-hidden="true" size={17} />}>{calendarText}</ButtonIconText>
          </button>
        </div>
      </div>
    </div>
  )
}

type ChampionLoginModalProps = {
  closeText: string
  title: string
  message: string
  onClose: () => void
}

export function ChampionLoginModal({ closeText, title, message, onClose }: ChampionLoginModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="champion-title">
      <div className="login-modal champion-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <div className="champion-spark">👑</div>
        <h3 id="champion-title">{title}</h3>
        <p>{message}</p>
        <button className="primary" type="button" onClick={onClose}>
          {closeText}
        </button>
      </div>
    </div>
  )
}

type BirthdayPopupModalProps = {
  closeText: string
  title: string
  message: string
  buttonText: string
  onClose: () => void
  onAction?: () => void
}

export function BirthdayPopupModal({ closeText, title, message, buttonText, onClose, onAction }: BirthdayPopupModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="birthday-popup-title">
      <div className="login-modal birthday-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <div className="birthday-cake" aria-hidden="true">🎂</div>
        <h3 id="birthday-popup-title">{title}</h3>
        <p>{message}</p>
        <button className="primary" type="button" onClick={onAction || onClose}>
          {buttonText}
        </button>
      </div>
    </div>
  )
}

type TariffPaymentModalProps = {
  closeText: string
  title: string
  rates: string[]
  arenaText: string
  discounts: string[]
  offerLimit: string
  paymentText: string
  loyaltyTitle: string
  loyaltyText: string
  contactText: string
  disclaimer: string
  onClose: () => void
}

export function TariffPaymentModal({
  closeText,
  title,
  rates,
  arenaText,
  discounts,
  offerLimit,
  paymentText,
  loyaltyTitle,
  loyaltyText,
  contactText,
  disclaimer,
  onClose,
}: TariffPaymentModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tariff-payment-title">
      <div className="login-modal tariff-payment-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <h3 id="tariff-payment-title">{title}</h3>
        <div className="tariff-payment-scroll">
          <div className="tariff-payment-section">
            {rates.map((rate) => (
              <p key={rate}>{rate}</p>
            ))}
          </div>
          <div className="tariff-payment-section">
            <p>{arenaText}</p>
          </div>
          <div className="tariff-payment-section">
            {discounts.map((discount) => (
              <p key={discount}>{discount}</p>
            ))}
          </div>
          <div className="tariff-payment-section">
            <p>{offerLimit}</p>
            <p>{paymentText}</p>
            <ContactChannels className="tariff-contact-channels" label={contactText} />
          </div>
          <div className="tariff-payment-section tariff-loyalty-section">
            <h4>{loyaltyTitle}</h4>
            <p>{loyaltyText}</p>
          </div>
          <div className="tariff-payment-disclaimer">
            <p>{disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

type CheckInModalProps = {
  closeText: string
  title: string
  playerName: string
  paymentSplits: Array<{ id: string; payment_method: 'cash' | 'bank_transfer'; amount: string }>
  paymentSummary: string
  cashText: string
  bankTransferText: string
  freeText: string
  amountText: string
  addSplitText: string
  removeText: string
  saveText: string
  clearText: string
  checkedIn: boolean
  onClose: () => void
  onPaymentSplitMethodChange: (splitId: string, value: 'cash' | 'bank_transfer') => void
  onPaymentSplitAmountChange: (splitId: string, value: string) => void
  onAddPaymentSplit: () => void
  onRemovePaymentSplit: (splitId: string) => void
  onSaveFree: () => void
  onSavePaid: () => void
  onClear: () => void
}

export function CheckInModal({
  closeText,
  title,
  playerName,
  paymentSplits,
  paymentSummary,
  cashText,
  bankTransferText,
  freeText,
  amountText,
  addSplitText,
  removeText,
  saveText,
  clearText,
  checkedIn,
  onClose,
  onPaymentSplitMethodChange,
  onPaymentSplitAmountChange,
  onAddPaymentSplit,
  onRemovePaymentSplit,
  onSaveFree,
  onSavePaid,
  onClear,
}: CheckInModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <div className="login-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <h3 id="checkin-title">{title}</h3>
        <p>{playerName}</p>
        <div className="payment-grid split-payment-grid">
          <div className="split-payment-head">
            <strong>{amountText}</strong>
            <button className="secondary" type="button" onClick={onAddPaymentSplit}>
              {addSplitText}
            </button>
          </div>
          {paymentSplits.map((split) => (
            <div className="payment-split-row" key={split.id}>
              <select
                aria-label={amountText}
                value={split.payment_method}
                onChange={(event) => onPaymentSplitMethodChange(split.id, event.target.value as 'cash' | 'bank_transfer')}
              >
                <option value="cash">{cashText}</option>
                <option value="bank_transfer">{bankTransferText}</option>
              </select>
              <label className="amount-field">
                <span>{amountText}</span>
                <div>
                  <input
                    inputMode="numeric"
                    value={split.amount}
                    onChange={(event) => onPaymentSplitAmountChange(split.id, event.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0"
                  />
                  <strong>đ</strong>
                </div>
              </label>
              <button className="secondary" type="button" onClick={() => onRemovePaymentSplit(split.id)}>
                {removeText}
              </button>
            </div>
          ))}
          <p className="field-help">{paymentSummary}</p>
          <button className="primary" type="button" onClick={onSavePaid}>
            {saveText}
          </button>
          <button className="secondary" type="button" onClick={onSaveFree}>
            {freeText}
          </button>
          {checkedIn && (
            <button className="danger" type="button" onClick={onClear}>
              {clearText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export type PlayerProfileModalProps = {
  closeText: string
  playerTitle: string
  avatar: ReactNode
  motto?: string | null
  isTopPlayer: boolean
  bestOverallText: string
  canFollow: boolean
  followBusy: boolean
  followText: string
  onFollow: () => void
  onClose: () => void
  stats: Array<{ key: string; value: ReactNode; className?: string }>
  scoreSummary: ReactNode
  challengeControls?: ReactNode
  gameStatsTitle: string
  gameStats: Array<{
    id: string
    image: string
    title: string
    stats: Array<{ key: string; label: string; value: ReactNode }>
  }>
  gameStatsLoading?: boolean
  previousGameText: string
  nextGameText: string
}

export function PlayerProfileModal({
  closeText,
  playerTitle,
  avatar,
  motto,
  isTopPlayer,
  bestOverallText,
  canFollow,
  followBusy,
  followText,
  onFollow,
  onClose,
  stats,
  scoreSummary,
  challengeControls,
  gameStatsTitle,
  gameStats,
  gameStatsLoading = false,
  previousGameText,
  nextGameText,
}: PlayerProfileModalProps) {
  const gameCarouselRef = useRef<HTMLDivElement | null>(null)

  function scrollGameCarousel(direction: -1 | 1) {
    const carousel = gameCarouselRef.current
    if (!carousel) return
    carousel.scrollBy({
      behavior: 'smooth',
      left: direction * Math.max(240, carousel.clientWidth * 0.72),
    })
  }

  return (
    <div className="club-drawer-backdrop player-profile-backdrop" role="dialog" aria-modal="true" aria-labelledby="player-profile-title" onClick={onClose}>
      <div className="player-profile-panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-handle" />
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          <X aria-hidden="true" size={20} />
        </button>
        <div className="player-profile-head">
          {avatar}
          <div>
            <h3 id="player-profile-title">{playerTitle}</h3>
            {motto && <p className="player-motto">{motto}</p>}
            {isTopPlayer && <span className="pill ok">{bestOverallText}</span>}
            {canFollow && (
              <button className="secondary small-button follow-button" disabled={followBusy} type="button" onClick={onFollow}>
                {followText}
              </button>
            )}
          </div>
        </div>
        <div className="stats">
          {stats.map((item) => (
            <span className={item.className ? `stat-card ${item.className}` : 'stat-card'} key={item.key}>{item.value}</span>
          ))}
        </div>
        {scoreSummary}
        {challengeControls}
        {gameStats.length > 0 && (
          <section className="player-game-carousel-section" aria-labelledby="player-game-carousel-title">
            <div className="player-game-carousel-heading">
              <strong id="player-game-carousel-title">{gameStatsTitle}</strong>
              <div className="player-game-carousel-actions">
                <button aria-controls="player-game-carousel" aria-label={previousGameText} type="button" onClick={() => scrollGameCarousel(-1)}>
                  <ChevronLeft aria-hidden="true" size={18} />
                </button>
                <button aria-controls="player-game-carousel" aria-label={nextGameText} type="button" onClick={() => scrollGameCarousel(1)}>
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              </div>
            </div>
            <div
              aria-busy={gameStatsLoading}
              aria-label={gameStatsTitle}
              className="player-game-carousel"
              id="player-game-carousel"
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                scrollGameCarousel(event.key === 'ArrowLeft' ? -1 : 1)
              }}
              ref={gameCarouselRef}
              role="list"
              tabIndex={0}
            >
              {gameStats.map((game) => (
                <article className="player-game-stat-card" key={game.id} role="listitem">
                  <header className="player-game-stat-head">
                    <Image
                      alt=""
                      className="player-game-stat-poster"
                      height={76}
                      loading="lazy"
                      src={game.image}
                      width={76}
                    />
                    <h4>{game.title}</h4>
                  </header>
                  <dl className="player-game-stat-grid">
                    {game.stats.map((stat) => (
                      <div key={stat.key}>
                        <dt>{stat.label}</dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
