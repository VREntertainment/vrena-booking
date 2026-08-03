import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  loadStaffKioskOperatorDirectory,
  STAFF_KIOSK_EMAIL,
  staffKioskCurrentActorProfileId,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'

export const runtime = 'nodejs'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return staffKioskJsonError('Invalid PIN settings.', 400)
  }

  const profileId = cleanString(body.profileId)
  const pin = cleanString(body.pin)
  const accessRole = cleanString(body.accessRole)
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return staffKioskJsonError('Choose an employee HR file.', 400)
  if (!/^\d{4}$/.test(pin)) return staffKioskJsonError('PIN must contain exactly four digits.', 400)
  if (accessRole !== 'manager' && accessRole !== 'staff') return staffKioskJsonError('Choose Manager or Staff access.', 400)

  try {
    const email = auth.user.email?.toLowerCase() || ''
    const directory = await loadStaffKioskOperatorDirectory(auth.adminClient)
    const hasConfiguredPin = directory.some((operator) => operator.pinConfigured)
    let actorProfileId: string | null = auth.user.id

    if (email === STAFF_KIOSK_EMAIL) {
      if (hasConfiguredPin) {
        const rank = await staffKioskCurrentRank(auth)
        if (rank < 80) return staffKioskJsonError('Manager PIN required.', 403)
        actorProfileId = await staffKioskCurrentActorProfileId(auth)
      } else {
        actorProfileId = null
      }
    } else if (await staffKioskCurrentRank(auth) < 100) {
      return staffKioskJsonError('Administrator access required.', 403)
    }

    const { data, error } = await auth.adminClient.rpc('staff_kiosk_configure_pin', {
      p_access_role: accessRole,
      p_actor_profile_id: actorProfileId,
      p_actor_user_id: auth.user.id,
      p_operator_token_hash: auth.operatorTokenHash || null,
      p_pin: pin,
      p_profile_id: profileId,
    })
    if (error) return staffKioskJsonError(error.message, 400)

    return Response.json({ operator: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return staffKioskJsonError(error instanceof Error ? error.message : 'Could not save employee PIN.', 500)
  }
}
