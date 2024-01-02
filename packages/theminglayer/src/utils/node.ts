import { createRequire } from 'node:module'
import nodePath from 'node:path'
import { fileURLToPath } from 'node:url'

export const cwd = process.cwd()

export const require = createRequire(cwd)

export function filename(meta: ImportMeta): string {
  return typeof __filename === 'undefined'
    ? fileURLToPath(meta.url)
    : __filename
}

export function dirname(meta: ImportMeta): string {
  return nodePath.dirname(filename(meta))
}
