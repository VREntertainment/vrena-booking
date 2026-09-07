import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** Expand local stylesheet imports in cascade order for source-based theme checks. */
export async function readStylesheet(file, ancestors = []) {
  const absolutePath = path.resolve(file)
  if (ancestors.includes(absolutePath)) throw new Error(`Circular CSS import: ${absolutePath}`)
  const source = await readFile(absolutePath, 'utf8')
  const parts = []
  let cursor = 0
  for (const match of source.matchAll(/^@import\s+["']([^"']+)["'][^;]*;\s*$/gm)) {
    parts.push(source.slice(cursor, match.index))
    if (match[1].startsWith('.')) {
      parts.push(await readStylesheet(path.resolve(path.dirname(absolutePath), match[1]), [...ancestors, absolutePath]))
    }
    cursor = match.index + match[0].length
  }
  parts.push(source.slice(cursor))
  return parts.join('\n')
}
