'use client'

import { useState } from 'react'
import { MapPin, ArrowUpRight } from 'lucide-react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type BookingVenueId = 'ha-do-centrosa' | 'cafe-des-stagiaires'

type BookingVenueSelectorProps = {
  allowedVenueKeys?: string[]
  onChange: (venue: BookingVenueId) => void
  text: TranslationMap
  value: BookingVenueId
}

const venueMaps: Record<BookingVenueId, { directionsUrl: string }> = {
  'ha-do-centrosa': {
    directionsUrl: 'https://www.google.com/maps/search/?api=1&query=10.77476%2C106.67843',
  },
  'cafe-des-stagiaires': {
    directionsUrl: 'https://www.google.com/maps/search/?api=1&query=10.80107%2C106.72906',
  },
}

function VenueMapPreview({ name, venue }: {
  name: string
  venue: BookingVenueId
}) {
  const { directionsUrl } = venueMaps[venue]

  return (
    <a
      aria-label={`${name} · Google Maps`}
      className="booking-venue-map"
      href={directionsUrl}
      rel="noopener noreferrer"
      target="_blank"
      title={`${name} · Google Maps`}
    >
      <MapPin size={28} aria-hidden="true" />
      <ArrowUpRight className="booking-venue-map-external" size={13} aria-hidden="true" />
    </a>
  )
}

function VenueHoursPill({ label }: { label: string }) {
  const [opening, hours] = label.split(' · ')
  return (
    <span className="booking-venue-status open">
      <span>{opening}</span>
      {hours && <span className="booking-venue-hours-time">· {hours}</span>}
    </span>
  )
}

export default function BookingVenueSelector({ allowedVenueKeys, onChange, text, value }: BookingVenueSelectorProps) {
  const [expanded, setExpanded] = useState(false)
  const venueName = value === 'ha-do-centrosa' ? text.bookingVenueHaDoName : text.bookingVenueCafeName
  const selectVenue = (venue: BookingVenueId) => {
    onChange(venue)
    setExpanded(false)
  }
  return (
    <section className={`booking-venue-selector booking-venue-selector-compact${expanded ? ' expanded' : ''}`} aria-label={text.bookingVenueTitle}>
      <div className="booking-venue-mobile-summary">
        <div><strong>{venueName}</strong></div>
        <button aria-controls="booking-venue-expanded-options" aria-expanded={expanded} className="secondary small-button" type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? text.close : text.bookingVenueChange}
        </button>
      </div>
      <div className="booking-venue-expanded-content" id="booking-venue-expanded-options">
        <div className="booking-venue-heading">
          <h2 id="booking-venue-title">{text.bookingVenueTitle}</h2>
        </div>

        <div className="booking-venue-options" role="radiogroup" aria-label={text.bookingVenueTitle}>
          <div className="booking-venue-option-shell">
            <button
              disabled={allowedVenueKeys !== undefined && !allowedVenueKeys.includes('ha-do-centrosa')}
              aria-checked={value === 'ha-do-centrosa'}
              className={value === 'ha-do-centrosa' ? 'booking-venue-option active' : 'booking-venue-option'}
              onClick={() => selectVenue('ha-do-centrosa')}
              role="radio"
              type="button"
            >
              <span className="booking-venue-map-placeholder" aria-hidden="true" />
              <span className="booking-venue-copy">
                <strong>{text.bookingVenueHaDoName}</strong>
                <VenueHoursPill label={text.bookingVenueHaDoHours} />
                <small>{text.bookingVenueHaDoAddress}</small>
              </span>
            </button>
            <VenueMapPreview
              name={text.bookingVenueHaDoName}
              venue="ha-do-centrosa"
            />
          </div>

          <div className="booking-venue-option-shell">
            <button
              disabled={allowedVenueKeys !== undefined && !allowedVenueKeys.includes('cafe-des-stagiaires')}
              aria-checked={value === 'cafe-des-stagiaires'}
              className={value === 'cafe-des-stagiaires' ? 'booking-venue-option active' : 'booking-venue-option'}
              onClick={() => selectVenue('cafe-des-stagiaires')}
              role="radio"
              type="button"
            >
              <span className="booking-venue-map-placeholder" aria-hidden="true" />
              <span className="booking-venue-copy">
                <strong>{text.bookingVenueCafeName}</strong>
                <VenueHoursPill label={text.bookingVenueCafeHours} />
                <small>{text.bookingVenueCafeAddress}</small>
              </span>
            </button>
            <VenueMapPreview
              name={text.bookingVenueCafeName}
              venue="cafe-des-stagiaires"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
