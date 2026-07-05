'use client'

import NextImage from 'next/image'
import { Award, Search, Send, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { staffAchievementAwardCatalog } from '../lib/staffAchievementAwards'
import type { StaffAchievementAwardCatalogItem } from '../lib/staffAchievementAwards'
import type { StaffProfile } from './StaffConsole'

export type StaffAchievementAward = {
  id: string
  profile_id: string
  achievement_id: string
  achievement_kind: string
  title: string
  description: string | null
  note: string | null
  awarded_at: string
}

type StaffAchievementAwardPanelText = {
  alreadyAwarded: string
  awardAchievement: string
  awardAchievementHelp: string
  awardNote: string
  awardToPlayer: string
  chooseAchievement: string
  choosePlayer: string
  grantedAwards: string
  noAwardsYet: string
  noPlayersFound: string
  optional: string
  searchPlayers: string
  sendAward: string
}

type StaffAchievementAwardPanelProps = {
  awards: StaffAchievementAward[]
  canOpenProfiles: boolean
  isSaving: boolean
  note: string
  onAward: () => void
  onAchievementChange: (achievementId: string) => void
  onNoteChange: (note: string) => void
  onOpenProfile?: (profile: StaffProfile) => void
  onProfileChange: (profileId: string) => void
  profiles: StaffProfile[]
  selectedAchievementId: string
  selectedProfileId: string
  status: string
  text: StaffAchievementAwardPanelText
}

function profileName(profile: StaffProfile) {
  if (profile.anonymous_mode) return profile.nickname || profile.anonymous_callsign || 'Player'
  return profile.nickname || profile.full_name || profile.phone || profile.email || 'Player'
}

function profileSearchText(profile: StaffProfile) {
  return [
    profileName(profile),
    profile.full_name || '',
    profile.nickname || '',
    profile.email || '',
    profile.phone || '',
  ].join(' ').toLowerCase()
}

export default function StaffAchievementAwardPanel({
  awards,
  canOpenProfiles,
  isSaving,
  note,
  onAward,
  onAchievementChange,
  onNoteChange,
  onOpenProfile,
  onProfileChange,
  profiles,
  selectedAchievementId,
  selectedProfileId,
  status,
  text,
}: StaffAchievementAwardPanelProps) {
  const [query, setQuery] = useState('')
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || null
  const selectedAchievement = staffAchievementAwardCatalog.find((item) => item.id === selectedAchievementId) || staffAchievementAwardCatalog[0]
  const activeAwards = awards.filter((award) => award.profile_id === selectedProfileId)
  const alreadyAwarded = activeAwards.some((award) => award.achievement_id === selectedAchievement.id)
  const catalogGroups = useMemo(() => staffAchievementAwardCatalog.reduce<Record<string, StaffAchievementAwardCatalogItem[]>>((groups, item) => {
    groups[item.group] = [...(groups[item.group] ?? []), item]
    return groups
  }, {}), [])
  const visibleProfiles = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase()
    const rows = profiles.filter((profile) => {
      if (!trimmedQuery) return true
      return profileSearchText(profile).includes(trimmedQuery)
    })
    return rows
      .sort((left, right) => profileName(left).localeCompare(profileName(right)))
      .slice(0, 8)
  }, [profiles, query])

  return (
    <div className="staff-achievement-award-panel">
      <div className="staff-achievement-award-copy">
        <span className="staff-achievement-award-mark" aria-hidden="true">
          <Award size={20} />
        </span>
        <div>
          <strong>{text.awardAchievement}</strong>
          <span>{text.awardAchievementHelp}</span>
        </div>
      </div>

      <div className="staff-achievement-award-layout">
        <div className="staff-achievement-player-picker">
          <label>
            <span className="staff-field-label">{text.searchPlayers}</span>
            <span className="staff-search-control">
              <Search aria-hidden="true" size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.choosePlayer}
              />
            </span>
          </label>
          <div className="staff-achievement-player-list">
            {visibleProfiles.map((profile) => {
              const selected = profile.id === selectedProfileId
              return (
                <button
                  className={selected ? 'staff-achievement-player active' : 'staff-achievement-player'}
                  key={profile.id}
                  onClick={() => onProfileChange(profile.id)}
                  type="button"
                >
                  <span className="staff-achievement-player-avatar" aria-hidden="true">
                    <UserRound size={16} />
                  </span>
                  <span>
                    <strong>{profileName(profile)}</strong>
                    <small>{profile.email || profile.phone || profile.profile_motto || text.choosePlayer}</small>
                  </span>
                </button>
              )
            })}
            {visibleProfiles.length === 0 && <p className="notice compact-notice">{text.noPlayersFound}</p>}
          </div>
        </div>

        <div className="staff-achievement-award-form">
          <label>
            <span className="staff-field-label">{text.chooseAchievement}</span>
            <select value={selectedAchievement.id} onChange={(event) => onAchievementChange(event.target.value)}>
              {Object.entries(catalogGroups).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="staff-achievement-preview">
            {selectedAchievement.image ? (
              <span className="staff-achievement-preview-image">
                <NextImage alt="" fill sizes="64px" src={selectedAchievement.image} />
              </span>
            ) : (
              <span className="staff-achievement-preview-icon" aria-hidden="true">
                <Award size={22} />
              </span>
            )}
            <div>
              <strong>{selectedAchievement.title}</strong>
              <span>{selectedAchievement.description}</span>
            </div>
          </div>

          <label>
            <span className="staff-field-label">{text.awardNote} <small>{text.optional}</small></span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={text.awardToPlayer}
            />
          </label>

          <div className="staff-achievement-award-actions">
            {canOpenProfiles && selectedProfile && (
              <button className="secondary" onClick={() => onOpenProfile?.(selectedProfile)} type="button">
                <UserRound aria-hidden="true" size={15} />
                {profileName(selectedProfile)}
              </button>
            )}
            <button
              className={isSaving ? 'primary loading' : 'primary'}
              disabled={isSaving || !selectedProfile || alreadyAwarded}
              onClick={onAward}
              type="button"
            >
              <Send aria-hidden="true" size={15} />
              {alreadyAwarded ? text.alreadyAwarded : text.sendAward}
            </button>
          </div>

          <div className="staff-achievement-awarded-list">
            <strong>{text.grantedAwards}</strong>
            {activeAwards.length > 0 ? (
              activeAwards.map((award) => (
                <span key={award.id}>
                  <Award aria-hidden="true" size={14} />
                  {award.title}
                </span>
              ))
            ) : (
              <small>{text.noAwardsYet}</small>
            )}
          </div>

          {status && <p className="notice compact-notice">{status}</p>}
        </div>
      </div>
    </div>
  )
}
