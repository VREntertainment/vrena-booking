'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase/client'

const ARENA_COUNT = 2
const OPEN_MINUTES = 9 * 60
const CLOSE_MINUTES = 22 * 60
const TIME_STEP_MINUTES = 20

type GameId =
  | 'laser-tag'
  | 'mini-block-towers'
  | 'office-war'
  | 'paintball'
  | 'snow-battle'
  | 'castle-unspunnen'
  | 'wild-west'
  | 'arc-of-the-covenant'
  | 'joller-house'

type Profile = {
  id: string
  phone: string
  nickname: string | null
  email: string | null
  avatar_url: string | null
}

type Participant = {
  id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
}

type Session = {
  id: string
  owner_id: string
  name: string
  date: string
  start_time: string
  duration_minutes: number
  max_players: number
  arena_count: number | null
  game_options: GameId[]
  game_votes: Record<string, GameId>
  visibility: 'public' | 'private'
  invite_code: string | null
  notes: string | null
  status: 'open' | 'cancelled' | 'completed'
  session_participants?: Participant[]
}

type BlockedTime = {
  date: string
  start_time: string
  end_time: string
  arenas_used: number
}

const games: Array<{
  id: GameId
  title: string
  category: 'FPS / PVP' | 'Escape'
  image: string
}> = [
  { id: 'laser-tag', title: 'Laser Tag', category: 'FPS / PVP', image: '/games/laser-tag.png' },
  { id: 'mini-block-towers', title: 'Mini Block Towers', category: 'FPS / PVP', image: '/games/mini-block-towers.png' },
  { id: 'office-war', title: 'Office War', category: 'FPS / PVP', image: '/games/office-war.png' },
  { id: 'paintball', title: 'Paintball', category: 'FPS / PVP', image: '/games/paintball.png' },
  { id: 'snow-battle', title: 'Snow Battle', category: 'FPS / PVP', image: '/games/snow-battle.png' },
  { id: 'castle-unspunnen', title: 'Castle Unspunnen', category: 'FPS / PVP', image: '/games/castle-unspunnen.png' },
  { id: 'wild-west', title: 'Wild West', category: 'FPS / PVP', image: '/games/wild-west.png' },
  { id: 'arc-of-the-covenant', title: 'The Secret of the Arc', category: 'Escape', image: '/games/arc-of-the-covenant.png' },
  { id: 'joller-house', title: 'Joller House', category: 'Escape', image: '/games/joller-house.png' },
]

const countries = [
  { code: '+84', name: 'Vietnam' },
  { code: '+33', name: 'France' },
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
  { code: '+66', name: 'Thailand' },
  { code: '+60', name: 'Malaysia' },
  { code: '+62', name: 'Indonesia' },
  { code: '+63', name: 'Philippines' },
  { code: '+81', name: 'Japan' },
  { code: '+82', name: 'South Korea' },
  { code: '+86', name: 'China' },
  { code: '+852', name: 'Hong Kong' },
  { code: '+886', name: 'Taiwan' },
  { code: '+49', name: 'Germany' },
  { code: '+39', name: 'Italy' },
  { code: '+34', name: 'Spain' },
  { code: '+31', name: 'Netherlands' },
  { code: '+41', name: 'Switzerland' },
]

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA
}

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function arenasUsedBySession(session: Pick<Session, 'max_players' | 'arena_count'>) {
  return session.arena_count || (session.max_players > 7 ? 2 : 1)
}

function resolveCountryCode(input: string) {
  const normalized = input.trim().toLowerCase()
  const explicitCode = normalized.match(/\+\d{1,4}/)?.[0]
  if (explicitCode) return explicitCode

  const country = countries.find((item) => item.name.toLowerCase().includes(normalized))
  return country?.code || '+84'
}

function splitPhoneNumber(phone: string) {
  const cleaned = phone.trim()
  const country = [...countries]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => cleaned.startsWith(item.code))

  if (!country) {
    return { countryInput: '+84 Vietnam', localPhone: cleaned }
  }

  return {
    countryInput: `${country.code} ${country.name}`,
    localPhone: cleaned.slice(country.code.length).trim(),
  }
}

function displayName(profile: Profile | null) {
  if (!profile) return 'Player'
  return profile.nickname || profile.phone
}

export default function WidgetPage() {
  const [activeView, setActiveView] = useState<'sessions' | 'create' | 'profile' | 'admin'>('sessions')
  const [sessions, setSessions] = useState<Session[]>([])
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})

  const [profileCountryCode, setProfileCountryCode] = useState('+84 Vietnam')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [profileStatus, setProfileStatus] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(localDateString())
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(20)
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState(4)
  const [sessionArenaCount, setSessionArenaCount] = useState(1)
  const [sessionNotes, setSessionNotes] = useState('')
  const [selectedGames, setSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [createStatus, setCreateStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [busySessionId, setBusySessionId] = useState('')
  const [busyVoteKey, setBusyVoteKey] = useState('')

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser()
    let authUser = userData.user

    if (!authUser) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        setProfileStatus('Profile login is not enabled yet. Enable anonymous sign-ins in Supabase Auth.')
        return
      }
      authUser = data.user
    }

    if (!authUser) return

    setUserId(authUser.id)

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, phone, nickname, email, avatar_url')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileRow) {
      const phoneParts = splitPhoneNumber(profileRow.phone || '')
      setProfile(profileRow)
      setProfileCountryCode(phoneParts.countryInput)
      setProfilePhone(phoneParts.localPhone)
      setProfileNickname(profileRow.nickname || '')
      setProfileEmail(profileRow.email || '')
    }
  }

  async function loadSessions() {
    const [sessionResult, blockedResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, session_participants(id, profile_id, display_name, avatar_url)')
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('blocked_times').select('date, start_time, end_time, arenas_used'),
    ])

    if (sessionResult.error) {
      setCreateStatus(sessionResult.error.message)
      return
    }

    setSessions((sessionResult.data ?? []) as Session[])
    setBlockedTimes((blockedResult.data ?? []) as BlockedTime[])
  }

  useEffect(() => {
    loadProfile()
    loadSessions()
  }, [])

  const timeOptions = useMemo(() => {
    if (!sessionDate) return []

    const now = new Date()
    const today = localDateString(now)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const options: Array<{ value: string; label: string; remaining: number }> = []
    const latestStart = CLOSE_MINUTES - sessionDuration

    for (let start = OPEN_MINUTES; start <= latestStart; start += TIME_STEP_MINUTES) {
      const end = start + sessionDuration

      if (sessionDate === today && start <= nowMinutes) continue

      const activeSessionArenas = sessions
        .filter((session) => session.status === 'open' && session.date === sessionDate)
        .filter((session) =>
          rangesOverlap(
            start,
            end,
            timeToMinutes(session.start_time),
            timeToMinutes(session.start_time) + session.duration_minutes
          )
        )
        .reduce((total, session) => total + arenasUsedBySession(session), 0)

      const activeBlockedArenas = blockedTimes
        .filter((blocked) => blocked.date === sessionDate)
        .filter((blocked) =>
          rangesOverlap(start, end, timeToMinutes(blocked.start_time), timeToMinutes(blocked.end_time))
        )
        .reduce((total, blocked) => total + blocked.arenas_used, 0)

      const remaining = ARENA_COUNT - activeSessionArenas - activeBlockedArenas

      if (remaining >= sessionArenaCount) {
        options.push({
          value: minutesToTime(start),
          label: `${minutesToTime(start)}-${minutesToTime(end)} (${remaining} arena${remaining > 1 ? 's' : ''} available)`,
          remaining,
        })
      }
    }

    return options
  }, [blockedTimes, sessionArenaCount, sessionDate, sessionDuration, sessions])

  function handleSessionDateChange(event: ChangeEvent<HTMLInputElement>) {
    setSessionDate(event.target.value)
    event.currentTarget.blur()
  }

  function handleMaxPlayersChange(value: number) {
    setSessionMaxPlayers(value)

    if (value < 8) {
      setSessionArenaCount(1)
    }
  }

  function handleArenaCountChange(value: number) {
    if (value === 2 && sessionMaxPlayers < 8) {
      setSessionMaxPlayers(8)
    }

    setSessionArenaCount(value)
  }

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sessions

    return sessions.filter((session) => {
      const selectedGameNames = session.game_options
        .map((gameId) => games.find((game) => game.id === gameId)?.title || gameId)
        .join(' ')
        .toLowerCase()

      return (
        session.name.toLowerCase().includes(query) ||
        selectedGameNames.includes(query) ||
        session.invite_code?.toLowerCase() === query
      )
    })
  }, [search, sessions])

  async function saveProfile() {
    if (!userId) {
      setProfileStatus('Please wait, profile login is still loading.')
      return
    }

    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/[^\d\s-]/g, '').trim()

    if (!profilePhone.trim()) {
      setProfileStatus('Phone number is required.')
      return
    }

    setIsSavingProfile(true)
    setProfileStatus('Saving profile...')

    let avatarUrl = profile?.avatar_url || null

    if (avatarFile) {
      const safeName = avatarFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
      const path = `${userId}/${Date.now()}-${safeName}`
      const upload = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })

      if (upload.error) {
        setProfileStatus(upload.error.message)
        setIsSavingProfile(false)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = data.publicUrl
    }

    const row = {
      id: userId,
      phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
      nickname: profileNickname.trim() || null,
      email: profileEmail.trim() || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row)
      .select('id, phone, nickname, email, avatar_url')
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    setProfile(data)
    setAvatarFile(null)
    setAvatarPreview('')
    setProfileCountryCode(`${countryCode} ${countries.find((country) => country.code === countryCode)?.name || ''}`.trim())
    setProfilePhone(localPhone)
    setProfileStatus('Profile saved.')
    setIsSavingProfile(false)
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setAvatarFile(file)
    setAvatarPreview(file ? URL.createObjectURL(file) : '')
  }

  function toggleGame(gameId: GameId) {
    setSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  async function createSession() {
    if (!profile) {
      setCreateStatus('Please create your profile first.')
      setActiveView('profile')
      setIsCreating(false)
      return
    }

    if (!sessionName.trim() || !sessionDate || !sessionTime) {
      setCreateStatus('Please enter a session name, date, and available time.')
      setIsCreating(false)
      return
    }

    setIsCreating(true)
    setCreateStatus('Creating session...')

    const inviteCode = sessionVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await supabase
      .from('sessions')
      .insert({
        owner_id: userId,
        name: sessionName.trim(),
        date: sessionDate,
        start_time: `${sessionTime}:00`,
        duration_minutes: sessionDuration,
        max_players: sessionMaxPlayers,
        arena_count: sessionArenaCount,
        game_options: selectedGames,
        game_votes: { [userId]: selectedGames[0] },
        visibility: sessionVisibility,
        invite_code: inviteCode,
        notes: sessionNotes.trim() || null,
        status: 'open',
      })
      .select('id')
      .single()

    if (error || !created) {
      setCreateStatus(error?.message || 'Could not create session.')
      setIsCreating(false)
      return
    }

    await supabase.from('session_participants').insert({
      session_id: created.id,
      profile_id: userId,
      display_name: displayName(profile),
      avatar_url: profile.avatar_url,
    })

    setCreateStatus(
      sessionVisibility === 'private'
        ? `Private session created. Invite code: ${inviteCode}`
        : 'Session created.'
    )

    setSessionName('')
    setSessionNotes('')
    setSessionTime('')
    setSessionDuration(20)
    setSessionMaxPlayers(4)
    setSessionArenaCount(1)
    setSelectedGames(['laser-tag'])
    setSessionVisibility('public')
    await loadSessions()
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    if (!profile) {
      setCreateStatus('Please create your profile first.')
      setActiveView('profile')
      return
    }

    if (session.visibility === 'private') {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (typedCode !== session.invite_code) {
        setCreateStatus('Private code is incorrect.')
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return

    if (participants.length >= session.max_players) {
      setCreateStatus('This session is already full.')
      return
    }

    setBusySessionId(session.id)

    const { error } = await supabase.from('session_participants').insert({
      session_id: session.id,
      profile_id: userId,
      display_name: displayName(profile),
      avatar_url: profile.avatar_url,
    })

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setBusySessionId('')
    setCreateStatus('You joined the session.')
  }

  async function voteForGame(session: Session, gameId: GameId) {
    if (!profile) {
      setActiveView('profile')
      return
    }

    const voteKey = `${session.id}-${gameId}`
    setBusyVoteKey(voteKey)
    const votes = { ...(session.game_votes || {}), [userId]: gameId }
    const { error } = await supabase.from('sessions').update({ game_votes: votes }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusyVoteKey('')
      return
    }

    await loadSessions()
    setCreateStatus('Vote saved.')
    setBusyVoteKey('')
  }

  function voteCount(session: Session, gameId: GameId) {
    return Object.values(session.game_votes || {}).filter((vote) => vote === gameId).length
  }

  return (
    <div className="app">
      <aside>
        <div>
          <h1>VRena Sessions</h1>
          <p className="muted">Create a public or private game session and let other players join.</p>
        </div>

        <div className="profile-chip">
          <div className="avatar">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : displayName(profile).slice(0, 1)}
          </div>
          <div>
            <strong>{profile ? displayName(profile) : 'No profile yet'}</strong>
            <span>{profile?.phone || 'Phone required'}</span>
          </div>
        </div>

        <div className="tabs">
          <button className={activeView === 'sessions' ? 'tab active' : 'tab'} onClick={() => setActiveView('sessions')}>
            Sessions
          </button>
          <button className={activeView === 'create' ? 'tab active' : 'tab'} onClick={() => setActiveView('create')}>
            Create Session
          </button>
          <button className={activeView === 'profile' ? 'tab active' : 'tab'} onClick={() => setActiveView('profile')}>
            Profile
          </button>
          <button className={activeView === 'admin' ? 'tab active' : 'tab'} onClick={() => setActiveView('admin')}>
            Admin
          </button>
        </div>
      </aside>

      <main>
        {activeView === 'sessions' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Available Game Sessions</h2>
                <p className="muted">Private sessions are listed, but joining requires the 6-character code.</p>
              </div>
              <input
                className="search"
                type="search"
                placeholder="Search by session name, game, or private code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {createStatus && <p className="notice">{createStatus}</p>}

            <div className="list">
              {filteredSessions.length === 0 && <p className="notice">No matching sessions yet.</p>}

              {filteredSessions.map((session) => {
                const participants = session.session_participants ?? []
                const remaining = session.max_players - participants.length
                const alreadyJoined = participants.some((participant) => participant.profile_id === userId)

                return (
                  <article className="session" key={session.id}>
                    <div className="session-top">
                      <div>
                        <h3>{session.name}</h3>
                        <div className="row-meta">
                          <span>{session.date}</span>
                          <span>{session.start_time.slice(0, 5)}</span>
                          <span>{session.duration_minutes} min</span>
                          <span>{remaining} seats left</span>
                        </div>
                      </div>
                      <span className={session.visibility === 'private' ? 'pill private' : 'pill ok'}>
                        {session.visibility === 'private' ? 'Private' : 'Public'}
                      </span>
                    </div>

                    {session.notes && <p className="notes">{session.notes}</p>}

                    <div className="players">
                      {participants.map((participant) => (
                        <div className="player" key={participant.id} title={participant.display_name || 'Player'}>
                          <div className="player-avatar">
                            {participant.avatar_url ? <img src={participant.avatar_url} alt="" /> : (participant.display_name || 'P').slice(0, 1)}
                          </div>
                          <span>{participant.display_name || 'Player'}</span>
                        </div>
                      ))}
                    </div>

                    <div className="game-strip">
                      {session.game_options.map((gameId) => {
                        const game = games.find((item) => item.id === gameId)
                        if (!game) return null

                        return (
                          <button
                            className={[
                              session.game_votes?.[userId] === gameId ? 'game-card selected' : 'game-card',
                              busyVoteKey === `${session.id}-${gameId}` ? 'loading' : '',
                            ].join(' ').trim()}
                            key={gameId}
                            disabled={busyVoteKey === `${session.id}-${gameId}`}
                            onClick={() => voteForGame(session, gameId)}
                            type="button"
                          >
                            <img src={game.image} alt="" />
                            <span>{game.title}</span>
                            <strong>{voteCount(session, gameId)} vote{voteCount(session, gameId) === 1 ? '' : 's'}</strong>
                          </button>
                        )
                      })}
                    </div>

                    <div className="join-row">
                      {session.visibility === 'private' && !alreadyJoined && (
                        <input
                          placeholder="Private code"
                          value={joinCodes[session.id] || ''}
                          onChange={(event) =>
                            setJoinCodes((current) => ({ ...current, [session.id]: event.target.value.toUpperCase() }))
                          }
                        />
                      )}
                      <button
                        className={busySessionId === session.id ? 'primary loading' : 'primary'}
                        disabled={alreadyJoined || remaining <= 0 || busySessionId === session.id}
                        onClick={() => joinSession(session)}
                      >
                        {alreadyJoined ? 'Joined' : remaining <= 0 ? 'Full' : busySessionId === session.id ? 'Joining...' : 'Join Session'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeView === 'create' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Create Session</h2>
                <p className="muted">Duration increases by 20 minutes. Max players is 16.</p>
              </div>
              <div className="segmented">
                <button className={sessionVisibility === 'public' ? 'active' : ''} onClick={() => setSessionVisibility('public')} type="button">
                  Public
                </button>
                <button className={sessionVisibility === 'private' ? 'active' : ''} onClick={() => setSessionVisibility('private')} type="button">
                  Private
                </button>
              </div>
            </div>

            <div className="form-grid">
              <div className="full">
                <label>Session Name <span className="required">*</span></label>
                <input placeholder="Friday VR squad" value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
              </div>
              <div>
                <label>Date <span className="required">*</span></label>
                <input type="date" value={sessionDate} onChange={handleSessionDateChange} />
              </div>
              <div>
                <label>Available Time <span className="required">*</span></label>
                <select value={sessionTime} onChange={(event) => setSessionTime(event.target.value)}>
                  <option value="">Choose a time</option>
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Duration</label>
                <select value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))}>
                  {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                    <option value={duration} key={duration}>
                      {duration} min
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Maximum Players</label>
                <select value={sessionMaxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))}>
                  {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                    <option value={count} key={count}>
                      {count} player{count === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Arenas</label>
                <select value={sessionArenaCount} onChange={(event) => handleArenaCountChange(Number(event.target.value))}>
                  <option value={1}>1 arena</option>
                  <option value={2} disabled={sessionMaxPlayers < 8}>
                    2 arenas - 8 players minimum
                  </option>
                </select>
              </div>
              <div className="full">
                <label>Game Options <span className="required">*</span></label>
                <div className="game-picker">
                  {games.map((game) => (
                    <button
                      className={selectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                      key={game.id}
                      onClick={() => toggleGame(game.id)}
                      type="button"
                    >
                      <img src={game.image} alt="" />
                      <span>{game.title}</span>
                      <strong>{game.category}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <div className="full">
                <label>Notes</label>
                <textarea
                  placeholder="Language, skill level, preferred game, special notes"
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                />
              </div>
            </div>

            <button className={isCreating ? 'primary loading create-button' : 'primary create-button'} disabled={isCreating} onClick={createSession}>
              {isCreating ? 'Creating...' : sessionVisibility === 'private' ? 'Create Private Session' : 'Create Session'}
            </button>
            {createStatus && <p className="notice">{createStatus}</p>}
          </section>
        )}

        {activeView === 'profile' && (
          <section className="section">
            <h2>Profile</h2>
            <p className="muted">Phone number is mandatory. Nickname and email are optional.</p>

            <div className="form-grid profile-form">
              <div className="profile-photo-panel">
                <div className="profile-photo-preview">
                  {avatarPreview || profile?.avatar_url ? (
                    <img src={avatarPreview || profile?.avatar_url || ''} alt="" />
                  ) : (
                    displayName(profile).slice(0, 1)
                  )}
                </div>
                <div>
                  <strong>{profile ? displayName(profile) : 'Profile photo'}</strong>
                  <span>Shown beside your name when you join a session.</span>
                </div>
              </div>
              <div>
                <label>Country Code <span className="required">*</span></label>
                <input
                  list="country-codes"
                  value={profileCountryCode}
                  onChange={(event) => setProfileCountryCode(event.target.value)}
                  placeholder="+84 or Vietnam"
                />
                <datalist id="country-codes">
                  {countries.map((country) => (
                    <option key={`${country.code}-${country.name}`} value={`${country.code} ${country.name}`} />
                  ))}
                </datalist>
              </div>
              <div>
                <label>Phone Number <span className="required">*</span></label>
                <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="707472499" />
              </div>
              <div>
                <label>Nickname</label>
                <input value={profileNickname} onChange={(event) => setProfileNickname(event.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label>Profile Photo</label>
                <input type="file" accept="image/*" onChange={handleAvatarChange} />
              </div>
            </div>

            <button
              className={isSavingProfile ? 'primary loading create-button' : 'primary create-button'}
              disabled={isSavingProfile}
              onClick={saveProfile}
            >
              {isSavingProfile ? 'Saving...' : 'Save Profile'}
            </button>
            {profileStatus && <p className="notice">{profileStatus}</p>}
          </section>
        )}

        {activeView === 'admin' && (
          <section className="section">
            <h2>Admin</h2>
            <p className="muted">This page reads the same Supabase sessions and blocked times used for player availability.</p>
            <div className="stats">
              <div><strong>{sessions.length}</strong><span>active sessions</span></div>
              <div><strong>{blockedTimes.length}</strong><span>blocked time ranges</span></div>
              <div><strong>{ARENA_COUNT}</strong><span>arenas</span></div>
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: #f6f7f9;
          color: #071112;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .app {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
        }

        aside {
          background: #ffffff;
          border-right: 1px solid rgba(7, 17, 18, 0.12);
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        main {
          padding: 22px;
        }

        h1, h2, h3, p {
          margin: 0;
        }

        h1 {
          font-size: 24px;
        }

        h2 {
          font-size: 19px;
          margin-bottom: 8px;
        }

        h3 {
          font-size: 18px;
        }

        .muted {
          color: #637075;
          font-size: 13px;
          line-height: 1.4;
        }

        .section {
          background: #ffffff;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 10px 22px rgba(7, 17, 18, 0.08);
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .profile-chip {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 10px;
        }

        .profile-chip strong,
        .profile-chip span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-chip span {
          color: #637075;
          font-size: 12px;
        }

        .profile-photo-panel {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
          background: #ffffff;
        }

        .profile-photo-panel strong,
        .profile-photo-panel span {
          display: block;
        }

        .profile-photo-panel span {
          color: #637075;
          font-size: 13px;
          margin-top: 4px;
        }

        .profile-photo-preview {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(135deg, #00cbd1, #3059ff);
          color: #ffffff;
          font-size: 30px;
          font-weight: 900;
        }

        .profile-photo-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar,
        .player-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(135deg, #00cbd1, #3059ff);
          color: #ffffff;
          font-weight: 800;
        }

        .avatar img,
        .player-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .tabs {
          display: grid;
          gap: 8px;
        }

        .tab,
        .segmented button {
          text-align: left;
          background: transparent;
          color: #071112;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 10px 13px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .tab.active,
        .segmented button.active {
          background: #f0f4f6;
          border-color: rgba(7, 17, 18, 0.12);
        }

        .segmented {
          display: inline-flex;
          gap: 4px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 4px;
        }

        .search {
          max-width: 360px;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .session {
          display: grid;
          gap: 13px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 14px;
          background: #ffffff;
        }

        .session-top,
        .join-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .row-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: #637075;
          font-size: 13px;
          margin-top: 6px;
        }

        .notes {
          color: #465358;
          font-size: 13px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f0f4f6;
          color: #637075;
          white-space: nowrap;
        }

        .pill.ok {
          color: #0d7c51;
        }

        .pill.private {
          color: #b04200;
        }

        .players {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .player {
          display: inline-grid;
          grid-template-columns: 32px auto;
          gap: 7px;
          align-items: center;
          font-size: 13px;
          font-weight: 700;
        }

        .player-avatar {
          width: 32px;
          height: 32px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .full {
          grid-column: 1 / -1;
        }

        label {
          display: block;
          color: #637075;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .required {
          color: #d72638;
          font-weight: 900;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          border-radius: 8px;
          padding: 10px 11px;
          font: inherit;
          outline: none;
        }

        textarea {
          resize: vertical;
          min-height: 82px;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 10px 13px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          background: #071112;
          color: #ffffff;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.68;
        }

        button.primary {
          background: linear-gradient(90deg, #00aeb3, #3059ff);
        }

        .create-button {
          margin-top: 14px;
        }

        .loading {
          position: relative;
          overflow: hidden;
        }

        .loading::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
          animation: loadingSweep 1s infinite;
        }

        @keyframes loadingSweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }

        .notice {
          border-left: 4px solid #00aeb3;
          background: #f0f4f6;
          padding: 10px 12px;
          border-radius: 6px;
          color: #637075;
          font-size: 13px;
          margin-top: 12px;
        }

        .game-picker,
        .game-strip {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
          gap: 10px;
        }

        .game-card {
          display: grid;
          gap: 7px;
          text-align: left;
          background: #ffffff;
          color: #071112;
          border: 2px solid rgba(7, 17, 18, 0.12);
          padding: 8px;
        }

        .game-card.selected {
          border-color: #00aeb3;
          box-shadow: 0 0 0 3px rgba(0, 174, 179, 0.15);
        }

        .game-card img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 6px;
          background: #071112;
        }

        .game-card span {
          font-weight: 800;
          line-height: 1.2;
        }

        .game-card strong {
          color: #637075;
          font-size: 12px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .stats div {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
        }

        .stats strong,
        .stats span {
          display: block;
        }

        .stats strong {
          font-size: 24px;
        }

        .stats span {
          color: #637075;
          font-size: 13px;
        }

        @media (max-width: 960px) {
          .app {
            grid-template-columns: 1fr;
          }

          aside {
            border-right: 0;
            border-bottom: 1px solid rgba(7, 17, 18, 0.12);
          }

          .section-head,
          .session-top,
          .join-row {
            display: grid;
          }

          .search {
            max-width: none;
          }

          .form-grid,
          .stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
