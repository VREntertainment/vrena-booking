'use client'

import type {
  StaffDataKey
} from '../../lib/staff/types'

export type LoadingActionContext = {
  currentDataKeys: import("../../lib/staff/types").StaffDataKey[]
  setDataErrors: React.Dispatch<React.SetStateAction<Partial<Record<import("../../lib/staff/types").StaffDataKey, string>>>>
  setDataRetry: React.Dispatch<React.SetStateAction<number>>
  inFlightDataRef: React.RefObject<Partial<Record<import("../../lib/staff/types").StaffDataKey, Promise<void>>>>
  loadedDataRef: React.RefObject<Partial<Record<import("../../lib/staff/types").StaffDataKey, boolean>>>
  setLoadingData: React.Dispatch<React.SetStateAction<Partial<Record<import("../../lib/staff/types").StaffDataKey, boolean>>>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffLoadingActions(getContext: () => LoadingActionContext) {
  function retryCurrentData() {
    const { currentDataKeys, setDataErrors, setDataRetry } = getContext()

    markStaffDataStale(...currentDataKeys)
    setDataErrors((current) => ({ ...current, ...Object.fromEntries(currentDataKeys.map((key) => [key, undefined])) }))
    setDataRetry((value) => value + 1)
  }

  async function runStaffLoader(key: StaffDataKey, loader: () => Promise<void>, force = false) {
    const { inFlightDataRef, loadedDataRef, setDataErrors, setLoadingData, setStatus } = getContext()

    if (inFlightDataRef.current[key]) {
      await inFlightDataRef.current[key]
      if (!force) return
    }
    if (!force && loadedDataRef.current[key]) return

    setDataErrors((current) => ({ ...current, [key]: undefined }))
    setLoadingData((current) => ({ ...current, [key]: true }))
    const promise = loader()
      .then(() => {
        loadedDataRef.current[key] = true
      })
      .catch((error: unknown) => {
        loadedDataRef.current[key] = false
        setDataErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : String(error) }))
        setStatus(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        delete inFlightDataRef.current[key]
        setLoadingData((current) => ({ ...current, [key]: false }))
      })
    inFlightDataRef.current[key] = promise
    await promise
  }

  function markStaffDataStale(...keys: StaffDataKey[]) {
    const { loadedDataRef } = getContext()

    keys.forEach((key) => {
      loadedDataRef.current[key] = false
    })
  }

  return { retryCurrentData, runStaffLoader, markStaffDataStale }
}
