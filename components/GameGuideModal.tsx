'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import GameGuideBrowser from './GameGuideBrowser'
import { gameGuideCopy } from '../lib/gameGuideCopy'
import type { GameVenue, PublicGameGuideGame, StaffGameGuide } from '../lib/gameGuideCatalog'
import type { LanguageCode } from '../lib/i18n/languages'
import './GameGuideModal.css'

export type GameGuideGame = PublicGameGuideGame
export type GameGuideStaffGuide = StaffGameGuide

type Props = { initialVenue: GameVenue; closeText: string; text: Record<string, string>; language: LanguageCode; games: PublicGameGuideGame[]; staffGameGuides: Partial<Record<string, StaffGameGuide>>; onClose: () => void; loading?: boolean; loadError?: boolean; onRetry?: () => void }

export default function GameGuideModal({ initialVenue, closeText, text, language, games, staffGameGuides, onClose, loading, loadError, onRetry }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    close.current?.focus()
    return () => previousFocus?.focus()
  }, [])
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="game-guide-title" onClick={onClose} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary, a[href]') ?? []).filter((item) => item.getClientRects().length > 0)
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <div ref={panel} className="login-modal game-guide-modal" onClick={(event) => event.stopPropagation()}>
        <button ref={close} className="modal-close" type="button" onClick={onClose} aria-label={closeText}><X aria-hidden="true" size={20} /></button>
        <header className="game-guide-header"><h2 id="game-guide-title">{text.gameGuideTitle}</h2><p>{gameGuideCopy[language].intro}</p></header>
        <GameGuideBrowser games={games} staffGuides={staffGameGuides} language={language} text={text} initialVenue={initialVenue} variant="modal" loading={loading} loadError={loadError} onRetry={onRetry} />
      </div>
    </div>
  )
}
