import nodePath from 'node:path'

import {
  name as PACKAGE_NAME,
  version as PACKAGE_VERSION,
} from '~/../package.json'
import { cwd } from '~/utils/node'

const DIRECTORY = `.${PACKAGE_NAME}`

export const DEFAULT_PATHS = {
  'config.js': nodePath.join(DIRECTORY, 'config.js'),
  'config.mjs': nodePath.join(DIRECTORY, 'config.mjs'),
  'config.ts': nodePath.join(DIRECTORY, 'config.ts'),
  dist: nodePath.join(DIRECTORY, 'dist'),
  'design-tokens': nodePath.join(DIRECTORY, 'design-tokens'),
  '.cache': nodePath.join(cwd, DIRECTORY, '.cache'),
} as const

export { PACKAGE_NAME, PACKAGE_VERSION }
