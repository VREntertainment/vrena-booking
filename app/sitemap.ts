import type { MetadataRoute } from 'next'
import { publicAppRoutes } from '../lib/appRoutes'
import { languageOptions } from '../lib/i18n/languages'
import { absoluteSiteUrl } from '../lib/siteMetadata'

const indexedPaths = [
  '/',
  publicAppRoutes.sessions,
  publicAppRoutes.tickets,
  publicAppRoutes.leaderboard,
  publicAppRoutes.clubs,
  '/games',
  ...languageOptions.map((language) => `/games/${language}`),
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return indexedPaths.map((path) => ({
    url: absoluteSiteUrl(path),
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'daily',
    priority: path === '/' ? 1 : path === publicAppRoutes.tickets ? 0.9 : 0.7,
  }))
}
