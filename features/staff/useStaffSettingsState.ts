'use client'

import { useState } from 'react'
import {
  defaultHrSettings,
  defaultHrSetupForm
} from '../../lib/staff/hrSettings'
import type {
  StaffHrSettings,
  StaffHrSetupOption,
  StaffHrSetupOptionType
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffSettingsState() {
  const [hrSettings, setHrSettings] = useState<StaffHrSettings>(() => defaultHrSettings())
  const [hrSetupOptions, setHrSetupOptions] = useState<StaffHrSetupOption[]>([])
  const [hrSetupForm, setHrSetupForm] = useState<Record<StaffHrSetupOptionType, string>>(() => defaultHrSetupForm())
  return { hrSettings, setHrSettings, hrSetupOptions, setHrSetupOptions, hrSetupForm, setHrSetupForm }
}
