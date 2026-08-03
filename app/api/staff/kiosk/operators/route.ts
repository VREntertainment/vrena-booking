import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  loadStaffKioskOperatorDirectory,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'
import { requiresStaffKioskPin } from '@/lib/staffKioskScope'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  if (!requiresStaffKioskPin(auth.user.email)) {
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
