/** Prevent a deferred loading marker from running after its request settles. */
export function createDeferredLoading(setLoading: (loading: boolean) => void, schedule: (start: () => void) => () => void) {
  let active = true
  const cancelStart = schedule(() => { if (active) setLoading(true) })
  return {
    finish() {
      if (!active) return
      active = false
      cancelStart()
      setLoading(false)
    },
    cancel() {
      active = false
      cancelStart()
    },
  }
}
