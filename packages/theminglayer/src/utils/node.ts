import { createRequire } from 'node:module'

export const cwd = process.cwd()

export const require = createRequire(cwd)

export function filename(meta: ImportMeta): string {
  return typeof __filename === 'undefined' ? meta.filename! : __filename
}

export function dirname(meta: ImportMeta): string {
  return typeof __dirname === 'undefined' ? meta.dirname! : __dirname
}
