import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { calculateProgressivePit, progressivePitExcelFormula, type ProgressivePitBracket } from './hrPayrollPolicy.ts'

const brackets: ProgressivePitBracket[] = [
  { up_to: 10_000_000, rate: 5 },
  { up_to: 30_000_000, rate: 10 },
  { up_to: 60_000_000, rate: 20 },
  { up_to: 100_000_000, rate: 30 },
  { up_to: null, rate: 35 },
]

test('returns zero below the taxable threshold', () => {
  assert.equal(calculateProgressivePit(0, brackets), 0)
  assert.equal(calculateProgressivePit(-1, brackets), 0)
})

test('creates an Excel formula from the configured brackets', () => {
  assert.equal(
    progressivePitExcelFormula('AM5', brackets),
    'MAX(0,MIN(AM5,10000000)-0)*5%+MAX(0,MIN(AM5,30000000)-10000000)*10%+MAX(0,MIN(AM5,60000000)-30000000)*20%+MAX(0,MIN(AM5,100000000)-60000000)*30%+MAX(0,AM5-100000000)*35%',
  )
})

test('calculates tax across progressive bands', () => {
  assert.equal(calculateProgressivePit(10_000_000, brackets), 500_000)
  assert.equal(calculateProgressivePit(20_000_000, brackets), 1_500_000)
  assert.equal(calculateProgressivePit(50_000_000, brackets), 6_500_000)
  assert.equal(calculateProgressivePit(120_000_000, brackets), 27_500_000)
})
