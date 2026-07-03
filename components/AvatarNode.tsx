'use client'

import NextImage from 'next/image'
import { compactDisplayName, compactInitials, validAvatarInitials } from '../lib/bookingWidgetDomain'

export function shouldSkipImageOptimization(source: string | null | undefined) {
  const normalizedSource = source?.trim().toLowerCase() || ''
  return normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:') || /\.gif($|\?)/.test(normalizedSource)
}

export default function AvatarNode({
  failedAvatarUrls,
  fallback = 'Player',
  onFailedAvatarUrl,
  source,
}: {
  failedAvatarUrls: Set<string>
  fallback?: string
  onFailedAvatarUrl: (source: string | null | undefined) => void
  source: {
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    display_name?: string | null
    full_name?: string | null
    nickname?: string | null
  } | null | undefined
}) {
  const label = compactDisplayName(source?.display_name || source?.nickname || source?.full_name, fallback)
  const initials = validAvatarInitials(source?.avatar_initials)
  const avatarUrl = source?.avatar_url?.trim() || ''

  if (avatarUrl && !failedAvatarUrls.has(avatarUrl)) {
    return (
      <span
        className="avatar-photo"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 999,
        }}
      >
        <NextImage
          src={avatarUrl}
          alt=""
          fill
          sizes="96px"
          unoptimized={shouldSkipImageOptimization(avatarUrl)}
          onError={() => onFailedAvatarUrl(avatarUrl)}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            borderRadius: 999,
          }}
        />
      </span>
    )
  }

  if (source?.avatar_emoji) return <span className="avatar-emoji">{source.avatar_emoji}</span>
  if (initials) return <span className="avatar-text">{initials}</span>
  return <span className="avatar-text">{compactInitials(label || fallback)}</span>
}
