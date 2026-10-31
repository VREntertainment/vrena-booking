import type { MetadataRoute } from 'next'
import { indexableAppViews, publicAppRoutes } from '../lib/appRoutes'
import { languageOptions } from '../lib/i18n/languages'
import { absoluteSiteUrl } from '../lib/siteMetadata'

const indexedPaths = [
  '/',
  ...indexableAppViews.map(view => publicAppRoutes[view]),
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
