import nodePath from 'node:path'

import { name as packageName, version } from '~/../package.json'
import { cwd } from '~/utils/node'

const directory = `.${packageName}`

export const DefaultFileAndDirectoryPaths = {
  'config.js': nodePath.join(directory, 'config.js'),
  'config.mjs': nodePath.join(directory, 'config.mjs'),
  'config.ts': nodePath.join(directory, 'config.ts'),
  dist: nodePath.join(directory, 'dist'),
  'design-tokens': nodePath.join(directory, 'design-tokens'),
  '.cache': nodePath.join(cwd, directory, '.cache'),
} as const

export { packageName, version }
