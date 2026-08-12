import { CalendarClock, MapPin, Store } from 'lucide-react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type BookingVenueId = 'ha-do-centrosa' | 'cafe-des-stagiaires'

type BookingVenueSelectorProps = {
  onChange: (venue: BookingVenueId) => void
  text: TranslationMap
  value: BookingVenueId
}

type BookingVenueComingSoonProps = {
  onChooseHaDo: () => void
  text: TranslationMap
}

export default function BookingVenueSelector({ onChange, text, value }: BookingVenueSelectorProps) {
  return (
    <section className="booking-venue-selector" aria-labelledby="booking-venue-title">
      <div className="booking-venue-heading">
        <span>{text.bookingVenueLabel}</span>
        <h2 id="booking-venue-title">{text.bookingVenueTitle}</h2>
        <p>{text.bookingVenueHint}</p>
      </div>

      <div className="booking-venue-options" role="radiogroup" aria-label={text.bookingVenueTitle}>
        <button
          aria-checked={value === 'ha-do-centrosa'}
          className={value === 'ha-do-centrosa' ? 'booking-venue-option active' : 'booking-venue-option'}
          onClick={() => onChange('ha-do-centrosa')}
          role="radio"
          type="button"
        >
          <span className="booking-venue-icon"><MapPin aria-hidden="true" size={21} /></span>
          <span className="booking-venue-copy">
            <strong>{text.bookingVenueHaDoName}</strong>
            <small>{text.bookingVenueHaDoAddress}</small>
          </span>
          <span className="booking-venue-status open">{text.bookingVenueOpenNow}</span>
        </button>

        <button
          aria-checked={value === 'cafe-des-stagiaires'}
          className={value === 'cafe-des-stagiaires' ? 'booking-venue-option active' : 'booking-venue-option'}
          onClick={() => onChange('cafe-des-stagiaires')}
          role="radio"
          type="button"
        >
          <span className="booking-venue-icon"><Store aria-hidden="true" size={21} /></span>
          <span className="booking-venue-copy">
            <strong>{text.bookingVenueCafeName}</strong>
            <small>{text.bookingVenueCafeAddress}</small>
          </span>
          <span className="booking-venue-status soon">{text.bookingVenueComingSoon}</span>
        </button>
      </div>
    </section>
  )
}

export function BookingVenueComingSoon({ onChooseHaDo, text }: BookingVenueComingSoonProps) {
  return (
    <section className="section booking-venue-coming-soon" aria-labelledby="booking-venue-coming-soon-title">
      <div className="booking-venue-coming-soon-icon">
        <CalendarClock aria-hidden="true" size={30} />
      </div>
      <span className="booking-venue-status soon">{text.bookingVenueComingSoon}</span>
      <h2 id="booking-venue-coming-soon-title">{text.bookingVenueCafeComingSoonTitle}</h2>
      <p>{text.bookingVenueCafeComingSoonBody}</p>
      <small><MapPin aria-hidden="true" size={15} /> {text.bookingVenueCafeAddress}</small>
      <button className="primary" onClick={onChooseHaDo} type="button">
        {text.bookingVenueChooseHaDo}
      </button>
    </section>
  )
}
