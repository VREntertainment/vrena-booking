import { isIP } from 'node:net'

export const UNKNOWN_CLIENT_IP = 'unknown'

const allowedTrustedIpHeaders = new Set([
  'cf-connecting-ip',
  'fastly-client-ip',
  'true-client-ip',
  'x-forwarded-for',
  'x-real-ip',
  'x-vercel-forwarded-for',
])

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeIpCandidate(value: string) {
  const firstValue = value.split(',')[0]?.trim() || ''
  const unbracketed = firstValue.startsWith('[') && firstValue.includes(']')
    ? firstValue.slice(1, firstValue.indexOf(']'))
    : firstValue

  if (isIP(unbracketed)) return unbracketed

  const ipv4WithPort = unbracketed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1])) return ipv4WithPort[1]

  return UNKNOWN_CLIENT_IP
}

export function trustedClientIp(headers: Headers) {
  const trustedHeader = cleanString(process.env.TRUSTED_CLIENT_IP_HEADER).toLowerCase()
  if (!allowedTrustedIpHeaders.has(trustedHeader)) return UNKNOWN_CLIENT_IP

  const headerValue = headers.get(trustedHeader)
  if (!headerValue) return UNKNOWN_CLIENT_IP

  return normalizeIpCandidate(headerValue)
}
