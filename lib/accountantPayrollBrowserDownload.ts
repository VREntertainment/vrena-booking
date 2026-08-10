import type { AccountantPayrollWorkbookInput } from './accountantPayrollWorkbook'

type AccountantPayrollBrowserDownload = {
  accessToken: string
  filename: string
  input: AccountantPayrollWorkbookInput
  operatorToken?: string
}

function hiddenField(form: HTMLFormElement, name: string, value: string) {
  const field = document.createElement('textarea')
  field.hidden = true
  field.name = name
  field.value = value
  form.appendChild(field)
}

export function submitAccountantPayrollDownload({
  accessToken,
  filename,
  input,
  operatorToken = '',
}: AccountantPayrollBrowserDownload) {
  if (!accessToken) throw new Error('Your staff session has expired. Sign in again before exporting payroll.')

  const form = document.createElement('form')
  form.hidden = true
  form.method = 'POST'
  form.action = '/api/staff/payroll/export'
  form.enctype = 'multipart/form-data'
  form.target = '_self'

  hiddenField(form, 'access_token', accessToken)
  hiddenField(form, 'operator_token', operatorToken)
  hiddenField(form, 'filename', filename)
  hiddenField(form, 'payload', JSON.stringify(input))

  document.body.appendChild(form)
  form.submit()

  // Content-Disposition keeps a successful download on the HR page. A top-level
  // target avoids Safari and embedded-browser restrictions on hidden-frame downloads,
  // and makes an unexpected server error visible instead of failing silently.
  window.setTimeout(() => form.remove(), 120_000)
}
