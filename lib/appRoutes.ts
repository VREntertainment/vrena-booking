import { CUSTOMER_SOCIAL_FEATURES_ENABLED } from './customerExperience'
import type { AppView } from '../components/AppSidebar'

export const publicAppRoutes = {
  sessions: '/sessions',
  tickets: '/tickets',
  create: '/create-session',
  leaderboard: '/hall-of-fame',
  clubs: '/clubs',
  profile: '/profile',
  hr: '/hr',
  staff: '/staff',
} satisfies Record<AppView, string>

export const indexableAppViews: AppView[] = CUSTOMER_SOCIAL_FEATURES_ENABLED ? ['sessions', 'tickets', 'leaderboard', 'clubs'] : ['tickets']

export function appRouteForView(view: AppView) {
  return publicAppRoutes[view]
}
