import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell } from './staffDownloadFiles.ts'

test('CSV serializes formula-like customer fields as text', () => {
  for (const value of ['=1+1', '+123456789', '-2+3', '@SUM(A1)', ' \t=1+1', '\r=1+1', '\u0000=1+1']) {
    assert.ok(csvCell(value).startsWith("'"), JSON.stringify(value))
  }
  assert.equal(csvCell('=HYPERLINK("https://example.invalid","click")'), '"\'=HYPERLINK(""https://example.invalid"",""click"")"')
})

test('CSV preserves numeric accounting values and escapes ordinary CSV delimiters', () => {
  assert.equal(csvCell(-123.45), '-123.45')
  assert.equal(csvCell(0), '0')
  assert.equal(csvCell('Nguyễn Văn A'), 'Nguyễn Văn A')
  assert.equal(csvCell('a,"b"'), '"a,""b"""')
  assert.equal(csvCell('line\r\nnext'), 'line  next')
  assert.equal(csvCell(null), '')
})
