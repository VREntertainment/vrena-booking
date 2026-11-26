'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'
import AppLoadingState from './AppLoadingState'
import StaffZaloMiniAppSettings from './StaffZaloMiniAppSettings'
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

export default function StaffEmployeeAccess({ language, showZalo }: { language: 'en' | 'vi'; showZalo: boolean }) {
  const vi = language === 'vi'
  const [directory, setDirectory] = useState<Directory>()
  const [employee, setEmployee] = useState<Employee>(emptyEmployee)
  const [pin, setPin] = useState('')
  const [revealedPin, setRevealedPin] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const selectEmployee = useCallback((record: Employee) => {
    setEmployee(record)
    setPin('')
    setRevealedPin('')
    setStatus('')
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
      if (active) setStatus(error.message)
    })
    return () => { active = false }
  }, [selectEmployee])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      const saved = await request<{ id: string }>(directoryUrl, {
        method: 'POST',
        body: JSON.stringify({ ...employee, pin }),
      })
      setPin('')
      setRevealedPin('')
      await load(saved.id)
      window.dispatchEvent(new Event('staff-locations-updated'))
      setStatus(vi ? 'Đã lưu quyền truy cập.' : 'Employee access saved.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function reveal() {
    if (!employee.id) return
    setBusy(true)
    try {
      const result = await request<{ pin: string | null }>(`/api/staff/kiosk/pin?profileId=${employee.id}`)
      setRevealedPin(result.pin || '')
      if (!result.pin) setStatus(vi ? 'Chưa có mã PIN.' : 'PIN unavailable.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="section staff-console" data-testid="staff-console">
    <h2>{vi ? 'Quyền truy cập của nhân viên' : 'Employee Access'}</h2>
    {!directory && !status && <AppLoadingState compact label={vi ? 'Đang tải nhân viên…' : 'Loading employees…'} />}
    {showZalo && <button type="button" className="secondary" onClick={() => { setRevealedPin(''); setPin(''); setShowSettings(!showSettings) }}>
      {showSettings ? (vi ? 'Quay lại' : 'Back to employees') : 'Zalo Mini App'}
    </button>}
    {showSettings && showZalo ? <StaffZaloMiniAppSettings language={language} onStatus={setStatus} /> : directory && <>
      <div className="actions">
        <label>{vi ? 'Nhân viên' : 'Employee'}
          <select disabled={busy} value={employee.id || ''} onChange={(event) => {
            selectEmployee(directory.employees.find((record) => record.id === event.target.value) || emptyEmployee)
          }}>
            {!employee.id && <option value="">{vi ? 'Nhân viên mới' : 'New employee'}</option>}
            {directory.employees.map((record) => <option key={record.id} value={record.id || ''}>{record.name}</option>)}
          </select>
        </label>
        {directory.canEdit && <button type="button" className="secondary" disabled={busy} onClick={() => selectEmployee(emptyEmployee)}>{vi ? 'Thêm nhân viên' : 'Add employee'}</button>}
      </div>
      {(employee.id || directory.canEdit) && <form className="staff-employee-access-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <label>{vi ? 'Họ và tên' : 'Full name'}
            <input required maxLength={120} value={employee.name} readOnly={!directory.canEdit}
              onChange={(event) => setEmployee({ ...employee, name: event.target.value })} />
          </label>
          <label>{vi ? 'Ngày hết hạn hợp đồng và PIN' : 'Contract end date and PIN expiry'}
            <input type="date" value={employee.contractEnd} readOnly={!directory.canEdit}
              onChange={(event) => setEmployee({ ...employee, contractEnd: event.target.value })} />
          </label>
          <label>{vi ? 'Quyền truy cập' : 'Store access level'}
            <select value={employee.role} disabled={!directory.canEdit || employee.staffOnly}
              onChange={(event) => setEmployee({ ...employee, role: event.target.value === 'manager' ? 'manager' : 'staff' })}>
              <option value="staff">{vi ? 'Nhân viên' : 'Staff'}</option>
              <option value="manager">{vi ? 'Quản lý' : 'Manager'}</option>
            </select>
          </label>
          <fieldset className="staff-location-options" aria-label={vi ? 'Cửa hàng được truy cập' : 'Store access'}>
            <legend>{vi ? 'Cửa hàng được truy cập' : 'Store access'}</legend>
            {directory.locations.map((venue) => <label key={venue.venue_key}>
              <input type="checkbox" disabled={!directory.canEdit} checked={employee.venues.includes(venue.venue_key)}
                onChange={(event) => setEmployee({ ...employee, venues: event.target.checked
                  ? [...employee.venues, venue.venue_key]
                  : employee.venues.filter((key) => key !== venue.venue_key) })} />
              {venue.name}
            </label>)}
          </fieldset>
          {directory.canEdit && <label>{employee.pinConfigured ? (vi ? 'Đổi PIN (không bắt buộc)' : 'Replace PIN (optional)') : 'PIN'}
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="[0-9]{6}" required={!employee.id}
              value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} />
          </label>}
          {employee.pinConfigured && <button type="button" className="secondary" onClick={() => revealedPin ? setRevealedPin('') : void reveal()}>
            {revealedPin ? (vi ? 'Ẩn PIN' : 'Hide PIN') : (vi ? 'Hiện PIN' : 'Show PIN')}
          </button>}
          {revealedPin && <output>{revealedPin}</output>}
          {directory.canEdit && <button type="submit">{vi ? 'Lưu quyền truy cập' : 'Save employee access'}</button>}
        </fieldset>
      </form>}
    </>}
    <p role="status">{status}</p>
  </section>
}
