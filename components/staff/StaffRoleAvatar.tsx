'use client'

import NextImage from 'next/image'
import { useState } from 'react'
import type { StaffConsoleCopy } from '../../lib/staff/copy.ts'
import { customerName, shouldSkipStaffImageOptimization, staffRoleAvatarInitials } from '../../lib/staff/profiles.ts'
import type { StaffProfile } from '../../lib/staff/types.ts'
import { vrenaPalette } from '../../lib/theme/vrenaPalette.ts'

export function StaffRoleAvatar({ profile, text }: { profile: StaffProfile; text: StaffConsoleCopy }) {
  const [failedImageUrl, setFailedImageUrl] = useState('')
  const name = customerName(profile, text)
  const imageUrl = profile.anonymous_mode ? '' : profile.avatar_url?.trim() || ''
  const shouldUseImage = Boolean(imageUrl && failedImageUrl !== imageUrl)
  const emoji = profile.anonymous_mode ? '🎭' : profile.avatar_emoji?.trim()
  const initials = profile.anonymous_mode || profile.avatar_initials?.trim() === '?' ? '' : profile.avatar_initials?.trim()
  const style = {
    background: profile.anonymous_mode ? vrenaPalette.neutral[950] : profile.avatar_color || vrenaPalette.purple[500],
    color: profile.anonymous_mode ? vrenaPalette.white : profile.avatar_text_color || vrenaPalette.white,
  }

  return (
    <span aria-hidden="true" className="player-avatar staff-role-avatar" style={style}>
      {shouldUseImage ? (
        <span
          className="avatar-photo"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <NextImage
            alt=""
            fill
            loading="lazy"
            sizes="64px"
            src={imageUrl}
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            unoptimized={shouldSkipStaffImageOptimization(imageUrl)}
            onError={() => setFailedImageUrl(imageUrl)}
          />
        </span>
      ) : (
        <span className={emoji ? 'avatar-emoji' : 'avatar-text'}>
          {emoji || staffRoleAvatarInitials(initials || name)}
        </span>
      )}
    </span>
  )
}
