import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import setWith from 'lodash.setwith'

export function traverseObj(
  obj: object,
  fn: (obj: object, key: string, keys: string[]) => unknown
) {
  const keys: string[] = []

  function run(current: object) {
    for (const key in current) {
      try {
        keys.push(key)

        fn(current, key, keys.slice(0, -1))

        // to stop and process to next key, throw `continue`. it is necessary when fn turns current[key] from a primitive value into an object and there is no need to traverse that object
        // to stop and exit the current object, throw `break`

        if (current[key] && !isPrimitive(current[key])) {
          run(current[key])
        }
      } catch (error) {
        if (error === 'break') {
          break
        } else if (error === 'continue') {
          continue
        } else {
          throw error
        }
      } finally {
        keys.pop()
      }
    }
  }

  return run(obj)
}

export function getObjValue(obj: any, keys: string[]): any {
  let value = obj

  for (const key of keys) {
    value = value[key]
    if (!value) return
  }

  return value
}

export function deepSet(obj, paths, value) {
  return setWith(obj, paths, value)
}

export function deepSetObj(obj, paths, value) {
  return setWith(obj, paths, value, Object)
}

export function toArray<T>(value: T | T[]): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

export function isPrimitive(val: unknown): boolean {
  return Object(val) !== val
}

export function isNullish(val: unknown): boolean {
  return typeof val === 'undefined' || val === null
}

export function generateKeyString(keys: string[]): string {
  return keys.join('.')
}

export function toKebabCase(str: string): string {
  return (
    str
      // TODO improve camelCase to kebab-case conversion to handle uppercase word
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  )
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

export async function writeFile(filePath: string, data: string) {
  await fsp.mkdir(nodePath.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, data, 'utf8')
}

export async function deleteFileAndDirectory(filePath: string) {
  await fsp.rm(filePath, { force: true, recursive: true })
}
