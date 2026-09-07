import type { StaffConsoleLanguage } from './types.ts'

export function resolveStaffConsoleLanguage(language?: string): StaffConsoleLanguage {
  return language === 'vi' ? 'vi' : 'en'
}

export function decimalInput(value: string | number | null | undefined) {
  const amount = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

export function formatVnd(value: number) {
  return `${Math.max(0, Number(value) || 0).toLocaleString('vi-VN')} đ`
}

export function formatVndCompact(value: number) {
  const amount = Math.max(0, Number(value) || 0)
  if (amount >= 1000000) {
    const millions = amount / 1000000
    return `${Number(millions.toFixed(millions >= 10 || Number.isInteger(millions) ? 0 : 1)).toLocaleString('vi-VN')}M`
  }
  if (amount >= 1000) return `${Math.round(amount / 1000).toLocaleString('vi-VN')}k`
  return `${amount.toLocaleString('vi-VN')} đ`
}

export function dongDigits(value: string | number | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

export function parseDong(value: string | number | null | undefined) {
  const digits = dongDigits(value)
  return digits ? Number(digits) : 0
}

export function formatDongInput(value: string | number | null | undefined) {
  const amount = parseDong(value)
  return amount > 0 ? formatVnd(amount) : ''
}

export function parsePercentInput(value: string | number | null | undefined) {
  const rawValue = String(value ?? '').replace(/[^\d.]/g, '')
  const amount = Number(rawValue)
  if (!Number.isFinite(amount)) return 0
  return Math.min(100, Math.max(0, amount))
}

export function formatPercentInput(value: string | number | null | undefined) {
  const amount = parsePercentInput(value)
  if (amount <= 0) return ''
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)))
}
