'use client'

import { useRef, useState } from 'react'
import type {
  StaffDataKey
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffLoadingState() {
  const [status, setStatus] = useState('')
  const [dataErrors, setDataErrors] = useState<Partial<Record<StaffDataKey, string>>>({})
  const [dataRetry, setDataRetry] = useState(0)
  const [loadingData, setLoadingData] = useState<Partial<Record<StaffDataKey, boolean>>>({})
  const loadedDataRef = useRef<Partial<Record<StaffDataKey, boolean>>>({})
  const inFlightDataRef = useRef<Partial<Record<StaffDataKey, Promise<void>>>>({})
  const [saving, setSaving] = useState(false)
  return {
    status,
    setStatus,
    dataErrors,
    setDataErrors,
    dataRetry,
    setDataRetry,
    loadingData,
    setLoadingData,
    loadedDataRef,
    inFlightDataRef,
    saving,
    setSaving,
  }
}
