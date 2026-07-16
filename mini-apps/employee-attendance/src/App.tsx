import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clockIn,
  clockOut,
  linkEmployeeProfile,
  loadAttendanceStatus,
  type AttendanceStatus,
} from './api'

const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function shortTime(value: string | null | undefined) {
  if (!value) return '--:--'
  return timeFormatter.format(new Date(value)).slice(0, 5)
}

function shiftTime(value: string) {
  return value.slice(0, 5)
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${String(remainder).padStart(2, '0')}m`
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Vui lòng mở Mini App trong Zalo để tiếp tục. / Please open this Mini App in Zalo.'
}

export default function App() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(() => new Date())

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      setStatus(await loadAttendanceStatus())
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(initialRefresh)
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const workedMinutes = useMemo(() => {
    const log = status?.attendanceLog
    if (!log?.clock_in_at) return 0
    const end = log.clock_out_at ? new Date(log.clock_out_at).getTime() : now.getTime()
    const elapsed = Math.max(0, Math.floor((end - new Date(log.clock_in_at).getTime()) / 60_000))
    return Math.max(0, elapsed - (log.break_minutes || 0))
  }, [now, status?.attendanceLog])

  async function runAction(action: 'link' | 'clock_in' | 'clock_out') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const nextStatus = action === 'link'
        ? await linkEmployeeProfile()
        : action === 'clock_in'
          ? await clockIn(status?.locationRequired !== false)
          : await clockOut(status?.locationRequired !== false)
      setStatus(nextStatus)
      setNotice(action === 'link'
        ? 'Đã liên kết hồ sơ nhân viên. / Employee linked.'
        : action === 'clock_in'
          ? 'Đã ghi nhận giờ vào ca. / Clock-in recorded.'
          : 'Đã ghi nhận giờ ra ca. / Clock-out recorded.')
    } catch (actionError) {
      setError(errorMessage(actionError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="attendance-app">
      <header className="hero">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">VR</div>
          <div>
            <span className="eyebrow">VRE HUB · EMPLOYEE</span>
            <h1>Chấm công</h1>
            <p>Employee attendance</p>
          </div>
        </div>
        <div className="clock-card" aria-live="polite">
          <strong>{timeFormatter.format(now)}</strong>
          <span>{dateFormatter.format(now)}</span>
        </div>
      </header>

      <section className="content" aria-busy={busy}>
        {error && <div className="message error-message" role="alert">{error}</div>}
        {notice && <div className="message success-message" role="status">{notice}</div>}

        {busy && !status ? (
          <div className="loading-card">
            <span className="spinner" aria-hidden="true" />
            <strong>Đang xác thực với Zalo…</strong>
            <small>Verifying your employee session</small>
          </div>
        ) : !status?.linked ? (
          <div className="link-card">
            <div className="link-icon" aria-hidden="true">✓</div>
            <h2>Liên kết hồ sơ nhân viên</h2>
            <p>
              VRE HUB sẽ dùng số điện thoại Zalo một lần để tìm đúng hồ sơ nhân viên đang hoạt động.
            </p>
            <p className="english-copy">
              Your Zalo phone number is verified once to find your active employee record. It is not added as a new attendance field.
            </p>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void runAction('link')}>
              {busy ? 'Đang liên kết…' : 'Xác minh và liên kết'}
              <span>Verify & link</span>
            </button>
          </div>
        ) : (
          <>
            <article className="employee-card">
              <div className="employee-avatar" aria-hidden="true">
                {status.employee?.displayName?.charAt(0).toUpperCase() || 'V'}
              </div>
              <div>
                <span className="eyebrow">HỒ SƠ ĐÃ XÁC MINH</span>
                <h2>{status.employee?.displayName}</h2>
                <p>
                  {[status.employee?.employeeCode, status.employee?.jobTitle].filter(Boolean).join(' · ') || 'VRena employee'}
                </p>
              </div>
              <span className="verified-badge">Zalo ✓</span>
            </article>

            <article className={`attendance-state ${status.canClockOut ? 'is-active' : ''}`}>
              <div className="state-heading">
                <div>
                  <span className="eyebrow">TRẠNG THÁI HÔM NAY</span>
                  <h2>{status.canClockOut ? 'Đang trong ca' : status.attendanceLog?.clock_out_at ? 'Đã kết thúc ca' : 'Chưa vào ca'}</h2>
                </div>
                <span className="state-dot" aria-hidden="true" />
              </div>

              {status.allowTimesheet !== false && (
                <div className="time-grid">
                  <div>
                    <span>Vào ca / In</span>
                    <strong>{shortTime(status.attendanceLog?.clock_in_at)}</strong>
                  </div>
                  <div>
                    <span>Ra ca / Out</span>
                    <strong>{shortTime(status.attendanceLog?.clock_out_at)}</strong>
                  </div>
                  <div>
                    <span>Đã làm / Worked</span>
                    <strong>{durationLabel(workedMinutes)}</strong>
                  </div>
                </div>
              )}

              {status.attendanceLog?.status === 'late' && (
                <p className="late-note">Giờ vào ca được ghi nhận là trễ. / Clock-in recorded as late.</p>
              )}
            </article>

            {status.allowTimesheet !== false && <article className="schedule-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">LỊCH HÔM NAY</span>
                  <h2>Today&apos;s schedule</h2>
                </div>
                <span>{status.shifts?.length || 0} ca</span>
              </div>
              {status.shifts && status.shifts.length > 0 ? status.shifts.map((shift) => (
                <div className="shift-row" key={shift.id}>
                  <div className="shift-time">
                    <strong>{shiftTime(shift.start_time)}</strong>
                    <span>→</span>
                    <strong>{shiftTime(shift.end_time)}</strong>
                  </div>
                  <div>
                    <strong>{shift.shift_role}</strong>
                    <span>{shift.location}{shift.break_minutes > 0 ? ` · nghỉ ${shift.break_minutes}m` : ''}</span>
                  </div>
                </div>
              )) : (
                <p className="empty-state">Không có ca đã xuất bản hôm nay. / No published shift today.</p>
              )}
            </article>}

            <div className="action-panel">
              {status.locationRequired && (
                <p className="location-proof-note">
                  <span aria-hidden="true">⌖</span>
                  Vị trí GPS hiện tại sẽ được kiểm tra khi chấm công. / Current GPS location is checked for this action.
                </p>
              )}
              {status.canClockOut ? (
                <button className="primary-button clock-out" type="button" disabled={busy} onClick={() => void runAction('clock_out')}>
                  {busy ? 'Đang ghi nhận…' : 'Ra ca'}
                  <span>Clock out</span>
                </button>
              ) : (
                <button className="primary-button" type="button" disabled={busy || !status.canClockIn} onClick={() => void runAction('clock_in')}>
                  {busy ? 'Đang ghi nhận…' : 'Vào ca'}
                  <span>Clock in</span>
                </button>
              )}
              <button className="refresh-button" type="button" disabled={busy} onClick={() => void refresh()}>
                Làm mới / Refresh
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
