import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const checkSize = (file, limit) => {
  const lines = read(file).trimEnd().split('\n').length
  if (lines > limit) failures.push(`${file}: ${lines} lines exceeds ${limit}; extract the feature instead of growing its controller.`)
}

// Transitional ceilings for existing controllers. New domain modules stay much smaller.
checkSize('components/BookingWidget.tsx', 6500)
checkSize('components/StaffConsole.tsx', 2500)
checkSize('components/StaffHrHub.tsx', 900)
checkSize('hooks/useTicketCheckout.ts', 450)

const domainFiles = ['lib/staff', 'lib/booking'].flatMap((directory) =>
  readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.ts')).map((name) => `${directory}/${name}`),
)
const graph = new Map()
for (const file of domainFiles) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
  if (!['lib/staff/copy.ts', 'lib/staff/types.ts', 'lib/staff/reporting.ts'].includes(file)) checkSize(file, 600)
  const dependencies = []
  const checkImport = (specifier) => {
    // Storage and lazy client loading have dedicated adapters. Rules must stay independently testable.
    if (file !== 'lib/booking/client.ts' && /(?:^react(?:\/|$)|supabase|(?:^|\/)components\/|(?:^|\/)hooks\/)/.test(specifier)) {
      failures.push(`${file}: runtime dependency on ${specifier}; pass data into the rule or move the effect to its hook.`)
    }
    if (!specifier.startsWith('.')) return
    const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    const target = existsSync(path.join(root, candidate)) ? candidate : `${candidate}.ts`
    if (domainFiles.includes(target)) dependencies.push(target)
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      const hasRuntimeImport = !clause || (!clause.isTypeOnly && (
        clause.name || !named || ts.isNamespaceImport(named) || named.elements.some((item) => !item.isTypeOnly)
      ))
      if (hasRuntimeImport) checkImport(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) checkImport(node.arguments[0].text)
    if (node.kind === ts.SyntaxKind.AnyKeyword) failures.push(`${file}: untyped any breaks the domain boundary.`)
    ts.forEachChild(node, visit)
  }
  visit(source)
  graph.set(file, dependencies)
}
// Feature modules own effects and UI; they must not reach back into their controllers
// or import server-only credentials. Type-only edges do not create runtime cycles.
const featureFiles = ['features/booking', 'features/staff', 'features/hr'].flatMap((directory) =>
  readdirSync(path.join(root, directory)).filter((name) => /\.tsx?$/.test(name)).map((name) => directory + '/' + name),
)
for (const file of featureFiles) {
  checkSize(file, file.includes('.actions.') ? 800 : 950)
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const dependencies = []
  const checkImport = (specifier) => {
    // The staff entry is the only bridge allowed to mount the independent HR controller.
    const isHrEntry = file === 'features/staff/shared.tsx' && specifier === '../../components/StaffHrHub'
    if (!isHrEntry && /(?:server-only|(?:^|\/)app\/.*route|supabaseAdmin|(?:^|\/)server(?:\/|$)|components\/(?:BookingWidget|StaffConsole|StaffHrHub)$)/.test(specifier)) {
      failures.push(file + ': forbidden feature dependency on ' + specifier)
    }
    if (!specifier.startsWith('.')) return
    const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    const target = [candidate, candidate + '.ts', candidate + '.tsx'].find((name) => featureFiles.includes(name))
    if (target) dependencies.push(target)
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      if (!clause || (!clause.isTypeOnly && (clause.name || !named || ts.isNamespaceImport(named) || named.elements.some((item) => !item.isTypeOnly)))) checkImport(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) checkImport(node.arguments[0].text)
    if (node.kind === ts.SyntaxKind.AnyKeyword) failures.push(file + ': use a typed feature contract instead of any.')
    ts.forEachChild(node, visit)
  }
  visit(source)
  graph.set(file, dependencies)
}

const checked = new Set()
function visitDependencies(file, stack = []) {
  if (stack.includes(file)) {
    failures.push(`Circular runtime dependency: ${[...stack, file].join(' -> ')}`)
    return
  }
  if (checked.has(file)) return
  for (const dependency of graph.get(file) ?? []) visitDependencies(dependency, [...stack, file])
  checked.add(file)
}
for (const file of graph.keys()) visitDependencies(file)

for (const entry of ['app/globals.css', 'app/staff/staff.css']) {
  const declarations = read(entry).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*@(import|source)\s+[^;]+;/gm, '').trim()
  if (declarations) failures.push(`${entry}: keep this an ordered import entry point; edit the owning feature stylesheet.`)
}
for (const directory of ['styles/booking', 'styles/staff']) {
  for (const name of readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.css'))) checkSize(`${directory}/${name}`, 2200)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Module boundaries passed: ${domainFiles.length} typed domain modules and ${featureFiles.length} feature modules; ordered CSS entry points and size ceilings respected.`)
}
