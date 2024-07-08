import { createRequire } from 'node:module'
import nodePath from 'node:path'

export const cwd = process.cwd()

export const require = createRequire(cwd)

export function filename(meta: ImportMeta): string {
  return typeof __filename === 'undefined' ? meta.filename! : __filename
}

export function dirname(meta: ImportMeta): string {
  return typeof __dirname === 'undefined' ? meta.dirname! : __dirname
}

export function resolvePathFromPackage(path: string): string {
  const parts = path.split('/')
  let packageJsonPath = ''
  let packageDir = ''

  while (!packageJsonPath) {
    if (!parts.length) return ''

    packageDir = nodePath.join(packageDir, parts.shift()!)

    try {
      // TODO consider using resolve-cwd package instead
      packageJsonPath = require.resolve(
        nodePath.join(packageDir, 'package.json'),
        { paths: [cwd] }
      )
    } catch {}
  }

  return nodePath.join(
    nodePath.dirname(packageJsonPath),
    path.slice(packageDir.length + 1)
  )
}
