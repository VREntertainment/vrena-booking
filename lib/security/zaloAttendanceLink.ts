import type { SupabaseClient } from '@supabase/supabase-js'

type ZaloIdentity = {
  id: string
  staff_profile_id: string
  zalo_app_user_id: string
  revoked_at: string | null
}


export async function linkZaloIdentity(
  adminClient: SupabaseClient,
  employee: { profile_id: string },
  zaloProfile: { id: string },
  phone: string,
) {
  const [byUserResult, byEmployeeResult] = await Promise.all([
    adminClient
      .from('staff_zalo_identities')
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .eq('zalo_app_user_id', zaloProfile.id)
      .maybeSingle(),
    adminClient
      .from('staff_zalo_identities')
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .eq('staff_profile_id', employee.profile_id)
      .maybeSingle(),
  ])

  if (byUserResult.error || byEmployeeResult.error) {
    throw new Error('The employee link could not be checked.')
  }

  const byUser = byUserResult.data as ZaloIdentity | null
  const byEmployee = byEmployeeResult.data as ZaloIdentity | null

  if (byUser && byUser.staff_profile_id !== employee.profile_id) {
    throw new Error('This Zalo account is already linked to another employee.')
  }
  if (byEmployee && byEmployee.zalo_app_user_id !== zaloProfile.id) {
    throw new Error('This employee is already linked to another Zalo account. Ask a manager to reset it.')
  }

  if (byUser?.revoked_at || byEmployee?.revoked_at) {
    throw new Error('This employee link has been revoked. Ask a manager to restore access.')
  }

  const now = new Date().toISOString()
  const values = {
    staff_profile_id: employee.profile_id,
    zalo_app_user_id: zaloProfile.id,
    verified_phone_last_four: phone.slice(-4),
    linked_at: now,
    last_verified_at: now,
    last_seen_at: now,
  }

  let identity: ZaloIdentity | null = null
  if (byUser || byEmployee) {
    const existing = byUser || byEmployee
    const { data, error } = await adminClient
      .from('staff_zalo_identities')
      .update(values)
      .eq('id', existing!.id)
      .is('revoked_at', null)
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .single()
    if (error) throw new Error('The Zalo account could not be linked.')
    identity = data as ZaloIdentity
  } else {
    const { data, error } = await adminClient
      .from('staff_zalo_identities')
      .insert(values)
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .single()
    if (error) throw new Error('The Zalo account could not be linked.')
    identity = data as ZaloIdentity
  }

  const { error: eventError } = await adminClient
    .from('staff_zalo_attendance_events')
    .insert({
      identity_id: identity.id,
      staff_profile_id: employee.profile_id,
      event_type: 'link',
      event_payload: { phone_last_four: phone.slice(-4) },
    })
  if (eventError) throw new Error('The Zalo account was linked, but its audit event could not be recorded.')

  return identity
}

