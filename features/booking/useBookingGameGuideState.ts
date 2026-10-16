'use client'
import { useCallback } from 'react'
import { getSupabase } from '../../lib/booking/client'
import { mergeStaffGameCatalog, type PublicGameGuideGame, type StaffGameGuide as CatalogGuide } from '../../lib/gameGuideCatalog'

import {
  useRef,
  useState
} from 'react'
import {
  type GameId
} from '../../lib/bookingStaticData'
import {
  StaffGameGuide
} from '../../lib/bookingWidgetDomain'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingGameGuideState() {
  const [gameGuideOpen, setGameGuideOpen] = useState(false)
  const [gameGuideGameId, setGameGuideGameId] = useState<GameId | null>(null)
  const [staffGameGuides, setStaffGameGuides] = useState<Partial<Record<GameId, StaffGameGuide>>>({})
  const [gameGuideCatalog, setGameGuideCatalog] = useState<PublicGameGuideGame[]>([])
  const [gameGuideLoading, setGameGuideLoading] = useState(false)
  const [gameGuideLoadError, setGameGuideLoadError] = useState(false)
  const staffGameGuidesLoadedRef = useRef(false)
  const staffGameGuidesLoadingRef = useRef(false)
  const [tariffPaymentOpen, setTariffPaymentOpen] = useState(false)
  const ensureStaffGameGuidesLoaded = useCallback(async () => {
    if (staffGameGuidesLoadedRef.current || staffGameGuidesLoadingRef.current) return

    staffGameGuidesLoadingRef.current = true
    setGameGuideLoading(true)
    setGameGuideLoadError(false)
    try {
      const client = await getSupabase()
      const { data, error } = await client
        .from('staff_games')
        .select('slug, active, name, game_type, duration_minutes, max_players_per_arena, image_url, difficulty, audience, escape_chapter_count, guide_language, guide_summary, guide_rules, guide_tips')
        .eq('active', true)
        .order('name')
      if (error || !data) throw new Error('Game catalog unavailable')
      const catalog = data as (CatalogGuide & StaffGameGuide)[]
      const guidesByGame = Object.fromEntries(catalog.map((guide) => [guide.slug, guide]))
      setStaffGameGuides(guidesByGame)
      setGameGuideCatalog(mergeStaffGameCatalog(catalog, process.env.NEXT_PUBLIC_SUPABASE_URL))
      staffGameGuidesLoadedRef.current = true
    } catch {
      setGameGuideLoadError(true)
    } finally {
      staffGameGuidesLoadingRef.current = false
      setGameGuideLoading(false)
    }
  }, [staffGameGuidesLoadedRef, staffGameGuidesLoadingRef, setStaffGameGuides])
  return {
    gameGuideCatalog,
    gameGuideLoading,
    gameGuideLoadError,
    ensureStaffGameGuidesLoaded,
    gameGuideOpen,
    setGameGuideOpen,
    gameGuideGameId,
    setGameGuideGameId,
    staffGameGuides,
    setStaffGameGuides,
    staffGameGuidesLoadedRef,
    staffGameGuidesLoadingRef,
    tariffPaymentOpen,
    setTariffPaymentOpen,
  }
}
