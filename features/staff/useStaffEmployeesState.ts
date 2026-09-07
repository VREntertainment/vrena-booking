'use client'

import { useRef, useState } from 'react'
import {
  defaultEmployeeForm
} from '../../lib/staff/hrSettings'
import type {
  StaffEmployeeProfile,
  StaffHrDocument,
  StaffHrDocumentType
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffEmployeesState() {
  const [employeeProfiles, setEmployeeProfiles] = useState<StaffEmployeeProfile[]>([])
  const [employeePhotoUrls, setEmployeePhotoUrls] = useState<Record<string, string>>({})
  const [hrDocuments, setHrDocuments] = useState<StaffHrDocument[]>([])
  const [employeeForm, setEmployeeForm] = useState(() => defaultEmployeeForm())
  const [employeeKioskPin, setEmployeeKioskPin] = useState('')
  const [employeeKioskPinConfirm, setEmployeeKioskPinConfirm] = useState('')
  const [employeeKioskAccessRole, setEmployeeKioskAccessRole] = useState<'manager' | 'staff'>('staff')
  const [employeeKioskPinSaveConfirmation, setEmployeeKioskPinSaveConfirmation] = useState<'' | 'created' | 'replaced'>('')
  const [employeeKioskPinVisibleValue, setEmployeeKioskPinVisibleValue] = useState('')
  const [employeeKioskPinLoading, setEmployeeKioskPinLoading] = useState(false)
  const [employeeKioskPinEmailState, setEmployeeKioskPinEmailState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [employeeKioskPinEmailRecipient, setEmployeeKioskPinEmailRecipient] = useState('')
  const employeeKioskPinProfileRef = useRef('')
  const employeeKioskPinConfirmationTimerRef = useRef<number | null>(null)
  const employeeKioskPinEmailTimerRef = useRef<number | null>(null)
  const [hrDocumentUploading, setHrDocumentUploading] = useState<StaffHrDocumentType | ''>('')
  return {
    employeeProfiles,
    setEmployeeProfiles,
    employeePhotoUrls,
    setEmployeePhotoUrls,
    hrDocuments,
    setHrDocuments,
    employeeForm,
    setEmployeeForm,
    employeeKioskPin,
    setEmployeeKioskPin,
    employeeKioskPinConfirm,
    setEmployeeKioskPinConfirm,
    employeeKioskAccessRole,
    setEmployeeKioskAccessRole,
    employeeKioskPinSaveConfirmation,
    setEmployeeKioskPinSaveConfirmation,
    employeeKioskPinVisibleValue,
    setEmployeeKioskPinVisibleValue,
    employeeKioskPinLoading,
    setEmployeeKioskPinLoading,
    employeeKioskPinEmailState,
    setEmployeeKioskPinEmailState,
    employeeKioskPinEmailRecipient,
    setEmployeeKioskPinEmailRecipient,
    employeeKioskPinProfileRef,
    employeeKioskPinConfirmationTimerRef,
    employeeKioskPinEmailTimerRef,
    hrDocumentUploading,
    setHrDocumentUploading,
  }
}
