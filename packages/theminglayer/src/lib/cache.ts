import fs from 'node:fs'
import nodePath from 'node:path'

import type { PostcssCachedData } from '~/types'
import { deleteFileAndDirectory } from '~/utils/misc'
import { DefaultFileAndDirectoryPaths } from './constants'

export function getCacheFilePath(filePath: string): string {
  return nodePath.join(DefaultFileAndDirectoryPaths['.cache'], filePath)
}

export function readCachedFile(filePath: string): PostcssCachedData {
  return JSON.parse(fs.readFileSync(getCacheFilePath(filePath), 'utf8'))
}

export function clearCache() {
  return deleteFileAndDirectory(DefaultFileAndDirectoryPaths['.cache'])
}
