import { getAccessToken, getPhoneNumber } from 'zmp-sdk'

export type AttendanceLog = {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  break_minutes: number
  status: 'present' | 'late' | 'absent' | 'no_show' | 'leave' | 'holiday'
  regular_minutes: number
  overtime_minutes: number
  night_minutes: number
}

export type AttendanceShift = {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  break_minutes: number
  location: string
  shift_role: string
  status: string
}

export type AttendanceStatus = {
  linked: boolean
  serverTime: string
  workDate?: string
  message?: string
  employee?: {
    displayName: string
    employeeCode: string | null
    jobTitle: string | null
    location: string | null
  }
  shifts?: AttendanceShift[]
  attendanceLog?: AttendanceLog | null
  canClockIn?: boolean
  canClockOut?: boolean
}

type AttendanceAction = 'status' | 'link' | 'clock_in' | 'clock_out'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://vrena-booking.vercel.app').replace(/\/$/, '')

async function apiRequest(action: AttendanceAction, phoneToken?: string) {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Zalo could not start a secure employee session.')

  const response = await fetch(`${apiBaseUrl}/api/zalo/attendance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, phoneToken }),
  })
  const payload = await response.json().catch(() => null) as (AttendanceStatus & { error?: string }) | null

  if (!response.ok || !payload) {
    throw new Error(payload?.error || 'Không thể kết nối hệ thống chấm công. / Attendance is unavailable.')
  }

  return payload
}

export function loadAttendanceStatus() {
  return apiRequest('status')
}

export async function linkEmployeeProfile() {
  const { token } = await getPhoneNumber()
  if (!token) throw new Error('Zalo did not return a phone verification token.')
  return apiRequest('link', token)
}

export function clockIn() {
  return apiRequest('clock_in')
}

export function clockOut() {
  return apiRequest('clock_out')
}
