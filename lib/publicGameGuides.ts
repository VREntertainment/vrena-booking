import { unstable_cache } from 'next/cache'
import {
  PUBLIC_GAME_GUIDE_REVALIDATE_SECONDS,
  type StaffGameGuide,
} from './gameGuideCatalog'

const STAFF_GAME_GUIDE_SELECT = [
  'slug',
  'name',
  'game_type',
  'duration_minutes',
  'max_players_per_arena',
  'image_url',
  'difficulty',
  'audience',
  'guide_language',
  'guide_summary',
  'guide_rules',
  'guide_tips',
].join(',')

const LEGACY_STAFF_GAME_GUIDE_SELECT = [
  'slug',
  'name',
  'game_type',
  'duration_minutes',
  'max_players_per_arena',
  'image_url',
  'difficulty',
  'guide_language',
  'guide_summary',
  'guide_rules',
  'guide_tips',
].join(',')

async function fetchStaffGames(select: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return []

  const url = new URL('/rest/v1/staff_games', supabaseUrl)
  url.searchParams.set('select', select)
  url.searchParams.set('active', 'eq.true')
  url.searchParams.set('order', 'name.asc')

  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    next: {
      revalidate: PUBLIC_GAME_GUIDE_REVALIDATE_SECONDS,
      tags: ['public-game-guide'],
    },
  })

  if (!response.ok) {
    throw new Error(`Could not load public game guide: ${response.status}`)
  }

  const data = await response.json()
  return Array.isArray(data) ? (data as StaffGameGuide[]) : []
}

async function fetchPublicStaffGameGuides() {
  try {
    return await fetchStaffGames(STAFF_GAME_GUIDE_SELECT)
  } catch {
    try {
      return await fetchStaffGames(LEGACY_STAFF_GAME_GUIDE_SELECT)
    } catch {
      return []
    }
  }
}

export const getCachedPublicStaffGameGuides = unstable_cache(
  fetchPublicStaffGameGuides,
  ['public-staff-game-guides-v1'],
  {
    revalidate: PUBLIC_GAME_GUIDE_REVALIDATE_SECONDS,
    tags: ['public-game-guide'],
  }
)
