import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// GHSA-fc5q-39xc-vjpf has no upstream patch as of 2026-11-18.
// In this lockfile it is confined to ESLint's trusted repository glob patterns.
// Never exempt production dependencies, other advisories, or unknown audit errors.
export function auditFailures(report, lock) {
  if (report.error || !report.vulnerabilities) return ['Dependency audit did not return a valid report.']
  const vulnerabilities = report.vulnerabilities
  function toolingOnly(name, seen = new Set()) {
    if (seen.has(name)) return false
    const vulnerability = vulnerabilities[name]
    if (!vulnerability?.nodes?.length || !vulnerability.via?.length) return false
    if (!vulnerability.nodes.every(path => lock.packages?.[path]?.dev === true)) return false
    const next = new Set([...seen, name])
    return vulnerability.via.every(cause => typeof cause === 'string'
      ? toolingOnly(cause, next)
      : cause.url === 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' && cause.name === 'picomatch')
  }
  return Object.entries(vulnerabilities)
    .filter(([name, value]) => ['moderate', 'high', 'critical'].includes(value.severity) && !toolingOnly(name))
    .map(([name, value]) => `${name}: ${value.severity}`)
}

if (process.argv[1]?.endsWith('/audit-dependencies.mjs')) {
  let output
  try { output = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }) }
  catch (error) { if (!error.stdout) throw error; output = error.stdout }
  const report = JSON.parse(output)
  const failures = auditFailures(report, JSON.parse(readFileSync('package-lock.json', 'utf8')))
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
  else console.log('Dependency audit passed. Known unpatched picomatch advisory is accepted only in dev-only trusted lint tooling; production paths and all other advisories remain blocking.')
}
