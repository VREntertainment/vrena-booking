import { NextRequest, NextResponse } from 'next/server'
import { authenticateStaffKioskRequest, staffKioskCurrentActorProfileId, staffKioskCurrentRank, staffKioskCurrentSessionId } from '@/lib/security/staffKioskServer'

export const runtime = 'nodejs'

const profileGenderValues = ['male', 'female', 'non_binary', 'prefer_not_to_say', 'self_describe'] as const
const profileSelect = 'id, phone, full_name, nickname, email, birthday, gender, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role, score_adjustment, loyalty_points_total, total_projectiles_override, anonymous_mode, anonymous_callsign, marketing_consent, marketing_consent_at, marketing_opted_out_at'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanNullableString(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned) return null
  return Array.from(cleaned).slice(0, maxLength).join('')
}

function cleanRequiredString(value: unknown, maxLength = 255) {
  return cleanNullableString(value, maxLength) || ''
}

function cleanBirthday(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return value
}

function cleanGender(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && profileGenderValues.includes(value as typeof profileGenderValues[number])) return value
  return undefined
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth
  const actorRank = await staffKioskCurrentRank(auth)
  if (actorRank < 50) return jsonError('Staff access required.', 403)
  const adminClient = auth.adminClient
  const actorProfileId = await staffKioskCurrentActorProfileId(auth) || auth.user.id
  const operatorSessionId = await staffKioskCurrentSessionId(auth)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid customer profile payload.', 400)
  }

  const profileId = cleanRequiredString(body.profileId)
  if (!profileId) return jsonError('Profile id is required.', 400)

  const fullName = cleanRequiredString(body.fullName, 120)
  if (!fullName) return jsonError('Enter the customer name.', 400)

  const birthday = cleanBirthday(body.birthday)
  if (birthday === undefined) return jsonError('Birthday must use YYYY-MM-DD.', 400)

  const gender = cleanGender(body.gender)
  if (gender === undefined) return jsonError('Choose a valid gender value.', 400)

  const updates = {
    full_name: fullName,
    nickname: cleanNullableString(body.nickname, 80),
    phone: cleanNullableString(body.phone, 40),
    birthday,
    gender,
    profile_motto: cleanNullableString(body.profileMotto, 20),
    updated_at: new Date().toISOString(),
  }

  const { data: updatedProfile, error: updateError } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .is('deleted_at', null)
    .select(profileSelect)
    .single()

  if (updateError) return jsonError(updateError.message, 500)

  const { error: auditError } = await adminClient.from('audit_logs').insert({
    actor_user_id: actorProfileId,
    auth_user_id: auth.user.id,
    operator_session_id: operatorSessionId,
    operator_role: operatorSessionId ? (actorRank >= 80 ? 'manager' : 'staff') : null,
    action: 'customer_profile_updated',
    entity_type: 'profiles',
    entity_id: profileId,
    new_value: updates,
  })
  if (auditError) return jsonError(auditError.message, 500)

  return NextResponse.json({ profile: updatedProfile })
}
