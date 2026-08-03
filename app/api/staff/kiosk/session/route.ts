import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  staffKioskJsonError,
  staffKioskTokenHash,
} from '@/lib/security/staffKioskServer'
import { requiresStaffKioskPin } from '@/lib/staffKioskScope'

export const runtime = 'nodejs'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth
  if (!requiresStaffKioskPin(auth.user.email)) {
    return staffKioskJsonError('The shared store login is required.', 403)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return staffKioskJsonError('Invalid employee PIN.', 400)
  }

  const profileId = cleanString(body.profileId)
  const pin = cleanString(body.pin)
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || !/^\d{4}$/.test(pin)) {
    return staffKioskJsonError('Enter your four-digit PIN.', 400)
  }

  const operatorToken = randomBytes(32).toString('base64url')
  const userAgentHash = createHash('sha256').update(request.headers.get('user-agent') || 'unknown').digest('hex')
  const { data, error } = await auth.adminClient.rpc('staff_kiosk_verify_pin', {
    p_actor_user_id: auth.user.id,
    p_pin: pin,
    p_profile_id: profileId,
    p_token_hash: staffKioskTokenHash(operatorToken),
    p_user_agent_hash: userAgentHash,
  })
  if (error) return staffKioskJsonError(error.message, 400)

  const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  if (result.ok !== true) {
    const reason = cleanString(result.reason)
    const errorMessage = reason === 'locked'
      ? 'Too many incorrect attempts. Try again in 15 minutes.'
      : reason === 'unavailable'
        ? 'This employee PIN is not available.'
        : 'Incorrect PIN.'
    return Response.json({
      error: errorMessage,
      attemptsRemaining: typeof result.attempts_remaining === 'number' ? result.attempts_remaining : null,
      lockedUntil: result.locked_until || null,
    }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  return Response.json({ operator: result, operatorToken }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth
  if (!requiresStaffKioskPin(auth.user.email) || !auth.operatorTokenHash) {
    return staffKioskJsonError('Employee PIN required.', 401)
  }

  const { data, error } = await auth.adminClient.rpc('staff_kiosk_touch_session', {
    p_actor_user_id: auth.user.id,
    p_token_hash: auth.operatorTokenHash,
  })
  if (error) return staffKioskJsonError(error.message, 400)
  if (data !== true) return staffKioskJsonError('Employee session expired.', 401)
  return Response.json({ active: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth
  if (!requiresStaffKioskPin(auth.user.email) || !auth.operatorTokenHash) {
    return Response.json({ locked: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  let reason = 'locked'
  try {
    const body = await request.json() as Record<string, unknown>
    reason = cleanString(body.reason).slice(0, 80) || reason
  } catch {
    // A lock request does not require a JSON body.
  }

  const { error } = await auth.adminClient.rpc('staff_kiosk_revoke_session', {
    p_actor_user_id: auth.user.id,
    p_reason: reason,
    p_token_hash: auth.operatorTokenHash,
  })
  if (error) return staffKioskJsonError(error.message, 400)
  return Response.json({ locked: true }, { headers: { 'Cache-Control': 'no-store' } })
}
