import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import yaml from 'js-yaml'
import JSON5 from 'json5'

import { TOKEN_CATEGORY_SPEC } from '~/lib/spec'
import { watchMode } from '~/lib/watch-mode'
import type { Token, TokenSet } from '~/types'
import { importJs } from '~/utils/import-js'
import { toSnakeCase } from '~/utils/misc'

export function parseTokenString(tokenString: string) {
  try {
    return JSON.parse(tokenString)
  } catch {}

  try {
    return yaml.load(tokenString)
  } catch {}

  return {}
}

export async function importTokens(filePath: string) {
  switch (nodePath.extname(filePath).slice(1)) {
    case 'js':
    case 'ts': {
      try {
        const { module } = await importJs(filePath, { watch: watchMode.active })
        return module.default ?? module
      } catch {
        return {}
      }
    }
    // case 'js': {
    //   try {
    //     delete require.cache[filePath]
    //     return require(filePath)
    //   } catch {
    //     const url = URL.pathToFileURL(filePath).toString()
    //     return importMjs(url, ms)
    //   }
    // }
    // case 'cjs': {
    //   delete require.cache[filePath]
    //   return require(filePath)
    // }
    // case 'mjs': {
    //   const url = URL.pathToFileURL(filePath).toString()
    //   return importMjs(url, ms)
    // }
    case 'json': {
      try {
        return JSON.parse(await fsp.readFile(filePath, 'utf8'))
      } catch {
        return {}
      }
    }
    case 'json5': {
      try {
        return JSON5.parse(await fsp.readFile(filePath, 'utf8'))
      } catch {
        return {}
      }
    }
    case 'yaml':
      try {
        return yaml.load(await fsp.readFile(filePath, 'utf8'))
      } catch {
        return {}
      }
    default: {
      throw new Error('Unsupported token collection file extension')
    }
  }
}

const ALIAS_RE = /{([^}^\s]+)}/
const EXACT_ALIAS_RE = /^{([^}^\s]+)}$/

const EXACT_INTEGER_WITH_OPTIONAL_UNIT_RE = /^[\d]+[a-zA-Z%]*$/
const EXACT_SIGNED_INTEGER_WITH_OPTIONAL_UNIT_RE = /^[+-][\d]+[a-zA-Z%]*$/

const EXACT_DECIMAL_WITH_OPTIONAL_UNIT_RE = /^(.|[\d]+.)[\d]+[a-zA-Z%]*$/
const EXACT_SIGNED_DECIMAL_WITH_OPTIONAL_UNIT_RE =
  /^[+-](.|[\d]+.)[\d]+[a-zA-Z%]*$/

const OPERATOR_RE = /\s[+\-*/]\s|[()]/

export function isMathExpression(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!OPERATOR_RE.test(value)) return false

  const parts = value
    .replace(/[\s]+/g, ' ')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')')
    .trim()
    .split(OPERATOR_RE)

  return (
    parts.length > 1 &&
    parts.every(
      (part) =>
        part === '' || // split by parentheses
        EXACT_INTEGER_WITH_OPTIONAL_UNIT_RE.test(part) ||
        EXACT_SIGNED_INTEGER_WITH_OPTIONAL_UNIT_RE.test(part) ||
        EXACT_ALIAS_RE.test(part) ||
        EXACT_DECIMAL_WITH_OPTIONAL_UNIT_RE.test(part) ||
        EXACT_SIGNED_DECIMAL_WITH_OPTIONAL_UNIT_RE.test(part)
    )
  )

  // return (
  //   parts.filter(Boolean).length > 1 &&
  //   parts.filter(Boolean).every(
  //     (part) =>
  //       part === '' || // split by parentheses
  //       EXACT_INTEGER_WITH_OPTIONAL_UNIT_RE.test(part) ||
  //       EXACT_SIGNED_INTEGER_WITH_OPTIONAL_UNIT_RE.test(part) ||
  //       EXACT_ALIAS_RE.test(part) ||
  //       EXACT_DECIMAL_WITH_OPTIONAL_UNIT_RE.test(part) ||
  //       EXACT_SIGNED_DECIMAL_WITH_OPTIONAL_UNIT_RE.test(part)
  //   )
  // )
}

export function isAlias(value: unknown): value is string {
  return typeof value === 'string' && ALIAS_RE.test(value)
}

export function getReferences(value: unknown): Array<string> {
  return [...(value?.matchAll?.(new RegExp(ALIAS_RE, 'g')) || [])].map(
    (match) => match[1]
  )
}

export function getCategorySpec(
  category: string | null
): (typeof TOKEN_CATEGORY_SPEC)[keyof typeof TOKEN_CATEGORY_SPEC] | null {
  if (category === null) return null
  return TOKEN_CATEGORY_SPEC[toSnakeCase(category)] || null
}

export function isToken(obj: unknown): obj is Token {
  if (typeof obj !== 'object' || obj === null) return false
  return Object.hasOwn(obj, '$value')
}

export function isTokenSet(obj: unknown): obj is TokenSet {
  if (typeof obj !== 'object' || obj === null) return false
  return Object.hasOwn(obj, '$set')
}

// TODO arg should be token?
export function generateTokenNameKeys(keys: Array<string>): Array<string> {
  const setIndex = keys.indexOf('$set')
  return setIndex > -1 ? keys.slice(0, setIndex) : [...keys]
}
