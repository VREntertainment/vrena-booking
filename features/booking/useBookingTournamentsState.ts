'use client'

import {
  useRef,
  useState
} from 'react'
import {
  Profile,
  QualificationRule,
  TournamentData,
  TournamentFormat
} from '../../lib/bookingWidgetDomain'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingTournamentsState() {
  const [tournamentData, setTournamentData] = useState<TournamentData>({
    editors: [],
    pools: [],
    poolEntries: [],
    matches: [],
    auditLogs: [],
  })
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('pool_to_final')
  const [tournamentBestOf, setTournamentBestOf] = useState<1 | 3 | 5>(1)
  const [tournamentRoundsPerMatch, setTournamentRoundsPerMatch] = useState(1)
  const [tournamentRequirePayment, setTournamentRequirePayment] = useState(false)
  const [tournamentQualificationRule, setTournamentQualificationRule] = useState<QualificationRule>('top_1')
  const [tournamentCustomQualifiers, setTournamentCustomQualifiers] = useState(2)
  const [tournamentThirdPlace, setTournamentThirdPlace] = useState(true)
  const [tournamentFirstPrize, setTournamentFirstPrize] = useState('')
  const [tournamentSecondPrize, setTournamentSecondPrize] = useState('')
  const [tournamentThirdPrize, setTournamentThirdPrize] = useState('')
  const [editTournamentFormat, setEditTournamentFormat] = useState<TournamentFormat>('pool_to_final')
  const [editTournamentBestOf, setEditTournamentBestOf] = useState<1 | 3 | 5>(1)
  const [editTournamentRoundsPerMatch, setEditTournamentRoundsPerMatch] = useState(1)
  const [editTournamentRequirePayment, setEditTournamentRequirePayment] = useState(false)
  const [editTournamentQualificationRule, setEditTournamentQualificationRule] = useState<QualificationRule>('top_1')
  const [editTournamentCustomQualifiers, setEditTournamentCustomQualifiers] = useState(2)
  const [editTournamentThirdPlace, setEditTournamentThirdPlace] = useState(true)
  const [editTournamentFirstPrize, setEditTournamentFirstPrize] = useState('')
  const [editTournamentSecondPrize, setEditTournamentSecondPrize] = useState('')
  const [editTournamentThirdPrize, setEditTournamentThirdPrize] = useState('')
  const [tournamentPoolSize, setTournamentPoolSize] = useState(4)
  const [tournamentEditorEmail, setTournamentEditorEmail] = useState('')
  const [tournamentEditorResults, setTournamentEditorResults] = useState<Profile[]>([])
  const [busyTournamentId, setBusyTournamentId] = useState('')
  const tournamentDataLoadedRef = useRef(false)
  const tournamentDataLoadingRef = useRef(false)
  return {
    tournamentData,
    setTournamentData,
    tournamentFormat,
    setTournamentFormat,
    tournamentBestOf,
    setTournamentBestOf,
    tournamentRoundsPerMatch,
    setTournamentRoundsPerMatch,
    tournamentRequirePayment,
    setTournamentRequirePayment,
    tournamentQualificationRule,
    setTournamentQualificationRule,
    tournamentCustomQualifiers,
    setTournamentCustomQualifiers,
    tournamentThirdPlace,
    setTournamentThirdPlace,
    tournamentFirstPrize,
    setTournamentFirstPrize,
    tournamentSecondPrize,
    setTournamentSecondPrize,
    tournamentThirdPrize,
    setTournamentThirdPrize,
    editTournamentFormat,
    setEditTournamentFormat,
    editTournamentBestOf,
    setEditTournamentBestOf,
    editTournamentRoundsPerMatch,
    setEditTournamentRoundsPerMatch,
    editTournamentRequirePayment,
    setEditTournamentRequirePayment,
    editTournamentQualificationRule,
    setEditTournamentQualificationRule,
    editTournamentCustomQualifiers,
    setEditTournamentCustomQualifiers,
    editTournamentThirdPlace,
    setEditTournamentThirdPlace,
    editTournamentFirstPrize,
    setEditTournamentFirstPrize,
    editTournamentSecondPrize,
    setEditTournamentSecondPrize,
    editTournamentThirdPrize,
    setEditTournamentThirdPrize,
    tournamentPoolSize,
    setTournamentPoolSize,
    tournamentEditorEmail,
    setTournamentEditorEmail,
    tournamentEditorResults,
    setTournamentEditorResults,
    busyTournamentId,
    setBusyTournamentId,
    tournamentDataLoadedRef,
    tournamentDataLoadingRef,
  }
}
