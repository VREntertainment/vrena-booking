export const venueContacts = {
  'ha-do-centrosa': { name: 'VRena Hà Đô Centrosa', phone: '0981152315', international: '84981152315' },
  'cafe-des-stagiaires': { name: 'VRena Thảo Điền', phone: '0981157039', international: '84981157039' },
} as const

export type ContactVenue = keyof typeof venueContacts

export function venueContact(venue: ContactVenue) {
  const contact = venueContacts[venue]
  return { ...contact, tel: `tel:+${contact.international}`, zalo: `https://zalo.me/${contact.international}`, whatsapp: `https://wa.me/${contact.international}` }
}
