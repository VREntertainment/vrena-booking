'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'
import AppLoadingState from './AppLoadingState'
import '../app/staff/staff.css'

type Employee = {
  id: string | null
  name: string
  contractEnd: string
  role: 'manager' | 'staff'
  pinConfigured: boolean
  staffOnly: boolean
  venues: string[]
}

type Feedback = {
  tone: 'success' | 'info' | 'danger'
  message: string
}

type Directory = {
  canEdit: boolean
  employees: Employee[]
  locations: { venue_key: string; name: string }[]
}

const directoryUrl = '/api/staff/employees/record'

const emptyEmployee: Employee = {
  id: null, name: '', contractEnd: '', role: 'staff', pinConfigured: false, staffOnly: false, venues: [],
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Request failed.')
  return result
}

function generateEmployeePin() {
  const sample = new Uint32Array(1)
  const limit = 4_294_000_000
  do {
    crypto.getRandomValues(sample)
  } while (sample[0] >= limit)
  return String(sample[0] % 1_000_000).padStart(6, '0')
}

export default function StaffEmployeeAccess({ language }: { language: 'en' | 'vi' }) {
  const vi = language === 'vi'
  const [directory, setDirectory] = useState<Directory>()
  const [employee, setEmployee] = useState<Employee>(emptyEmployee)
  const [pin, setPin] = useState('')
  const [revealedPin, setRevealedPin] = useState('')
  const [feedback, setFeedback] = useState<Feedback>()
  const [fieldErrors, setFieldErrors] = useState({ name: false, pin: false })
  const [busy, setBusy] = useState(false)
  const [generatedPin, setGeneratedPin] = useState(false)

  const selectEmployee = useCallback((record: Employee) => {
    setEmployee(record)
    setPin(record.id ? '' : generateEmployeePin())
    setGeneratedPin(!record.id)
    setRevealedPin('')
    setFeedback(undefined)
    setFieldErrors({ name: false, pin: false })
  }, [])

  const load = useCallback(async (id?: string) => {
    const result = await request<Directory>(directoryUrl)
    setDirectory(result)
    selectEmployee(result.employees.find((record) => record.id === id) || result.employees[0] || emptyEmployee)
  }, [selectEmployee])

  useEffect(() => {
    let active = true
    request<Directory>(directoryUrl).then((result) => {
      if (!active) return
      setDirectory(result)
      selectEmployee(result.employees[0] || emptyEmployee)
    }).catch((error: Error) => {
      if (active) setFeedback({ tone: 'danger', message: error.message })
    })
    return () => { active = false }
  }, [selectEmployee])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!employee.name.trim()) {
      setFieldErrors((errors) => ({ ...errors, name: true }))
      event.currentTarget.querySelector<HTMLInputElement>('#hr-full-name')?.focus()
      return
    }
    setBusy(true)
    setFeedback(undefined)
    setFieldErrors({ name: false, pin: false })
    try {
      const saved = await request<{ id: string }>(directoryUrl, {
        method: 'POST',
        body: JSON.stringify({ ...employee, pin }),
      })
      setPin('')
      setGeneratedPin(false)
      setRevealedPin('')
      await load(saved.id)
      window.dispatchEvent(new Event('staff-locations-updated'))
      setFeedback({ tone: 'success', message: vi ? 'Đã lưu quyền truy cập.' : 'Employee access saved.' })
    } catch (error) {
      setFeedback({ tone: 'danger', message: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function reveal() {
    if (!employee.id) return
    setBusy(true)
    setFeedback(undefined)
    try {
      const result = await request<{ pin: string | null }>(`/api/staff/kiosk/pin?profileId=${employee.id}`)
      setRevealedPin(result.pin || '')
      if (!result.pin) setFeedback({ tone: 'info', message: vi ? 'Chưa có mã PIN.' : 'PIN unavailable.' })
    } catch (error) {
      setFeedback({ tone: 'danger', message: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const locations = directory?.locations ?? []
  const employees = directory?.employees ?? []
  const groups = [
    ...locations.map((venue) => ({
      key: venue.venue_key,
      name: venue.name,
      records: employees.filter((record) => record.venues.includes(venue.venue_key)),
    })),
    {
      key: 'unassigned',
      name: vi ? 'Chưa được phân cửa hàng' : 'No active venue',
      records: employees.filter((record) => !locations.some((venue) => record.venues.includes(venue.venue_key))),
    },
  ].filter((group) => group.records.length > 0)
  const selectedGroup = groups.find((group) => group.records.some((record) => record.id === employee.id))
  const { name: nameError, pin: pinError } = fieldErrors

  return (
    <section className="section staff-console hr-access" data-testid="staff-console" aria-labelledby="hr-access-title">
      <header className="hr-access-header">
        <div>
          <h2 id="hr-access-title">{vi ? 'Quyền truy cập của nhân viên' : 'Employee Access'}</h2>
          <p>{vi ? 'Quản lý cửa hàng, quyền truy cập và mã PIN của nhân viên.' : 'Manage employee venue assignments, access levels, and PINs.'}</p>
        </div>
        {directory?.canEdit && (
          <button type="button" className="secondary" disabled={busy} onClick={() => {
            if (employee.id) selectEmployee(emptyEmployee)
            requestAnimationFrame(() => document.getElementById('hr-full-name')?.focus())
          }}>
            {vi ? 'Thêm nhân viên' : 'Add employee'}
          </button>
        )}
      </header>

      {!directory && !feedback && <AppLoadingState compact label={vi ? 'Đang tải nhân viên…' : 'Loading employees…'} />}
      {!directory && feedback && <p className="hr-access-feedback" data-tone={feedback.tone} role="alert">{feedback.message}</p>}

      {directory && (
        <div className="hr-access-layout">
          <aside className="hr-access-panel hr-access-directory" aria-labelledby="hr-directory-title">
            <h3 id="hr-directory-title">{vi ? 'Nhân viên theo cửa hàng' : 'Employees by venue'}</h3>
            {groups.length === 0 ? (
              <p>{vi ? 'Chưa có nhân viên.' : 'No employees yet.'}</p>
            ) : (
              <>
                <div className="hr-access-roster">
                  {groups.map((group) => (
                    <div className="hr-access-roster-group" key={group.key}>
                      <h4>{group.name}</h4>
                      <ul>
                        {group.records.map((record) => (
                          <li key={record.id}>
                            <button type="button" disabled={busy} aria-current={record.id === employee.id || undefined}
                              onClick={() => { if (record.id !== employee.id) selectEmployee(record) }}>
                              {record.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <label className="hr-access-field hr-access-picker">
                  <span>{vi ? 'Nhân viên' : 'Employee'}</span>
                  <select disabled={busy} value={selectedGroup ? `${selectedGroup.key}/${employee.id}` : ''}
                    onChange={(event) => {
                      const id = event.target.value.split('/').at(-1)
                      const record = employees.find((entry) => entry.id === id)
                      if (record && record.id !== employee.id) selectEmployee(record)
                    }}>
                    {!employee.id && <option value="">{vi ? 'Nhân viên mới' : 'New employee'}</option>}
                    {groups.map((group) => <optgroup key={group.key} label={group.name}>
                      {group.records.map((record) => (
                        <option key={record.id} value={`${group.key}/${record.id}`}>{record.name}</option>
                      ))}
                    </optgroup>)}
                  </select>
                </label>
              </>
            )}
          </aside>

          {(employee.id || directory.canEdit) && (
            <form className="hr-access-panel hr-access-editor" onSubmit={save} aria-labelledby="hr-record-title" aria-busy={busy}>
              <h3 id="hr-record-title">{employee.id ? employee.name : (vi ? 'Nhân viên mới' : 'New employee')}</h3>
              <fieldset className="hr-access-fields" disabled={busy}>
                <div className="hr-access-section">
                  <h4>{vi ? 'Thông tin nhân viên' : 'Employee details'}</h4>
                  <div className="hr-access-grid">
                    <label className="hr-access-field" htmlFor="hr-full-name">
                      <span>{vi ? 'Họ và tên' : 'Full name'}{directory.canEdit && ' *'}</span>
                      <input id="hr-full-name" required maxLength={120} value={employee.name} readOnly={!directory.canEdit}
                        aria-invalid={nameError || undefined} aria-describedby={nameError ? 'hr-name-error' : undefined}
                        onInvalid={() => setFieldErrors((errors) => ({ ...errors, name: true }))}
                        onChange={(event) => {
                          if (nameError) setFieldErrors((errors) => ({ ...errors, name: false }))
                          setEmployee({ ...employee, name: event.target.value })
                        }} />
                      {nameError && <span className="hr-access-error" id="hr-name-error">{vi ? 'Nhập họ và tên.' : 'Enter the employee’s full name.'}</span>}
                    </label>
                    <label className="hr-access-field">
                      <span>{vi ? 'Ngày hết hạn hợp đồng (không bắt buộc)' : 'Contract end date (optional)'}</span>
                      <input type="date" value={employee.contractEnd} readOnly={!directory.canEdit} aria-describedby="hr-contract-help"
                        onChange={(event) => setEmployee({ ...employee, contractEnd: event.target.value })} />
                      <span className="hr-access-help" id="hr-contract-help">{vi ? 'Ngày này cũng là ngày hết hạn PIN.' : 'The PIN also expires on this date.'}</span>
                    </label>
                  </div>
                </div>

                <div className="hr-access-section">
                  <h4>{vi ? 'Quyền truy cập cửa hàng' : 'Venue access'}</h4>
                  <label className="hr-access-field hr-access-role">
                    <span>{vi ? 'Cấp quyền truy cập' : 'Access level'}</span>
                    <select value={employee.role} disabled={!directory.canEdit || employee.staffOnly}
                      aria-describedby={employee.staffOnly ? 'hr-role-help' : undefined}
                      onChange={(event) => setEmployee({ ...employee, role: event.target.value === 'manager' ? 'manager' : 'staff' })}>
                      <option value="staff">{vi ? 'Nhân viên' : 'Staff'}</option>
                      <option value="manager">{vi ? 'Quản lý' : 'Manager'}</option>
                    </select>
                    {employee.staffOnly && <span className="hr-access-help" id="hr-role-help">{vi ? 'Nhân viên này chỉ có quyền Nhân viên.' : 'This employee is limited to Staff access.'}</span>}
                  </label>
                  <fieldset className="hr-access-venues">
                    <legend>{vi ? 'Cửa hàng được truy cập' : 'Assigned venues'}</legend>
                    <div className="hr-access-grid">
                      {locations.map((venue) => (
                        <label key={venue.venue_key} className="hr-access-venue">
                          <input type="checkbox" disabled={!directory.canEdit} checked={employee.venues.includes(venue.venue_key)}
                            onChange={(event) => setEmployee({ ...employee, venues: event.target.checked
                              ? [...employee.venues, venue.venue_key]
                              : employee.venues.filter((key) => key !== venue.venue_key) })} />
                          <span>{venue.name}</span>
                        </label>
                      ))}
                    </div>
                    {locations.length === 0 && <p className="hr-access-help">{vi ? 'Không có cửa hàng đang hoạt động.' : 'No active venues available.'}</p>}
                  </fieldset>
                </div>

                {(directory.canEdit || employee.pinConfigured) && (
                  <div className="hr-access-section">
                    <h4>{vi ? 'Mã PIN đăng nhập' : 'Sign-in PIN'}</h4>
                    {directory.canEdit && (
                      <label className="hr-access-field hr-access-pin">
                        <span>{employee.pinConfigured ? (vi ? 'Đổi PIN (không bắt buộc)' : 'Replace PIN (optional)') : employee.id ? (vi ? 'PIN (không bắt buộc)' : 'PIN (optional)') : 'PIN *'}</span>
                        <input type={generatedPin ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password"
                          maxLength={6} pattern="[0-9]{6}" required={!employee.id} value={pin}
                          aria-invalid={pinError || undefined} aria-describedby={pinError ? 'hr-pin-error' : 'hr-pin-help'}
                          onInvalid={() => setFieldErrors((errors) => ({ ...errors, pin: true }))}
                          onChange={(event) => {
                            if (pinError) setFieldErrors((errors) => ({ ...errors, pin: false }))
                            setGeneratedPin(false)
                            setPin(event.target.value.replace(/\D/g, ''))
                          }} />
                        {pinError
                          ? <span className="hr-access-error" id="hr-pin-error">{vi ? 'Nhập đúng 6 chữ số.' : 'Enter exactly 6 digits.'}</span>
                          : <span className="hr-access-help" id="hr-pin-help">{vi ? 'Dùng 6 chữ số.' : 'Use 6 digits.'}</span>}
                      </label>
                    )}
                    <div className="hr-access-actions">
                      {directory.canEdit && <button type="button" className="secondary" onClick={() => {
                        setPin(generateEmployeePin())
                        setGeneratedPin(true)
                        setRevealedPin('')
                        if (pinError) setFieldErrors((errors) => ({ ...errors, pin: false }))
                        setFeedback({ tone: 'info', message: vi ? 'Đã tạo PIN mới. Lưu để áp dụng.' : 'New PIN generated. Save to apply it.' })
                      }}>{vi ? 'Tạo PIN ngẫu nhiên' : 'Generate random PIN'}</button>}
                      {employee.pinConfigured && <button type="button" className="secondary" onClick={() => revealedPin ? setRevealedPin('') : void reveal()}>
                        {revealedPin ? (vi ? 'Ẩn PIN' : 'Hide PIN') : (vi ? 'Hiện PIN' : 'Show PIN')}
                      </button>}
                      {revealedPin && <output className="hr-access-pin-value" aria-label={vi ? 'PIN hiện tại' : 'Current PIN'}>{revealedPin}</output>}
                    </div>
                  </div>
                )}
                <div className="hr-access-footer">
                  <div role="status">
                    {feedback && <p className="hr-access-feedback" data-tone={feedback.tone}>{feedback.message}</p>}
                  </div>
                  {directory.canEdit && <button className="primary" type="submit">{vi ? 'Lưu quyền truy cập' : 'Save employee access'}</button>}
                </div>
              </fieldset>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
