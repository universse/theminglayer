import fsp from 'node:fs/promises'
import nodePath from 'node:path'

import { type PostcssCachedData } from '~/types'
import { deleteFileAndDirectory } from '~/utils/misc'
import { cwd } from '~/utils/node'

export const CACHE_DIRECTORY = nodePath.join(cwd, '.tl')

export async function readCachedFile(
  filePath: string
): Promise<PostcssCachedData> {
  return JSON.parse(
    await fsp.readFile(nodePath.join(CACHE_DIRECTORY, filePath), 'utf8')
  )
}

export function clearCache() {
  return deleteFileAndDirectory(CACHE_DIRECTORY)
}
