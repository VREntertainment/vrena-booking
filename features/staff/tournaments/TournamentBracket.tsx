'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { GripVertical } from 'lucide-react'
import type { TeamMatch, TournamentCommand, TournamentDetail } from '../../../lib/staff/tournaments'
import type { TournamentCopy } from './copy'
import styles from './TournamentWorkspace.module.css'

export type TVMotion = { matches: Set<number>; teams: Set<string>; links: Set<string> }
export const emptyMotion: TVMotion = { matches: new Set(), teams: new Set(), links: new Set() }

export function tournamentMotion(previous: TournamentDetail, next: TournamentDetail): TVMotion {
  const changes: TVMotion = { matches: new Set(), teams: new Set(), links: new Set() }
  const prior = new Map(previous.matches.map(match => [match.number, match]))
  for (const match of next.matches) {
    if (match.review || match.outcome === 'bye') continue
    const old = prior.get(match.number)
    if (match.status === 'in_progress' && old?.status !== match.status) changes.matches.add(match.number)
    if (match.status === 'completed' && (old?.status !== match.status || old.review || old.score_a !== match.score_a || old.score_b !== match.score_b || old.outcome !== match.outcome)) {
      changes.matches.add(match.number)
      if (match.team_a) changes.teams.add(match.team_a)
      if (match.team_b) changes.teams.add(match.team_b)
    }
    if (match.team_a && match.feed_a && old?.team_a !== match.team_a) changes.links.add(match.feed_a + ':' + match.number)
    if (match.team_b && match.feed_b && old?.team_b !== match.team_b) changes.links.add(match.feed_b + ':' + match.number)
  }
  return changes
}

export default function TournamentBracket({ detail, text, labels, date, motion = emptyMotion, choose, busy }: {
  detail: TournamentDetail
  text: TournamentCopy
  labels: (round: number) => string
  date: (match: TeamMatch) => string
  motion?: TVMotion
  choose?: (command: TournamentCommand) => Promise<boolean>
  busy?: boolean
}) {
  const [target, setTarget] = useState('')
  const [selected, setSelected] = useState<TeamMatch | null>(null)
  const drag = useRef<{ match: TeamMatch; side: 'a' | 'b'; x: number; y: number } | null>(null)
  const positions = new Map<number, { x: number; y: number }>()
  const width = 214, gap = 42, height = choose ? 178 : 138
  const last = detail.matches.at(-1)?.round ?? 0
  let opening = 0
  for (const match of detail.matches) {
    const a = positions.get(match.feed_a ?? 0), b = positions.get(match.feed_b ?? 0)
    positions.set(match.number, { x: (match.round - 1) * (width + gap), y: a && b ? (a.y + b.y) / 2 : 29 + opening++ * height })
  }
  const totalWidth = (last - 1) * (width + gap) + width
  const totalHeight = 29 + opening * height
  const teamName = (id: string | null, match: TeamMatch) => detail.teams.find(team => team.id === id)?.name ?? (match.outcome === 'bye' ? text.bye : text.waiting)
  const slotAt = (e: PointerEvent<HTMLButtonElement>) => document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-opening-slot]')?.dataset.openingSlot ?? ''
  function drop(e: PointerEvent<HTMLButtonElement>) {
    const source = drag.current
    drag.current = null
    setTarget('')
    if (!source || !choose || busy) return
    if (Math.hypot(source.x - e.clientX, source.y - e.clientY) < 6) { setSelected(source.match); return }
    const [number, side] = slotAt(e).split(':')
    const dest = detail.matches.find(match => match.number === Number(number))
    if (!dest || (dest.number === source.match.number && side === source.side)) return
    const moved = source.side === 'a' ? source.match.team_a : source.match.team_b
    const same = source.match.number === dest.number
    void choose({ action: 'pairing', match_number: dest.number,
      team_a: side === 'a' ? moved : same ? dest.team_b : dest.team_a,
      team_b: side === 'b' ? moved : same ? dest.team_a : dest.team_b })
  }
  return <>
    {choose && <p>{text.drawHelp}</p>}
    <div className={styles.diagramScroll} tabIndex={0} aria-label={text.bracket}>
      <div className={styles.diagram} style={{ width: totalWidth, height: totalHeight }}>
        <svg aria-hidden="true" width={totalWidth} height={totalHeight} fill="none" stroke="currentColor" strokeWidth={2}>
          {detail.matches.flatMap(match => [match.feed_a, match.feed_b].map(feed => {
            const from = positions.get(feed ?? 0), to = positions.get(match.number)
            if (!from || !to) return null
            const mid = (from.x + width + to.x) / 2, key = feed + ':' + match.number
            return <path key={key} pathLength={1} data-path={motion.links.has(key) ? detail.tournament.version : undefined}
              d={'M ' + (from.x + width) + ' ' + (from.y + 52) + ' H ' + mid + ' V ' + (to.y + 52) + ' H ' + to.x} />
          }))}
        </svg>
        {Array.from({ length: last }, (_, i) => <h4 key={i} className={styles.diagramLabel} style={{ left: i * (width + gap) }}>{labels(i + 1)}</h4>)}
        {detail.matches.map(match => <article className={styles.diagramCard} key={match.number}
          style={{ left: positions.get(match.number)?.x, top: positions.get(match.number)?.y, width }}
          data-review={match.review || undefined} data-motion={motion.matches.has(match.number) ? detail.tournament.version : undefined}>
          <small>{text.match} {match.number}{match.review ? ' - ' + text.flagged : ''}</small>
          {(['a', 'b'] as const).map(side => {
            const id = side === 'a' ? match.team_a : match.team_b
            const slot = choose && id && match.round === 1 ? match.number + ':' + side : undefined
            return <div key={side} data-opening-slot={slot} data-drop={Boolean(slot && slot === target) || undefined}
              data-winner={Boolean(id && id === match.winner && !match.review) || undefined}>
              <span>{teamName(id, match)}</span>
              {slot ? <button className={styles.dragHandle} type="button" disabled={busy} aria-label={text.moveTeam + ' ' + teamName(id, match)}
                onClick={event => { if (event.detail === 0) setSelected(match) }}
                onPointerDown={event => {
                  if (event.isPrimary && event.button === 0) {
                    event.currentTarget.setPointerCapture(event.pointerId)
                    drag.current = { match, side, x: event.clientX, y: event.clientY }
                  }
                }}
                onPointerMove={event => { if (drag.current) setTarget(slotAt(event)) }}
                onPointerUp={drop} onPointerCancel={() => { drag.current = null; setTarget('') }}>
                <GripVertical size={16} />
              </button> : <strong>{(side === 'a' ? match.score_a : match.score_b) ?? '-'}</strong>}
            </div>
          })}
          <small>{date(match)}</small>
          {choose && match.round === 1 && <button type="button" className="secondary" disabled={busy} onClick={() => setSelected(match)}>{text.chooseTeams}</button>}
        </article>)}
      </div>
    </div>
    {selected && choose && <form className={styles.teamEditor} onSubmit={async event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      if (await choose({ action: 'pairing', match_number: selected.number, team_a: data.get('a') as string | null, team_b: data.get('b') as string | null })) setSelected(null)
    }}>
      <strong>{text.chooseTeams} {selected.number}</strong>
      {(['a', 'b'] as const).map((side, index) => {
        const id = index ? selected.team_b : selected.team_a
        return id ? <label key={side}>{text.team} {index + 1}<select name={side} defaultValue={id}>{detail.teams.map(team =>
          <option key={team.id} value={team.id}>{team.name}</option>)}</select></label> : <small key={side}>{text.bye}</small>
      })}
      <button type="submit" className="primary" disabled={busy}>{text.save}</button>
      <button type="button" className="secondary" onClick={() => setSelected(null)}>{text.cancel}</button>
    </form>}
  </>
}
