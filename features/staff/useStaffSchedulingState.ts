'use client'

import { useState } from 'react'
import {
  addDays,
  startOfWeek,
  todayString
} from '../../lib/staff/dates'
import {
  defaultAttendanceLogForm,
  defaultAttendanceSettings,
  defaultLeaveForm,
  defaultShiftForm
} from '../../lib/staff/hrSettings'
import type {
  StaffAttendanceLog,
  StaffAttendanceSettings,
  StaffAttendanceTab,
  StaffLeaveRequest,
  StaffScheduleScope,
  StaffScheduleShift,
  StaffShiftTemplateId
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffSchedulingState({ canViewAllEmployeeProfiles }: { canViewAllEmployeeProfiles: boolean }) {
  const [attendanceTab, setAttendanceTab] = useState<StaffAttendanceTab>('schedule')
  const [attendanceShifts, setAttendanceShifts] = useState<StaffScheduleShift[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<StaffAttendanceLog[]>([])
  const [leaveRequests, setLeaveRequests] = useState<StaffLeaveRequest[]>([])
  const [attendanceSettings, setAttendanceSettings] = useState<StaffAttendanceSettings>(() => defaultAttendanceSettings())
  const [selectedShiftTemplate, setSelectedShiftTemplate] = useState<StaffShiftTemplateId>('opening')
  const [attendanceScheduleScope, setAttendanceScheduleScope] = useState<StaffScheduleScope>(() => canViewAllEmployeeProfiles ? 'all' : 'department')
  const [draggingShiftId, setDraggingShiftId] = useState('')
  const [shiftForm, setShiftForm] = useState(() => defaultShiftForm())
  const [attendanceLogForm, setAttendanceLogForm] = useState(() => defaultAttendanceLogForm())
  const [leaveForm, setLeaveForm] = useState(() => defaultLeaveForm())
  const [attendanceRangeStart, setAttendanceRangeStart] = useState(() => startOfWeek(todayString()))
  const [attendanceRangeEnd, setAttendanceRangeEnd] = useState(() => {
    const start = startOfWeek(todayString())
    return addDays(start, 6)
  })
  return {
    attendanceTab,
    setAttendanceTab,
    attendanceShifts,
    setAttendanceShifts,
    attendanceLogs,
    setAttendanceLogs,
    leaveRequests,
    setLeaveRequests,
    attendanceSettings,
    setAttendanceSettings,
    selectedShiftTemplate,
    setSelectedShiftTemplate,
    attendanceScheduleScope,
    setAttendanceScheduleScope,
    draggingShiftId,
    setDraggingShiftId,
    shiftForm,
    setShiftForm,
    attendanceLogForm,
    setAttendanceLogForm,
    leaveForm,
    setLeaveForm,
    attendanceRangeStart,
    setAttendanceRangeStart,
    attendanceRangeEnd,
    setAttendanceRangeEnd,
  }
}
