import type { NextRequest } from 'next/server'
import {
  ACCOUNTANT_PAYROLL_EXPORT_MAX_BYTES,
  accountantPayrollContentDisposition,
  accountantPayrollFilename,
  validateAccountantPayrollExportInput,
} from '@/lib/accountantPayrollExport'
import { trustedClientIp } from '@/lib/security/requestIp'
import {
  authenticateStaffKioskRequest,
  STAFF_KIOSK_HEADER,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'

export const runtime = 'nodejs'

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Could not create the accountant payroll workbook.'
}

function formString(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

function forwardedOrigin(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .split(',')[0]
    .trim()
  const protocol = (request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', ''))
    .split(',')[0]
    .trim()
  return host ? `${protocol}://${host}` : new URL(request.url).origin
}

export async function POST(request: NextRequest) {
  const requestOrigin = forwardedOrigin(request)
  if (request.headers.get('origin') !== requestOrigin) {
    return staffKioskJsonError('Invalid payroll export origin.', 403)
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > ACCOUNTANT_PAYROLL_EXPORT_MAX_BYTES) {
    return staffKioskJsonError('The payroll export is too large.', 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return staffKioskJsonError('Invalid payroll export request.', 400)
  }

  const accessToken = formString(form, 'access_token').trim()
  const operatorToken = formString(form, 'operator_token').trim()
  const payloadText = formString(form, 'payload')
  if (payloadText.length > ACCOUNTANT_PAYROLL_EXPORT_MAX_BYTES) {
    return staffKioskJsonError('The payroll export is too large.', 413)
  }

  const authHeaders = new Headers(request.headers)
  authHeaders.set('authorization', `Bearer ${accessToken}`)
  if (operatorToken) authHeaders.set(STAFF_KIOSK_HEADER, operatorToken)
  const authRequest = new Request(request.url, { headers: authHeaders }) as NextRequest
  const auth = await authenticateStaffKioskRequest(authRequest)
  if (auth instanceof Response) return auth

  try {
    if (await staffKioskCurrentRank(auth) < 20) {
      return staffKioskJsonError('HR access required.', 403)
    }

    const { error: rateLimitError } = await auth.adminClient.rpc('consume_rate_limit', {
      p_action: 'payroll_excel_export',
      p_limit: 6,
      p_window_seconds: 10 * 60,
      p_subject: `staff:${auth.user.id}:ip:${trustedClientIp(request.headers)}`,
    })
    if (rateLimitError) return staffKioskJsonError(rateLimitError.message, 429)

    let rawInput: unknown
    try {
      rawInput = JSON.parse(payloadText)
    } catch {
      return staffKioskJsonError('Invalid accountant payroll export data.', 400)
    }
    const input = validateAccountantPayrollExportInput(rawInput)

    const templateUrl = new URL('/templates/vr-payroll-accountant-template.xlsx', request.url)
    const templateResponse = await fetch(templateUrl, { cache: 'no-store' })
    if (!templateResponse.ok) {
      throw new Error(`Unable to load accountant payroll template (${templateResponse.status}).`)
    }

    const [{ buildAccountantPayrollWorkbook }, templateBuffer] = await Promise.all([
      import('@/lib/accountantPayrollWorkbook'),
      templateResponse.arrayBuffer(),
    ])
    const workbook = buildAccountantPayrollWorkbook(new Uint8Array(templateBuffer), input)
    const filename = accountantPayrollFilename(formString(form, 'filename'))
    const body = Uint8Array.from(workbook).buffer

    return new Response(body, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': accountantPayrollContentDisposition(filename),
        'Content-Type': XLSX_CONTENT_TYPE,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return staffKioskJsonError(errorMessage(error), 500)
  }
}
