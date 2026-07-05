import type { AppView } from '../components/AppSidebar'

export const publicAppRoutes = {
  sessions: '/sessions',
  tickets: '/tickets',
  create: '/create-session',
  leaderboard: '/hall-of-fame',
  clubs: '/clubs',
  profile: '/profile',
  staff: '/staff',
} satisfies Record<AppView, string>

export const indexableAppViews: AppView[] = ['sessions', 'tickets', 'leaderboard', 'clubs']

export function appRouteForView(view: AppView) {
  return publicAppRoutes[view]
}
