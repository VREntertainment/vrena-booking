import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
const require = createRequire(import.meta.url)

test('legacy lint consumers use the patched matcher with their callable API', () => {
  for (const consumer of ['eslint', '@eslint/config-array', '@eslint/eslintrc', 'eslint-plugin-react', 'eslint-plugin-import', 'eslint-plugin-jsx-a11y']) {
    const fromConsumer = createRequire(require.resolve(consumer))
    const match = fromConsumer('minimatch')
    assert.equal(typeof match, 'function', consumer)
    assert.equal(match('components/BookingWidget.tsx', '**/*.{ts,tsx}'), true)
    assert.equal(match('components/BookingWidget.tsx', '**/*.js'), false)
    assert.equal(new match.Minimatch('**/*.tsx').match('components/BookingWidget.tsx'), true)
    assert.deepEqual(match.match(['app/page.tsx', 'README.md'], '**/*.tsx'), ['app/page.tsx'])
    assert.equal(match.defaults({ nocase: true })('APP.TSX', '*.tsx'), true)
    const adapter = createRequire(fromConsumer.resolve('minimatch'))
    assert.equal(adapter('minimatch-patched/package.json').version, '11.0.1')
  }
})

test('TypeScript lint parser uses the patched modern named API', () => {
  const fromParser = createRequire(require.resolve('@typescript-eslint/typescript-estree'))
  const { minimatch, Minimatch } = fromParser('minimatch')
  assert.equal(fromParser('minimatch/package.json').version, '11.0.1')
  assert.equal(minimatch('lib/i18n/locales/zh.ts', '**/*.ts'), true)
  assert.equal(new Minimatch('**/*.ts').match('photo.png'), false)
})
