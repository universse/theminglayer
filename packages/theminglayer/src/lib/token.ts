import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import yaml from 'js-yaml'
import JSON5 from 'json5'

import { TokenCategorySpec } from '~/lib/spec'
import { watchMode } from '~/lib/watchMode'
import { type Token, type TokenSet } from '~/types'
import { importJs } from '~/utils/importJs'
import { toSnakeCase } from '~/utils/misc'

export async function importTokens(filePath: string) {
  switch (nodePath.extname(filePath).slice(1)) {
    case `js`:
    case `ts`: {
      const { module } = await importJs(filePath, { watch: watchMode.active })
      return module.default ?? module
    }
    // case `js`: {
    //   try {
    //     delete require.cache[filePath]
    //     return require(filePath)
    //   } catch {
    //     const url = URL.pathToFileURL(filePath).toString()
    //     return importMjs(url, ms)
    //   }
    // }
    // case `cjs`: {
    //   delete require.cache[filePath]
    //   return require(filePath)
    // }
    // case `mjs`: {
    //   const url = URL.pathToFileURL(filePath).toString()
    //   return importMjs(url, ms)
    // }
    case `json`:
    case `json5`: {
      return JSON5.parse(await fsp.readFile(filePath, `utf-8`))
    }
    case `yaml`:
      return yaml.load(await fsp.readFile(filePath, `utf8`))
    default: {
      throw new Error(`Unsupported token collection file extension`)
    }
  }
}

export const ALIAS_REGEXP = /{([^}]+)}/

export function isAlias(value: unknown): value is string {
  return typeof value === `string` && ALIAS_REGEXP.test(value)
}

export function getReferences(value: unknown): string[] {
  return [...(value?.matchAll?.(new RegExp(ALIAS_REGEXP, `g`)) || [])].map(
    (match) => match[1]
  )
}

export function getCategorySpec(
  category: string | null
): (typeof TokenCategorySpec)[keyof typeof TokenCategorySpec] | null {
  if (category === null) return null
  return TokenCategorySpec[toSnakeCase(category)] || null
}

export function isToken(obj: unknown): obj is Token {
  if (typeof obj !== `object` || obj === null) return false
  return `$value` in obj
}

export function isTokenSet(obj: unknown): obj is TokenSet {
  if (typeof obj !== `object` || obj === null) return false
  return `$set` in obj
}

// TODO arg should be token?
export function generateTokenNameKeys(keys: string[]): string[] {
  const setIndex = keys.indexOf(`$set`)
  return setIndex > -1 ? keys.slice(0, setIndex) : [...keys]
}
