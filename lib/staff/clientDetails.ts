import type { StaffProfile } from './types'

export const clientDetailFields = ['full_name', 'nickname', 'phone', 'email', 'birthday', 'gender', 'profile_motto', 'avatar_url', 'avatar_emoji', 'avatar_initials', 'avatar_color', 'avatar_text_color'] as const
export type ClientDetails = Record<typeof clientDetailFields[number], string> & { anonymous_mode: boolean }
export function clientDetails(profile: StaffProfile): ClientDetails {
  return { ...Object.fromEntries(clientDetailFields.map((key) => [key, profile[key] || ''])), anonymous_mode: Boolean(profile.anonymous_mode) } as ClientDetails
}
