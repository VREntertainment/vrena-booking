import assert from 'node:assert/strict'
import test from 'node:test'
import { formatNotesHtml } from './formatNotesHtml.ts'

test('keeps supported rich-text tags while removing every attribute', () => {
  assert.equal(
    formatNotesHtml('<p class="note">Play <strong data-value="1">together</strong></p>'),
    '<p>Play <strong>together</strong></p>',
  )
})

test('removes malformed allowed-tag attributes used for stored XSS', () => {
  const result = formatNotesHtml('<div/onmouseover=alert(1)>Hover</div>')
  assert.equal(result, '<div>Hover</div>')
  assert.doesNotMatch(result, /onmouseover|alert\(/i)
})

test('removes alternate executable markup without changing safe text', () => {
  const result = formatNotesHtml('<svg><a xlink:href="javascript:alert(1)">Play safely</a></svg>')
  assert.equal(result, '&lt;svg&gt;&lt;a xlink:href=&quot;javascript:alert(1)&quot;&gt;Play safely&lt;/a&gt;&lt;/svg&gt;')
})

test('preserves the plain-text markdown shortcut behavior', () => {
  assert.equal(formatNotesHtml('**Bold** & safe', { markdownShortcuts: true }), '<strong>Bold</strong> &amp; safe')
})
