import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'
const target = 'docs/google-sheets-session-ticket-appscript.js'
const marker = '// BEGIN GENERATED BOOKING EMAIL TEMPLATE'
const source = readFileSync('lib/theme/vrenaPalette.ts','utf8').split('export const vrenaSemanticColors')[0].replace(/export /g,'') + '\n' + readFileSync('lib/bookingEmailTemplate.ts', 'utf8').replace(/^import .*\n/gm,'').replace(/export /g, '')
const generated = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None } }).outputText
const current = readFileSync(target, 'utf8').split(marker)[0].trimEnd()
writeFileSync(target, current + '\n\n' + marker + '\n' + generated)
