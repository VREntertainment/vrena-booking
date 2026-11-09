import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkoutTokenFromExtradata,
  createOrderMac,
  createOrderStatusMac,
  hmacSha256,
  isAllowedZaloCallbackSource,
  isReservableCodOrderStatus,
  unwrapZaloCheckoutOrderStatus,
  sortedMacData,
  verifyZaloCheckoutCallback,
  verifyZaloCheckoutNotify,
  type ZaloCheckoutCallbackBody,
} from './zaloCheckout.ts'

const privateKey = 'test-private-key'

test('creates the Checkout MAC from alphabetically sorted fields', () => {
  const params = {
    amount: 520000,
    desc: 'VRena Booking',
    item: [{ id: 'individual', amount: 520000 }],
    extradata: JSON.stringify({ checkoutToken: '11111111-1111-4111-8111-111111111111' }),
    method: JSON.stringify({ id: 'COD', isCustom: false }),
  }
  assert.equal(
    sortedMacData(params),
    `amount=520000&desc=VRena Booking&extradata=${params.extradata}&item=${JSON.stringify(params.item)}&method=${params.method}`,
  )
  assert.equal(createOrderMac(privateKey, params), hmacSha256(privateKey, sortedMacData(params)))
})

test('verifies both callback signatures before trusting extradata', () => {
  const data = {
    appId: '2401555387563548266', orderId: 'zmp-order', transId: 'zmp-trans', method: 'COD',
    amount: 520000, description: 'VRena Booking', resultCode: 1, message: 'Success',
    extradata: encodeURIComponent(JSON.stringify({ checkoutToken: '11111111-1111-4111-8111-111111111111' })),
  }
  const macData = `appId=${data.appId}&amount=${data.amount}&description=${data.description}&orderId=${data.orderId}&message=${data.message}&resultCode=${data.resultCode}&transId=${data.transId}`
  const body: ZaloCheckoutCallbackBody = {
    data,
    mac: hmacSha256(privateKey, macData),
    overallMac: hmacSha256(privateKey, sortedMacData(data)),
  }
  assert.equal(verifyZaloCheckoutCallback(body, privateKey), true)
  assert.equal(verifyZaloCheckoutCallback({ ...body, data: { ...data, amount: 1 } }, privateKey), false)
})

test('verifies COD notifications and extracts only valid checkout tokens', () => {
  const data = { appId: '2401555387563548266', orderId: 'zmp-order', method: 'COD' }
  const body = { data, mac: hmacSha256(privateKey, `appId=${data.appId}&orderId=${data.orderId}&method=${data.method}`) }
  assert.equal(verifyZaloCheckoutNotify(body, privateKey), true)
  assert.equal(checkoutTokenFromExtradata(JSON.stringify({ checkoutToken: '11111111-1111-4111-8111-111111111111' })), '11111111-1111-4111-8111-111111111111')
  assert.equal(checkoutTokenFromExtradata(JSON.stringify({ checkoutToken: 'not-a-token' })), null)
})

test('signs status reconciliation exactly as required by Zalo Checkout', () => {
  const orderId = 'zmp-order'
  assert.equal(
    createOrderStatusMac(privateKey, orderId),
    hmacSha256(privateKey, `appId=2401555387563548266&orderId=${orderId}&privateKey=${privateKey}`),
  )
})

test('accepts only the documented Checkout callback IPs in production', () => {
  assert.equal(isAllowedZaloCallbackSource(new Headers({ 'x-vercel-forwarded-for': '118.102.2.29' }), true), true)
  assert.equal(isAllowedZaloCallbackSource(new Headers({ 'x-forwarded-for': '49.213.78.2, 10.0.0.1' }), true), true)
  assert.equal(isAllowedZaloCallbackSource(new Headers({ 'x-forwarded-for': '203.0.113.10' }), true), false)
  assert.equal(isAllowedZaloCallbackSource(new Headers(), false), true)
})

test('accepts a verified pending COD order as reservation evidence', () => {
  const token = '11111111-1111-4111-8111-111111111111'
  const base = {
    method: 'COD', returnCode: 0, isProcessing: true, amount: 520000,
    extradata: encodeURIComponent(JSON.stringify({ checkoutToken: token })),
  }
  assert.equal(isReservableCodOrderStatus(base, 520000, token), true)
  assert.equal(isReservableCodOrderStatus({ ...base, isProcessing: false }, 520000, token), true)
  assert.equal(isReservableCodOrderStatus({ ...base, isProcessing: undefined }, 520000, token), true)
  assert.equal(isReservableCodOrderStatus({ ...base, amount: 1 }, 520000, token), false)
  assert.equal(isReservableCodOrderStatus({ ...base, returnCode: 1, transId: 'zmp-transaction' }, 520000, token), true)
})

test('unwraps both direct and HTTP-wrapped Zalo order status responses', () => {
  const status = { returnCode: 0, method: 'COD', amount: 520000 }
  assert.deepEqual(unwrapZaloCheckoutOrderStatus(status), status)
  assert.deepEqual(unwrapZaloCheckoutOrderStatus({ data: status }), status)
  assert.equal(unwrapZaloCheckoutOrderStatus({ data: { message: 'missing status' } }), null)
  assert.equal(unwrapZaloCheckoutOrderStatus(null), null)
})
