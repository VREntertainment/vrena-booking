

export function isStaffHrSchemaUnavailable(error?: { code?: string; message?: string } | null) {
  if (!error) return false
  const message = (error.message || '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    message.includes('schema cache')
  )
}

export function isStaffHrPermissionDenied(error?: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42501' || (error.message || '').toLowerCase().includes('permission denied')
}

export function rpcFunctionMissing(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return error?.code === '42883'
    || error?.code === 'PGRST202'
    || message.includes('could not find the function')
    || (message.includes('function') && message.includes('does not exist'))
}
