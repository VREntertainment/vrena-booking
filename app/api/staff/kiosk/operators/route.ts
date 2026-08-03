import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  loadStaffKioskOperatorDirectory,
  STAFF_KIOSK_EMAIL,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  const email = auth.user.email?.toLowerCase() || ''
  if (email !== STAFF_KIOSK_EMAIL) {
    try {
      if (await staffKioskCurrentRank(auth) < 100) return staffKioskJsonError('Administrator access required.', 403)
    } catch (error) {
      return staffKioskJsonError(error instanceof Error ? error.message : 'Could not verify staff access.', 500)
    }
  }

  try {
    const operators = await loadStaffKioskOperatorDirectory(auth.adminClient)
    return Response.json({ operators }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return staffKioskJsonError(error instanceof Error ? error.message : 'Could not load employee access.', 500)
  }
}
