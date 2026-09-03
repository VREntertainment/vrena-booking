'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { staffCostLocations, type StaffCostAssignment, type StaffCostShare } from '@/lib/staffCostAllocation'

const labels = {
  en: {
    title: 'Temporary shop cost assignment', help: 'Choose which shop pays for work during these dates. The main shop stays unchanged. After the end date, costs return to the normal payroll location.',
    shop: 'Charge costs to', start: 'Start date', end: 'End date', reason: 'Reason', save: 'Save cost assignment', cancel: 'Cancel assignment', empty: 'No temporary assignments.',
    saved: 'Cost assignment saved.', cancelled: 'Assignment cancelled.', invalid: 'Choose a shop, valid dates (up to one year), and a reason.', overlap: 'These dates overlap another assignment. Cancel that assignment first or choose different dates.',
    report: 'Company cost by shop', basis: 'Company cost is split in proportion to approved paid hours (regular, overtime and holiday). Paid leave is attributed to the normal payroll location. Missing hours keep costs at the normal location and are flagged for review. Salary and take-home pay do not change.',
    employee: 'Employee', main: 'Main shop', hours: 'Paid hours', cost: 'Company cost', download: 'Download shop cost CSV', review: 'Needs approved hours',
  },
  vi: {
    title: 'Phân bổ chi phí tạm thời', help: 'Chọn cửa hàng chịu chi phí làm việc trong khoảng ngày này. Cửa hàng chính không đổi. Sau ngày kết thúc, chi phí tự trở về nơi tính lương thông thường.',
    shop: 'Cửa hàng chịu chi phí', start: 'Ngày bắt đầu', end: 'Ngày kết thúc', reason: 'Lý do', save: 'Lưu phân bổ chi phí', cancel: 'Hủy phân bổ', empty: 'Chưa có phân bổ tạm thời.',
    saved: 'Đã lưu phân bổ chi phí.', cancelled: 'Đã hủy phân bổ.', invalid: 'Chọn cửa hàng, khoảng ngày hợp lệ (tối đa một năm) và lý do.', overlap: 'Khoảng ngày trùng với phân bổ khác. Hãy hủy phân bổ đó hoặc chọn ngày khác.',
    report: 'Chi phí công ty theo cửa hàng', basis: 'Chi phí được phân bổ theo giờ được trả lương đã duyệt (giờ thường, tăng ca và ngày lễ). Nghỉ hưởng lương thuộc nơi tính lương thông thường. Khi thiếu giờ đã duyệt, chi phí vẫn ở nơi thông thường và được đánh dấu cần kiểm tra. Lương và thực lĩnh không thay đổi.',
    employee: 'Nhân viên', main: 'Cửa hàng chính', hours: 'Giờ được trả lương', cost: 'Chi phí công ty', download: 'Tải CSV chi phí cửa hàng', review: 'Cần giờ đã duyệt',
  },
}

export function StaffCostAssignments({ profileId, homeLocation, assignments, canEdit, language, reload }: {
  profileId: string; homeLocation: string; assignments: StaffCostAssignment[]; canEdit: boolean; language: string; reload: () => Promise<void>
}) {
  const copy = labels[language === 'vi' ? 'vi' : 'en']
  const [form, setForm] = useState({ cost_location: '', start_date: '', end_date: '', reason: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const rows = assignments.filter((row) => row.profile_id === profileId && !row.cancelled_at)

  async function save(cancelId?: string) {
    if (!canEdit || pending.current) return
    const days = (Date.parse(form.end_date) - Date.parse(form.start_date)) / 86400000
    if (!cancelId && (!form.cost_location || !Number.isFinite(days) || days < 0 || days > 365 || !form.reason.trim())) {
      setStatus(copy.invalid); return
    }
    pending.current = true
    setBusy(true)
    setStatus('')
    try {
      const result = cancelId
        ? await supabase.from('staff_cost_assignments').update({ cancelled_at: new Date().toISOString() }).eq('id', cancelId).eq('profile_id', profileId).is('cancelled_at', null).select('id').single()
        : await supabase.from('staff_cost_assignments').insert({ ...form, reason: form.reason.trim(), profile_id: profileId }).select('id').single()
      if (result.error) throw new Error(result.error.code === '23P01' ? copy.overlap : result.error.message)
      await reload()
      if (!cancelId) setForm({ cost_location: '', start_date: '', end_date: '', reason: '' })
      setStatus(cancelId ? copy.cancelled : copy.saved)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <section className="staff-cost-assignments" aria-label={copy.title}>
    <h4>{copy.title}</h4>
    <p>{copy.help}</p>
    <p><strong>{copy.main}: {homeLocation || '—'}</strong></p>
    {canEdit && <div className="form-grid compact-form-grid">
      <label>{copy.shop}<select aria-label={copy.shop} disabled={busy} value={form.cost_location} onChange={(event) => setForm({ ...form, cost_location: event.target.value })}><option value="">—</option>{staffCostLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
      <label>{copy.start}<input aria-label={copy.start} type="date" disabled={busy} value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
      <label>{copy.end}<input aria-label={copy.end} type="date" min={form.start_date} disabled={busy} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></label>
      <label>{copy.reason}<input aria-label={copy.reason} maxLength={500} disabled={busy} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      <div><button type="button" className="primary" disabled={busy} onClick={() => void save()}>{copy.save}</button></div>
    </div>}
    <p role="status">{status}</p>
    {rows.length ? <ul className="staff-cost-assignment-list">{rows.map((row) => <li key={row.id}>
      <div><strong>{row.cost_location} · {row.start_date} – {row.end_date}</strong><p>{row.reason}</p></div>
      {canEdit && <button type="button" disabled={busy} onClick={() => void save(row.id)}>{copy.cancel}</button>}
    </li>)}</ul> : <p>{copy.empty}</p>}
  </section>
}

export type StaffCostReportRow = StaffCostShare & { employee: string; employeeCode: string; home: string; needsPaidHours: boolean }

export function StaffCostReport({ rows, language, start, end }: { rows: StaffCostReportRow[]; language: string; start: string; end: string }) {
  const copy = labels[language === 'vi' ? 'vi' : 'en']
  const money = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
  const totals = new Map<string, number>()
  rows.forEach((row) => totals.set(row.location, (totals.get(row.location) || 0) + row.companyCost))
  async function download() {
    const { downloadCsvFile } = await import('@/lib/staffDownloadFiles')
    downloadCsvFile(`shop-costs-${start}-${end}.csv`, rows.map((row) => ({
      'Period start': start, 'Period end': end, 'Employee code': row.employeeCode, Employee: row.employee,
      'Main shop': row.home, 'Cost location': row.location, 'Paid hours': Number((row.paidMinutes / 60).toFixed(2)),
      'Company cost (VND)': row.companyCost, Review: row.needsPaidHours ? copy.review : '',
    })), copy.empty)
  }
  return <section className="staff-cost-assignments" aria-label={copy.report}>
    <h3>{copy.report}</h3><p>{start} – {end}</p><p>{copy.basis}</p>
    <div className="staff-cost-totals">{[...totals].map(([location, cost]) => <div key={location}><span>{location}</span><strong>{money(cost)}</strong></div>)}</div>
    <button type="button" disabled={!rows.length} onClick={() => void download()}>{copy.download}</button>
    <div className="staff-cost-table-scroll"><table><thead><tr><th>{copy.employee}</th><th>{copy.main}</th><th>{copy.shop}</th><th>{copy.hours}</th><th>{copy.cost}</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${row.employeeCode}-${row.location}-${index}`}><td>{row.employee}<br />{row.needsPaidHours && <span className="notice">{copy.review}</span>}</td><td>{row.home}</td><td>{row.location}</td><td>{Number((row.paidMinutes / 60).toFixed(2))}</td><td>{money(row.companyCost)}</td></tr>)}</tbody>
    </table></div>
  </section>
}
