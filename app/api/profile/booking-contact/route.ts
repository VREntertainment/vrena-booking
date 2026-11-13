import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { needsBookingEmail } from '@/lib/bookingAccountContact'
import { validateGuestTicketContact } from '@/lib/guestTicketBooking'
import { isSameOriginRequest } from '@/lib/security/requestOrigin'
import { isStaffAdminEmail } from '@/lib/staffRoles'

export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  const fail = (message: string, status: number) => reply({ error: { message } }, status)
  if (!isSameOriginRequest(request.headers, request.nextUrl.origin)) return fail('Same-origin request required.', 403)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return fail('Please sign in again. Your booking selections are still here.', 401)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return fail('Contact updates are temporarily unavailable. Please try again.', 503)
  const options = { auth: { autoRefreshToken: false, persistSession: false } }
  const auth = createClient(url, anonKey, options)
  const { data: { user }, error: authError } = await auth.auth.getUser(token)
  if (authError || !user || user.is_anonymous) return fail('Please sign in again. Your booking selections are still here.', 401)
  let body: { phone?: unknown; email?: unknown }
  try {
    const raw = await request.text()
    if (raw.length > 2048) return fail('Contact details are too long.', 413)
    body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body')
  } catch { return fail('Invalid contact details.', 400) }
  const admin = createClient(url, serviceKey, options)
  // Email is protected on profiles. This endpoint only fills missing contact details
  // on the authenticated caller; it never changes login credentials or privileges.
  const { data: profile, error } = await admin.from('profiles').select('phone,email').eq('id', user.id).single()
  if (error || !profile) return fail('Could not load your account. Please try again.', 400)
  const updates: { phone?: string; email?: string } = {}
  const phoneText = { phoneRequired: 'Phone number is required.', guestTicketPhoneInvalid: 'Enter a valid phone number.' }
  if (validateGuestTicketContact({ name: '', phone: profile.phone || '' }, phoneText).error) {
    if (typeof body.phone !== 'string') return fail(phoneText.phoneRequired, 400)
    const phone = validateGuestTicketContact({ name: '', phone: body.phone }, phoneText)
    if (phone.error) return fail(phone.error, 400)
    updates.phone = phone.normalizedPhone
  }
  if (needsBookingEmail(profile.email)) {
    if (typeof body.email !== 'string' || needsBookingEmail(body.email)) return fail('Enter a valid email address.', 400)
    const email = body.email.trim().toLowerCase()
    // Several existing authorization paths recognize privileged email addresses.
    if (isStaffAdminEmail(email) || email === 'contact@vre-vietnam.com') return fail('Please use your personal contact email.', 400)
    updates.email = email
  }
  if (!Object.keys(updates).length) return reply({ data: profile })
  // Compare both old values so a stale checkout cannot replace a concurrent edit.
  let query = admin.from('profiles').update(updates).eq('id', user.id)
  query = profile.email === null ? query.is('email', null) : query.eq('email', profile.email)
  query = profile.phone === null ? query.is('phone', null) : query.eq('phone', profile.phone)
  const saved = await query.select('phone,email').single()
  if (saved.error || !saved.data) return fail('Could not save your contact details. Check they are not already linked to another account, then try again.', 409)
  return reply({ data: saved.data })
}
