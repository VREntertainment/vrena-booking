'use client'

import { useEffect, useImperativeHandle, useState, type Ref } from 'react'
import { supabase } from '../../lib/supabase/client'
import { brandedGameName } from '../../lib/anvio'
import { gameAvailableAtVenue } from '../../lib/bookingMetadata'
import AnvioBadge from '../AnvioBadge'
import styles from './StaffGamesPlayed.module.css'

type Option = { id: string; parent_slug: string; title: string; kind: string }
type Saved = { game_ids: string[]; updated_at: string }
export type PlayedGamesDraft = {
  gameIds: string[]
  expectedUpdatedAt: string | null
  blocked: boolean
}

export default function StaffGamesPlayed({ sessionId, language = 'en', disabled = false, draftRef }: { sessionId: string; language?: string; disabled?: boolean; draftRef?: Ref<PlayedGamesDraft | null> }) {
  const vi = language === 'vi'
  const [options, setOptions] = useState<Option[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saved, setSaved] = useState<Saved | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [reload, setReload] = useState(0)
  const [venue, setVenue] = useState('')
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      const [catalog, record, booking] = await Promise.all([
        supabase.from('staff_playable_games').select('id,parent_slug,title,kind').order('title'),
        supabase.from('staff_session_games_played').select('game_ids,updated_at').eq('session_id', sessionId).maybeSingle(),
        supabase.from('sessions').select('venue_key').eq('id', sessionId).is('deleted_at', null).single(),
      ])
      if (cancelled) return
      setLoading(false)
      if (catalog.error || record.error || booking.error) { setError((catalog.error || record.error || booking.error)!.message); return }
      setVenue(booking.data.venue_key)
      setOptions(catalog.data || [])
      setSaved(record.data)
      setSelected(record.data?.game_ids || [])
      setConfirmed(Boolean(record.data))
    }
    void load()
    return () => { cancelled = true }
  }, [sessionId, reload])
  async function save() {
    if (saving || disabled || loading) return
    setSaving(true)
    setError('')
    const result = await supabase.rpc('staff_confirm_games_played', {
      p_session_id: sessionId, p_game_ids: selected, p_expected_updated_at: saved?.updated_at || null,
    })
    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    setSaved(result.data as Saved)
    setSelected((result.data as Saved).game_ids)
    setConfirmed(true)
  }
  const venueOptions = options.filter(item => gameAvailableAtVenue(item.parent_slug, venue))
  const unavailable = selected.filter(id => !venueOptions.some(item => item.id === id))
  useImperativeHandle<PlayedGamesDraft | null, PlayedGamesDraft | null>(draftRef, () => {
    const savedIds = saved?.game_ids ?? []
    if (savedIds.length === selected.length && selected.every(id => savedIds.includes(id))) return null
    return { gameIds: selected, expectedUpdatedAt: saved?.updated_at ?? null,
      blocked: loading || saving || Boolean(error) || unavailable.length > 0 }
  }, [error, loading, saved, saving, selected, unavailable.length])
  const parents = venueOptions.filter(item => item.kind === 'game')
  const visible = (item: Option, parent: Option) => `${parent.title} ${item.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())
  const toggle = (id: string) => { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); setConfirmed(false) }
  return <section className={styles.panel} aria-label={vi ? 'Trò chơi đã chơi' : 'Games played'}>
    <h4>{vi ? 'Trò chơi đã chơi' : 'Games played'}</h4>
    <p>{vi ? 'Chọn tất cả trò chơi, trò chơi nhỏ và chế độ khách đã chơi.' : 'Select every game, mini-game and mode the group played.'}</p>
    {loading ? <p role="status">{vi ? 'Đang tải…' : 'Loading…'}</p> : <>
      {saved && <p>{vi ? 'Đã lưu' : 'Saved'}: {saved.game_ids.length ? saved.game_ids.map(id => {
        const item = options.find(option => option.id === id)
        const parent = options.find(option => option.id === item?.parent_slug)
        return item ? `${item.kind === 'game' ? '' : `${parent?.title || item.parent_slug} — `}${brandedGameName(item.parent_slug, item.title)}` : id
      }).join('; ') : (vi ? 'Chưa có trò chơi' : 'No games recorded')}</p>}
      <input type="search" aria-label={vi ? 'Tìm trò chơi đã chơi' : 'Search games played'} placeholder={vi ? 'Tìm trò chơi hoặc chế độ' : 'Search games or modes'} value={query} onChange={event => setQuery(event.target.value)} />
      <div className={styles.catalog}>
        {parents.map(parent => {
          const children = venueOptions.filter(item => item.parent_slug === parent.id && item.id !== parent.id)
          if (![parent, ...children].some(item => visible(item, parent))) return null
          return <fieldset key={parent.id}><legend>{parent.title} <AnvioBadge gameId={parent.id} /></legend>
            {[parent, ...children].filter(item => visible(item, parent)).map(item => <label key={item.id} className={styles.choice}>
              <input type="checkbox" checked={selected.includes(item.id)} disabled={disabled || saving} onChange={() => toggle(item.id)} />
              <span>{item.title}{item.kind !== 'game' && <small> · {item.kind === 'mini-game' ? (vi ? 'Trò chơi nhỏ' : 'Mini-game') : item.kind === 'mode' ? (vi ? 'Chế độ' : 'Mode') : (vi ? 'Bản đồ' : 'Map')}</small>}</span>
            </label>)}
          </fieldset>
        })}
      </div>
      {unavailable.length > 0 && <p role="alert">{vi ? 'Lựa chọn cũ có trò chơi không có tại địa điểm này.' : 'The previous selection includes games unavailable at this venue.'} <button type="button" disabled={disabled || saving} onClick={() => { setSelected(current => current.filter(id => !unavailable.includes(id))); setConfirmed(false) }}>{vi ? 'Bỏ các trò chơi không có' : 'Remove unavailable games'}</button></p>}
      <p aria-live="polite">{selected.length} {vi ? 'mục đã chọn' : 'selected'}{confirmed ? (vi ? ' · Đã xác nhận' : ' · Confirmed') : ''}</p>
      <button type="button" disabled={disabled || saving || Boolean(error) || unavailable.length > 0} onClick={() => void save()}>{saving ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Xác nhận trò chơi đã chơi' : 'Confirm games played')}</button>
    </>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)}>{vi ? 'Tải lại' : 'Reload'}</button></div>}
  </section>
}
