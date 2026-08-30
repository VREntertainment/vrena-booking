import { CalendarClock, MapPin, MessageCircle } from 'lucide-react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import ContactChannels, { VRENA_ZALO_URL } from './ContactChannels'

export type BookingVenueId = 'ha-do-centrosa' | 'cafe-des-stagiaires'

type BookingVenueSelectorProps = {
  onChange: (venue: BookingVenueId) => void
  text: TranslationMap
  value: BookingVenueId
}

type BookingVenueComingSoonProps = {
  text: TranslationMap
}

const venueMaps: Record<BookingVenueId, { directionsUrl: string; latitude: number; longitude: number }> = {
  'ha-do-centrosa': {
    directionsUrl: 'https://www.google.com/maps/search/?api=1&query=10.77476%2C106.67843',
    latitude: 10.77476,
    longitude: 106.67843,
  },
  'cafe-des-stagiaires': {
    directionsUrl: 'https://www.google.com/maps/search/?api=1&query=10.80107%2C106.72906',
    latitude: 10.80107,
    longitude: 106.72906,
  },
}

function VenueMapPreview({ name, venue }: {
  name: string
  venue: BookingVenueId
}) {
  const { directionsUrl, latitude, longitude } = venueMaps[venue]
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`

  return (
    <a
      aria-label={`${name} · Google Maps`}
      className="booking-venue-map"
      href={directionsUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      <iframe
        aria-hidden="true"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
        tabIndex={-1}
        title={`${name} — Google Maps`}
      />
    </a>
  )
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
        <div className="booking-venue-option-shell">
          <button
            aria-checked={value === 'ha-do-centrosa'}
            className={value === 'ha-do-centrosa' ? 'booking-venue-option active' : 'booking-venue-option'}
            onClick={() => onChange('ha-do-centrosa')}
            role="radio"
            type="button"
          >
            <span className="booking-venue-map-placeholder" aria-hidden="true" />
            <span className="booking-venue-copy">
              <strong>{text.bookingVenueHaDoName}</strong>
              <small>{text.bookingVenueHaDoAddress}</small>
            </span>
            <span className="booking-venue-status open">{text.bookingVenueOpenNow}</span>
          </button>
          <VenueMapPreview
            name={text.bookingVenueHaDoName}
            venue="ha-do-centrosa"
          />
        </div>

        <div className="booking-venue-option-shell">
          <button
            aria-checked={value === 'cafe-des-stagiaires'}
            className={value === 'cafe-des-stagiaires' ? 'booking-venue-option active' : 'booking-venue-option'}
            onClick={() => onChange('cafe-des-stagiaires')}
            role="radio"
            type="button"
          >
            <span className="booking-venue-map-placeholder" aria-hidden="true" />
            <span className="booking-venue-copy">
              <strong>{text.bookingVenueCafeName}</strong>
              <small>{text.bookingVenueCafeAddress}</small>
            </span>
            <span className="booking-venue-status soon">{text.bookingVenueComingSoon}</span>
          </button>
          <VenueMapPreview
            name={text.bookingVenueCafeName}
            venue="cafe-des-stagiaires"
          />
        </div>
      </div>
    </section>
  )
}

export function BookingVenueComingSoon({ text }: BookingVenueComingSoonProps) {
  return (
    <section className="section booking-venue-coming-soon" aria-labelledby="booking-venue-coming-soon-title">
      <div className="booking-venue-coming-soon-icon">
        <CalendarClock aria-hidden="true" size={30} />
      </div>
      <span className="booking-venue-status soon">{text.bookingVenueComingSoon}</span>
      <h2 id="booking-venue-coming-soon-title">{text.bookingVenueCafeComingSoonTitle}</h2>
      <p>{text.bookingVenueCafeComingSoonBody}</p>
      <p className="booking-venue-soft-opening-notice">
        <span>{text.bookingVenueCafeSoftOpeningNotice}</span>
        <a href={VRENA_ZALO_URL} rel="noreferrer" target="_blank">
          <MessageCircle aria-hidden="true" size={16} />
          {text.bookingVenueCafeConfirmZalo}
        </a>
      </p>
      <small><MapPin aria-hidden="true" size={15} /> {text.bookingVenueCafeAddress}</small>
    </section>
  )
}

export function CafeSoftOpeningBookingNotice({ text }: { text: TranslationMap }) {
  return (
    <section className="cafe-booking-notice" aria-labelledby="cafe-booking-notice-title">
      <div className="cafe-booking-notice-icon">
        <MessageCircle aria-hidden="true" size={24} />
      </div>
      <span className="booking-venue-status soon">{text.bookingVenueComingSoon}</span>
      <h2 id="cafe-booking-notice-title">{text.bookingVenueCafeBookingNoticeTitle}</h2>
      <p>{text.bookingVenueCafeBookingNoticeBody}</p>
      <strong>{text.bookingVenueCafeBookingNoticeStatus}</strong>
      <small><CalendarClock aria-hidden="true" size={16} /> {text.bookingVenueCafeBookingHours}</small>
      <ContactChannels className="cafe-booking-contact-channels" label={text.contactUs} />
    </section>
  )
}
