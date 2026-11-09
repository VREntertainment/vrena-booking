import { createHmac, timingSafeEqual } from 'node:crypto'

export const ZALO_BOOKING_MINI_APP_ID = '2401555387563548266'
export const ZALO_CHECKOUT_METHOD = 'COD'
export const ZALO_CHECKOUT_CALLBACK_IPS = new Set(['118.102.2.29', '49.213.78.2'])
export const ZALO_CHECKOUT_STATUS_URL = 'https://payment-mini.zalo.me/api/transaction/get-status'

export type ZaloCreateOrderParams = {
  amount: number
  desc: string
  item: Array<Record<string, string | number>>
  extradata: string
  method: string
}

export type ZaloCheckoutCallbackData = {
  appId: string
  orderId: string
  transId: string
  method: string
  transTime?: string | number
  merchantTransId?: string
  amount: number
  description: string
  resultCode: number
  message: string
  extradata: string
  [key: string]: unknown
}

export type ZaloCheckoutCallbackBody = {
  data: ZaloCheckoutCallbackData
  mac: string
  overallMac: string
}

export type ZaloCheckoutNotifyBody = {
  data: { appId: string; orderId: string; method: string }
  mac: string
}

export type ZaloCheckoutOrderStatus = {
  transId?: string
  method?: string
  returnCode: number
  returnMessage?: string
  isProcessing?: boolean
  amount?: number
  transTime?: string | number
  merchantTransId?: string
  extradata?: string
}

export function unwrapZaloCheckoutOrderStatus(body: unknown): ZaloCheckoutOrderStatus | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  const candidate = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record
  return Number.isInteger(Number(candidate.returnCode))
    ? candidate as ZaloCheckoutOrderStatus
    : null
}

function macValue(value: unknown) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function sortedMacData(data: Record<string, unknown>) {
  return Object.keys(data)
    .sort()
    .map((key) => `${key}=${macValue(data[key])}`)
    .join('&')
}

export function hmacSha256(privateKey: string, data: string) {
  return createHmac('sha256', privateKey).update(data).digest('hex')
}

export function createOrderMac(privateKey: string, params: ZaloCreateOrderParams) {
  return hmacSha256(privateKey, sortedMacData(params))
}

export function createOrderStatusMac(privateKey: string, orderId: string) {
  return hmacSha256(
    privateKey,
    `appId=${ZALO_BOOKING_MINI_APP_ID}&orderId=${orderId}&privateKey=${privateKey}`,
  )
}

function firstForwardedIp(value: string | null) {
  const candidate = value?.split(',')[0]?.trim() || ''
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate) ? candidate : ''
}

export function isAllowedZaloCallbackSource(headers: Headers, production = process.env.NODE_ENV === 'production') {
  if (!production) return true
  const sourceIp = firstForwardedIp(headers.get('x-vercel-forwarded-for'))
    || firstForwardedIp(headers.get('x-forwarded-for'))
  return ZALO_CHECKOUT_CALLBACK_IPS.has(sourceIp)
}

function safeMacEqual(left: string, right: string) {
  if (!/^[a-f\d]{64}$/i.test(left) || !/^[a-f\d]{64}$/i.test(right)) return false
  return timingSafeEqual(Buffer.from(left.toLowerCase(), 'hex'), Buffer.from(right.toLowerCase(), 'hex'))
}

export function verifyZaloCheckoutCallback(body: ZaloCheckoutCallbackBody, privateKey: string) {
  const { data } = body
  const transactionMacData = [
    `appId=${data.appId}`,
    `amount=${data.amount}`,
    `description=${data.description}`,
    `orderId=${data.orderId}`,
    `message=${data.message}`,
    `resultCode=${data.resultCode}`,
    `transId=${data.transId}`,
  ].join('&')
  return safeMacEqual(body.mac, hmacSha256(privateKey, transactionMacData))
    && safeMacEqual(body.overallMac, hmacSha256(privateKey, sortedMacData(data)))
}

export function verifyZaloCheckoutNotify(body: ZaloCheckoutNotifyBody, privateKey: string) {
  const { appId, orderId, method } = body.data
  return safeMacEqual(body.mac, hmacSha256(privateKey, `appId=${appId}&orderId=${orderId}&method=${method}`))
}

export function checkoutTokenFromExtradata(extradata: string) {
  try {
    const decoded = decodeURIComponent(extradata)
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    const token = typeof parsed.checkoutToken === 'string' ? parsed.checkoutToken : ''
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
      ? token
      : null
  } catch {
    return null
  }
}

export function isReservableCodOrderStatus(
  status: ZaloCheckoutOrderStatus,
  expectedAmount: number,
  checkoutToken: string,
) {
  if (status.method !== ZALO_CHECKOUT_METHOD || Number(status.amount) !== expectedAmount) return false
  if (!status.extradata || checkoutTokenFromExtradata(status.extradata) !== checkoutToken) return false
  // COD is intentionally unpaid when the customer creates the order. Zalo can
  // therefore report returnCode 0 with isProcessing false until the venue marks
  // the order paid. The signed status still proves that this exact COD order,
  // amount, and checkout token were created for our Mini App.
  if (Number(status.returnCode) === 0) return true
  if (Number(status.returnCode) !== 1) return false
  const transId = typeof status.transId === 'string' ? status.transId.trim() : ''
  return transId.length >= 1 && transId.length <= 200 && !/[\u0000-\u001f\u007f]/.test(transId)
}
