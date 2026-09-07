'use client'

import { useMemo } from 'react'
import type { StaffConsoleCopy } from '../../lib/staff/copy.ts'
import { customerName, customerSearchText, isDemoProfile, normalizeStaffSearchValue } from '../../lib/staff/profiles.ts'
import type { StaffProfile } from '../../lib/staff/types.ts'

export function StaffOperationPlayerSearch({
  disabled,
  onQueryChange,
  onSelect,
  profiles,
  query,
  selectedProfileId,
  text,
}: {
  disabled: boolean
  onQueryChange: (value: string) => void
  onSelect: (profile: StaffProfile | null) => void
  profiles: StaffProfile[]
  query: string
  selectedProfileId: string
  text: StaffConsoleCopy
}) {
  const selectedProfile = selectedProfileId ? profiles.find((profile) => profile.id === selectedProfileId) || null : null
  const normalizedQuery = normalizeStaffSearchValue(query.trim())
  const suggestions = useMemo(() => {
    if (normalizedQuery.length < 1) return []

    return profiles
      .filter((profile) => !isDemoProfile(profile) && customerSearchText(profile, text).includes(normalizedQuery))
      .sort((left, right) => {
        const leftName = normalizeStaffSearchValue(customerName(left, text))
        const rightName = normalizeStaffSearchValue(customerName(right, text))
        const leftStarts = leftName.startsWith(normalizedQuery) ? 0 : 1
        const rightStarts = rightName.startsWith(normalizedQuery) ? 0 : 1
        return leftStarts - rightStarts
          || leftName.localeCompare(rightName)
          || (left.phone || '').localeCompare(right.phone || '')
          || (left.email || '').localeCompare(right.email || '')
      })
      .slice(0, 10)
  }, [normalizedQuery, profiles, text])

  return (
    <div className="staff-operation-add-player-picker">
      <input
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => {
          const nextValue = event.target.value
          onQueryChange(nextValue)
          if (selectedProfile && nextValue !== customerName(selectedProfile, text)) onSelect(null)
        }}
        placeholder={text.labels.customerProfile}
        type="search"
        value={query}
      />
      {normalizedQuery.length >= 1 && (
        <div className="staff-operation-player-results" role="listbox">
          {suggestions.map((profile) => {
            const isSelected = profile.id === selectedProfileId
            return (
              <button
                aria-selected={isSelected}
                className="staff-operation-player-result"
                key={profile.id}
                onClick={() => {
                  onSelect(profile)
                  onQueryChange(customerName(profile, text))
                }}
                role="option"
                type="button"
              >
                <span>{customerName(profile, text)}</span>
                <small>{[profile.phone, profile.email].filter(Boolean).join(' · ') || profile.profile_motto || text.noContact}</small>
              </button>
            )
          })}
          {suggestions.length === 0 && <p className="staff-operation-player-empty">{text.noUsersFound}</p>}
        </div>
      )}
    </div>
  )
}
