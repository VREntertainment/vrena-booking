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

  const targetName = `accountant-payroll-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const target = document.createElement('iframe')
  target.hidden = true
  target.name = targetName
  target.title = 'Accountant payroll download'

  const form = document.createElement('form')
  form.hidden = true
  form.method = 'POST'
  form.action = '/api/staff/payroll/export'
  form.enctype = 'multipart/form-data'
  form.target = targetName

  hiddenField(form, 'access_token', accessToken)
  hiddenField(form, 'operator_token', operatorToken)
  hiddenField(form, 'filename', filename)
  hiddenField(form, 'payload', JSON.stringify(input))

  document.body.append(target, form)
  form.submit()

  // Safari can cancel the queued form navigation if either the form or its target
  // is detached immediately after submit. Keep both alive while it receives the
  // native attachment; neither contains payroll content after the response ends.
  window.setTimeout(() => {
    form.remove()
    target.remove()
  }, 120_000)
}
