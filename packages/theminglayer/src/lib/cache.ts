import nodePath from 'node:path'

import { cwd } from '~/utils/node'

export const cacheFilePath = nodePath.join(cwd, `.tl`, `cache.json`)

// import fs from 'node:fs'
// import nodePath from 'node:path'

// import { name as packageName } from '~/../package.json'

// let cacheFilePath: string | null

// export const CACHE_FILENAME = `tl.json`

// function isWritable(path: string): boolean {
//   try {
//     fs.accessSync(path, fs.constants.W_OK)
//     return true
//   } catch {
//     return false
//   }
// }

// export function getCacheFilePath(): string | null {
//   if (typeof cacheFilePath === `undefined`) {
//     cacheFilePath = null

//     const parts = process.cwd().split(`/`)

//     while (parts.length) {
//       const currentDirectory = nodePath.join(...parts)

//       const packageJsonPath = nodePath.join(currentDirectory, `package.json`)

//       if (fs.existsSync(packageJsonPath)) {
//         const nodeModulesPath = nodePath.join(currentDirectory, `node_modules`)

//         if (
//           !isWritable(nodeModulesPath) &&
//           (fs.existsSync(nodeModulesPath) || !isWritable(currentDirectory))
//         ) {
//           cacheFilePath = null
//         } else {
//           cacheFilePath = nodePath.join(
//             nodeModulesPath,
//             `.cache`,
//             packageName,
//             CACHE_FILENAME
//           )
//           break
//         }
//       } else {
//         parts.pop()
//       }
//     }
//   }

//   return cacheFilePath
// }
