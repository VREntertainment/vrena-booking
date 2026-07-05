export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vrena-booking.vercel.app').replace(/\/$/, '')

export function absoluteSiteUrl(path = '/') {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}
