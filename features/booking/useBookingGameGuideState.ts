'use client'
import { useCallback } from 'react'
import { getSupabase } from '../../lib/booking/client'
import { games } from '../../lib/bookingStaticData'

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
  const staffGameGuidesLoadedRef = useRef(false)
  const staffGameGuidesLoadingRef = useRef(false)
  const [tariffPaymentOpen, setTariffPaymentOpen] = useState(false)
  const ensureStaffGameGuidesLoaded = useCallback(async () => {
    if (staffGameGuidesLoadedRef.current || staffGameGuidesLoadingRef.current) return

    staffGameGuidesLoadingRef.current = true
    const client = await getSupabase()
    const { data, error } = await client
      .from('staff_games')
      .select('slug, game_type, escape_chapter_count, guide_language, guide_summary, guide_rules, guide_tips')
      .eq('active', true)

    staffGameGuidesLoadingRef.current = false
    staffGameGuidesLoadedRef.current = true

    if (error || !data) return

    const knownGameIds = new Set(games.map((game) => game.id))
    const guidesByGame = ((data ?? []) as StaffGameGuide[]).reduce<Partial<Record<GameId, StaffGameGuide>>>((guides, guide) => {
      if (knownGameIds.has(guide.slug as GameId)) {
        guides[guide.slug as GameId] = guide
      }
      return guides
    }, {})

    setStaffGameGuides(guidesByGame)
  }, [staffGameGuidesLoadedRef, staffGameGuidesLoadingRef, setStaffGameGuides])
  return {
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
