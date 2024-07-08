import fs from 'node:fs'
import nodePath from 'node:path'

import type { PostcssCachedData } from '~/types'
import { deleteFileAndDirectory } from '~/utils/misc'
import { cwd } from '~/utils/node'

export const CACHE_DIRECTORY = nodePath.join(cwd, '.tl')

export function getCacheFilePath(filePath: string): string {
  return nodePath.join(CACHE_DIRECTORY, filePath)
}

export function readCachedFile(filePath: string): PostcssCachedData {
  return JSON.parse(fs.readFileSync(getCacheFilePath(filePath), 'utf8'))
}

export function clearCache() {
  return deleteFileAndDirectory(CACHE_DIRECTORY)
}
