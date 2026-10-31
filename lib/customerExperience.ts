import type { AppView } from '../components/AppSidebar'

// Pause customer social surfaces without deleting their data or implementation.
export const CUSTOMER_SOCIAL_FEATURES_ENABLED: boolean = false

export function customerView(view: AppView): AppView {
  return !CUSTOMER_SOCIAL_FEATURES_ENABLED && ['sessions', 'leaderboard', 'clubs'].includes(view)
    ? 'tickets'
    : view
}
