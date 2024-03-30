import fs, { type PathLike } from 'node:fs'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'

export async function writeFile(filePath: string, content: string) {
  try {
    return fsp.writeFile(filePath, content, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') {
      await fsp.mkdir(nodePath.dirname(filePath), { recursive: true })
      return fsp.writeFile(filePath, content)
    } else {
      throw e
    }
  }
}

export async function deleteFileAndDirectory(filePath: PathLike) {
  return fsp.rm(filePath, { force: true, recursive: true })
}

export async function text(filePath: PathLike) {
  return fsp.readFile(filePath, 'utf8')
}

export async function json(filePath: PathLike) {
  return JSON.parse(await text(filePath))
}

export async function is(
  filePath: PathLike,
  type: 'File' | 'Directory' = 'File'
) {
  try {
    const stat = await fsp.stat(filePath)
    return stat[`is${type}`]()
  } catch {
    return false
  }
}

export function exists(filePath: PathLike) {
  return fs.existsSync(filePath)
}

// export function fileName(filePath: string) {
//   return nodePath.basename(filePath, nodePath.extname(filePath))
// }

// export function dirName(filePath: string) {
//   return nodePath.basename(nodePath.dirname(filePath))
// }
