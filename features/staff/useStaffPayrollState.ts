'use client'

import { useState } from 'react'
import {
  defaultHrAdjustmentForm,
  defaultPayrollRunForm
} from '../../lib/staff/hrSettings'
import type {
  StaffHrAdjustment,
  StaffPayrollItem,
  StaffPayrollRun,
  StaffPayrollSourceSnapshot
} from '../../lib/staff/types'
import { type StaffCostAssignment } from '../../lib/staffCostAllocation'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffPayrollState() {
  const [costAssignments, setCostAssignments] = useState<StaffCostAssignment[]>([])
  const [hrAdjustments, setHrAdjustments] = useState<StaffHrAdjustment[]>([])
  const [payrollRuns, setPayrollRuns] = useState<StaffPayrollRun[]>([])
  const [payrollItems, setPayrollItems] = useState<StaffPayrollItem[]>([])
  const [payrollSourceSnapshots, setPayrollSourceSnapshots] = useState<StaffPayrollSourceSnapshot[]>([])
  const [hrAdjustmentForm, setHrAdjustmentForm] = useState(() => defaultHrAdjustmentForm())
  const [payrollRunForm, setPayrollRunForm] = useState(() => defaultPayrollRunForm())
  return {
    costAssignments,
    setCostAssignments,
    hrAdjustments,
    setHrAdjustments,
    payrollRuns,
    setPayrollRuns,
    payrollItems,
    setPayrollItems,
    payrollSourceSnapshots,
    setPayrollSourceSnapshots,
    hrAdjustmentForm,
    setHrAdjustmentForm,
    payrollRunForm,
    setPayrollRunForm,
  }
}
