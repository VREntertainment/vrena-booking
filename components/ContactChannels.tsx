import Image from 'next/image'

export const VRENA_CONTACT_PHONE_DISPLAY = '0981152315'
export const VRENA_CONTACT_PHONE_INTERNATIONAL = '84981152315'

const CONTACT_CHANNELS = [
  {
    className: 'whatsapp',
    href: `https://wa.me/${VRENA_CONTACT_PHONE_INTERNATIONAL}`,
    iconSrc: '/brand/whatsapp.svg',
    label: 'WhatsApp',
  },
  {
    className: 'zalo',
    href: `https://zalo.me/${VRENA_CONTACT_PHONE_INTERNATIONAL}`,
    iconSrc: '/brand/zalo.svg',
    label: 'Zalo',
  },
] as const

type ContactChannelsProps = {
  className?: string
  label?: string
}

export default function ContactChannels({ className, label }: ContactChannelsProps) {
  const rootClassName = className ? `contact-channels ${className}` : 'contact-channels'

  return (
    <div aria-label={label} className={rootClassName}>
      <div className="contact-channel-buttons">
        {CONTACT_CHANNELS.map((channel) => (
          <a
            aria-label={`${channel.label} ${VRENA_CONTACT_PHONE_DISPLAY}`}
            className={`contact-channel ${channel.className}`}
            href={channel.href}
            key={channel.label}
            rel="noreferrer"
            target="_blank"
          >
            <Image aria-hidden="true" alt="" height={18} src={channel.iconSrc} width={18} />
            <span>{channel.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
