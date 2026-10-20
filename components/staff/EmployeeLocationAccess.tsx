'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'
import type { StaffLocation } from '../../hooks/useStaffLocations'

export function EmployeeLocationAccess({ profileId, canEdit, language }: { profileId: string; canEdit: boolean; language: string }) {
  const vi = language === 'vi'
  const [locations, setLocations] = useState<StaffLocation[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('staff_locations').select('venue_key,name').eq('active', true).order('name'),
      supabase.from('staff_employee_locations').select('venue_key').eq('profile_id', profileId),
    ]).then(([catalog, assignments]) => {
      if (!active) return
      const error = catalog.error || assignments.error
      if (error) { setStatus(error.message); return }
      setLocations(catalog.data || [])
      setSelected((assignments.data || []).map((row) => row.venue_key))
      setReady(true)
    })
    return () => { active = false }
  }, [profileId])
  async function save() {
    setSaving(true)
    const { error } = await supabase.rpc('staff_set_employee_locations', { p_profile_id: profileId, p_venue_keys: selected })
    setSaving(false)
    setStatus(error?.message || (vi ? 'Đã lưu quyền truy cập địa điểm.' : 'Location access saved.'))
    if (!error) window.dispatchEvent(new Event('staff-locations-updated'))
  }
  return <section className="staff-location-access" aria-label={vi ? 'Quyền truy cập địa điểm' : 'Location access'}>
    <strong>{vi ? 'Địa điểm được truy cập' : 'Allowed locations'}</strong>
    <p>{vi ? 'Chọn một hoặc nhiều địa điểm. Không chọn địa điểm nào nghĩa là không có quyền truy cập dữ liệu đặt chỗ. Chủ sở hữu và quản trị viên có quyền truy cập tất cả địa điểm.' : 'Select one or more locations. No selection means no booking-data access. Owners and administrators retain access to all locations.'}</p>
    <details>
      <summary>{selected.length ? locations.filter((l) => selected.includes(l.venue_key)).map((l) => l.name).join(', ') : vi ? 'Chưa chọn địa điểm' : 'No locations assigned'}</summary>
      <div className="staff-location-options">
        {locations.map((location) => <label key={location.venue_key}>
          <input type="checkbox" disabled={!canEdit || !ready || saving} checked={selected.includes(location.venue_key)} onChange={(event) => {
            setSelected((current) => event.target.checked ? [...current, location.venue_key] : current.filter((key) => key !== location.venue_key)); setStatus('')
          }} />{location.name}
        </label>)}
      </div>
    </details>
    {canEdit && <button type="button" className="secondary" disabled={!ready || saving} onClick={save}>{vi ? 'Lưu quyền truy cập địa điểm' : 'Save location access'}</button>}
    <p role="status">{status}</p>
  </section>
}
