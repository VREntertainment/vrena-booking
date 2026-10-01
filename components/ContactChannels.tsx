import Image from 'next/image'
import { venueContact, type ContactVenue } from '../lib/venueContacts'

type ContactChannelsProps = {
  className?: string
  label?: string
  venue?: ContactVenue
  showPhone?: boolean
  showNumbers?: boolean
}

export default function ContactChannels({ className, label, venue, showPhone = true, showNumbers = false }: ContactChannelsProps) {
  const venues: ContactVenue[] = venue ? [venue] : ['ha-do-centrosa', 'cafe-des-stagiaires']
  return (
    <div aria-label={label} className={`contact-channels${className ? ` ${className}` : ''}`}>
      {venues.map((key) => {
        const contact = venueContact(key)
        return <div className="contact-venue" key={key}>
          <small>{contact.name}</small>
          {showPhone && <a className="contact-venue-phone" href={contact.tel}>{contact.phone}</a>}
          <div className="contact-channel-buttons">
            {[
              { className: 'whatsapp', href: contact.whatsapp, label: 'WhatsApp', iconSrc: '/brand/whatsapp.svg' },
              { className: 'zalo', href: contact.zalo, label: 'Zalo', iconSrc: '/brand/zalo.svg' },
            ].map((channel) => <a aria-label={`${contact.name} ${channel.label} ${contact.phone}`} className={`contact-channel ${channel.className}`} href={channel.href} key={channel.label} rel="noreferrer" target="_blank">
              <Image aria-hidden="true" alt="" height={18} src={channel.iconSrc} width={18} />
              <span>{channel.label}{showNumbers && <small>{channel.className === 'whatsapp' ? `+${contact.international}` : contact.phone}</small>}</span>
            </a>)}
          </div>
        </div>
      })}
    </div>
  )
}
