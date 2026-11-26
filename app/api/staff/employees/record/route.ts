import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'
import { canConfigureStaffKioskPin, canRevealStaffKioskPin } from '@/lib/staffKioskScope'

const headers = { 'Cache-Control': 'no-store, private' }
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  const { adminClient, user } = auth
  const [rank, profile] = await Promise.all([
    staffKioskCurrentRank(auth),
    adminClient.from('profiles').select('role').eq('id', user.id).is('deleted_at', null).maybeSingle(),
  ])
  if (profile.error) return staffKioskJsonError('Could not verify employee access permissions.', 500)
  if (!canRevealStaffKioskPin(user.email, profile.data?.role, rank)) {
    return staffKioskJsonError('Employee access administration required.', 403)
  }

  const [employees, locations, assignments] = await Promise.all([
    adminClient.from('staff_employee_profiles')
      .select('profile_id,legal_name,department,contract_end_date,kiosk_access_role,kiosk_pin_configured_at,kiosk_staff_access_granted')
      .eq('active', true).is('deleted_at', null).order('legal_name'),
    adminClient.from('staff_locations').select('venue_key,name').eq('active', true).order('name'),
    adminClient.from('staff_employee_locations').select('profile_id,venue_key'),
  ])
  if (employees.error || locations.error || assignments.error) {
    return staffKioskJsonError('Could not load employee access.', 500)
  }

  return Response.json({
    canEdit: canConfigureStaffKioskPin(user.email, rank),
    locations: locations.data,
    employees: employees.data
      .filter((employee) => !['gc', 'gong cha'].includes(employee.department?.trim().toLowerCase()))
      .map((employee) => ({
        id: employee.profile_id,
        name: employee.legal_name || '',
        contractEnd: employee.contract_end_date || '',
        role: employee.kiosk_access_role === 'manager' ? 'manager' : 'staff',
        pinConfigured: Boolean(employee.kiosk_pin_configured_at),
        staffOnly: employee.kiosk_staff_access_granted,
        venues: assignments.data.filter((row) => row.profile_id === employee.profile_id).map((row) => row.venue_key),
      })),
  }, { headers })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth
  const rank = await staffKioskCurrentRank(auth)
  if (!canConfigureStaffKioskPin(auth.user.email, rank)) {
    return staffKioskJsonError('Sign in with an individual Owner or Admin account.', 403)
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120
    || (body.id !== null && (typeof body.id !== 'string' || !uuid.test(body.id)))
    || typeof body.contractEnd !== 'string' || (body.contractEnd && !/^\d{4}-\d{2}-\d{2}$/.test(body.contractEnd))
    || !['manager', 'staff'].includes(body.role)
    || !Array.isArray(body.venues) || !body.venues.every((venue: unknown) => typeof venue === 'string')
    || typeof body.pin !== 'string' || ((!body.id || body.pin) && !/^\d{6}$/.test(body.pin))) {
    return staffKioskJsonError('Check the name, contract end date, store selection, access level and PIN.', 400)
  }

  const { data, error } = await auth.adminClient.rpc('staff_save_store_access', {
    actor_id: auth.user.id,
    employee_id: body.id,
    employee_name: body.name.trim(),
    contract_end: body.contractEnd || null,
    access_level: body.role,
    venues: body.venues,
    new_pin: body.pin || null,
  })
  if (error) return staffKioskJsonError(error.message, 400)
  return Response.json({ id: data }, { headers })
}
