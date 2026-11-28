'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import TournamentWorkspace from './TournamentWorkspace'
import type { TournamentGateway } from './data'

const gateway: TournamentGateway = {
  async list() {
    const { data, error } = await supabase.rpc('staff_team_tournament_list')
    if (error) throw new Error(error.message)
    return data
  },
  async detail(id) {
    const { data, error } = await supabase.rpc('staff_team_tournament_detail', { p_id: id })
    if (error) throw new Error(error.message)
    return data
  },
  async write(id, version, command) {
    const { data, error } = await supabase.rpc('staff_team_tournament_write', { p_id: id, p_version: version, p_payload: command })
    if (error) throw new Error(error.message)
    return data
  },
}

export default function StaffTournaments({ language, rank }: { language: 'en' | 'vi'; rank: number }) {
  const [requested, setRequested] = useState<{ id: string | null }>({ id: null })
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('tournament_tv')
    if (id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      const frame = requestAnimationFrame(() => setRequested({ id }))
      return () => cancelAnimationFrame(frame)
    }
  }, [])
  return <TournamentWorkspace key={requested.id ?? 'staff'} gateway={gateway} language={language}
    manager={rank >= 80} canOperate={rank >= 50} initialId={requested.id} initialTV={Boolean(requested.id)} />
}
