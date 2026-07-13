export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vrena-booking.vercel.app').replace(/\/$/, '')
export const vrenaGalleryUrl = 'https://www.vre-vietnam.com/th-vin-nh'

export function absoluteSiteUrl(path = '/') {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}
