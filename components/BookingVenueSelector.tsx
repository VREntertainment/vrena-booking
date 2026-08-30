import { CalendarClock, MapPin, MessageCircle, Store } from 'lucide-react'
import type { ReactNode } from 'react'
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

const venueMapCoordinates: Record<BookingVenueId, { latitude: number; longitude: number }> = {
  'ha-do-centrosa': { latitude: 10.77476, longitude: 106.67843 },
  'cafe-des-stagiaires': { latitude: 10.80107, longitude: 106.72906 },
}

function VenueMapPreview({ icon, name, venue }: {
  icon: ReactNode
  name: string
  venue: BookingVenueId
}) {
  const { latitude, longitude } = venueMapCoordinates[venue]
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`

  return (
    <span className="booking-venue-map" aria-hidden="true">
      <iframe
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
        tabIndex={-1}
        title={`${name} — Google Maps`}
      />
      <span className="booking-venue-icon">{icon}</span>
    </span>
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
        <button
          aria-checked={value === 'ha-do-centrosa'}
          className={value === 'ha-do-centrosa' ? 'booking-venue-option active' : 'booking-venue-option'}
          onClick={() => onChange('ha-do-centrosa')}
          role="radio"
          type="button"
        >
          <VenueMapPreview
            icon={<MapPin aria-hidden="true" size={17} />}
            name={text.bookingVenueHaDoName}
            venue="ha-do-centrosa"
          />
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
          <VenueMapPreview
            icon={<Store aria-hidden="true" size={17} />}
            name={text.bookingVenueCafeName}
            venue="cafe-des-stagiaires"
          />
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
