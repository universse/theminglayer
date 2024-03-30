import { klona } from 'klona/json'

import { appLogger } from '~/lib/logger'
import {
  generateTokenNameKeys,
  getCategorySpec,
  getReferences,
  isAlias,
  isToken,
  isTokenSet,
} from '~/lib/token'
import type { Token, TokenSet } from '~/types'
import {
  cartesian,
  deepSet,
  deepSetObj,
  getObjValue,
  isPrimitive,
  toArray,
  traverseObj,
} from '~/utils/misc'

export class Collection {
  tokenObject: object = {}
  tokens: Token[] = []

  constructor({
    tokenSources,
  }: {
    tokenSources: { sourceUnit: string; rawTokenObject: object }[][]
  }) {
    tokenSources.forEach((tokenSource) => {
      const tokenObjectFromSource = {}

      tokenSource.forEach(({ sourceUnit, rawTokenObject }) => {
        this.#mergeTokenObjects(
          { target: tokenObjectFromSource, source: rawTokenObject },
          {
            onCollision(keys) {
              const nameKeys = generateTokenNameKeys(keys)

              const { sourceUnit: existingSourceUnit } = tokenSource.find(
                ({ rawTokenObject }) => {
                  return getObjValue(rawTokenObject, keys)
                }
              )!

              appLogger.warnings.tokenCollision(nameKeys, [
                existingSourceUnit,
                sourceUnit,
              ])
            },
          }
        )
      })
      this.#preprocess(tokenObjectFromSource)
      this.#mergeTokenObjects({
        target: this.tokenObject,
        source: tokenObjectFromSource,
      })
    })

    // resolve any references except for those in token-like objects
    traverseObj(this.tokenObject, (obj, key, _) => {
      if (isToken(obj)) throw 'break'
      // @ts-expect-error todo
      if (!isAlias(obj[key])) return
      // @ts-expect-error todo
      obj[key] = this.#expandReferences(obj[key], { clone: true })
    })

    // convert token-like objects to tokens
    const tokensWithUnknownCategoryOrType: Token[] = []

    traverseObj(this.tokenObject, (obj, _, keys) => {
      if (!isToken(obj)) return

      const isComponent = keys[0] === 'component'
      let category: string | null = isComponent ? null : keys[0]!
      const component = isComponent ? keys[1] : null

      if (obj.$category) {
        category = obj.$category
      }

      if (isComponent && keys[2] === '$variant') {
        category = 'variant'
      }

      // TODO references may not be a token or token set
      const referencedTokensOrSets = getReferences(obj.$value).reduce<
        (Token | TokenSet)[]
      >((acc, ref) => {
        const referenced = this.#expandReferences(`{${ref}}`)
        // @ts-expect-error todo
        referenced && acc.push(referenced)
        return acc
      }, [])

      const conditionTokens = Object.entries(obj.$condition || {}).map((keys) =>
        this.#expandReferences(`{${['condition', ...keys].join('.')}}`)
      )

      const variantTokens = Object.entries(obj.$variant || {}).reduce(
        (acc, [key, value]) => {
          if (!key.startsWith('_') && Array.isArray(value)) {
            // TODO warn
          }

          toArray(value).forEach((value) => {
            let componentKey = component

            if (typeof value === 'object') {
              componentKey = key

              Object.entries(value).forEach(([variantKey, variantValue]) => {
                acc.push(
                  // @ts-expect-error todo
                  this.#expandReferences(
                    `{${['component', componentKey, '$variant', variantKey, variantValue].join('.')}}`
                  )
                )
              })
            } else {
              acc.push(
                // @ts-expect-error todo
                this.#expandReferences(
                  `{${['component', componentKey, '$variant', key, value].join('.')}}`
                )
              )
            }
          })

          return acc
        },
        []
      )

      obj.$extensions = {
        keys,
        // source: obj.$extensions.source,
        // @ts-expect-error todo
        component,
        // @ts-expect-error todo
        conditionTokens,
        variantTokens,
      }

      obj._internal = {
        referencedTokensOrSets,
      }

      // resolve $category & $type through explicitly defined properties or group properties

      let type = obj.$type || getCategorySpec(category)?.type

      if (!type) {
        for (let i = 0; i < keys.length - 1; i++) {
          type =
            getObjValue(this.tokenObject, keys.slice(0, i + 1)).$type || null
          if (type) break
        }
      }

      if (!referencedTokensOrSets.length || type) {
        obj.$type = type
      }

      if (!referencedTokensOrSets.length || category) {
        // @ts-expect-error todo
        obj.$category = category
      }

      if (
        referencedTokensOrSets.length &&
        (category === null || type === null)
      ) {
        tokensWithUnknownCategoryOrType.push(obj)
      }

      throw 'break'
    })

    // resolve $category and $type from referenced tokens
    while (tokensWithUnknownCategoryOrType.length) {
      const token = tokensWithUnknownCategoryOrType.shift()!

      const referencedTokens = token._internal.referencedTokensOrSets.reduce<
        Token[]
      >((acc, tokenOrSet) => {
        if (isToken(tokenOrSet)) {
          acc.push(tokenOrSet)
        } else if (isTokenSet(tokenOrSet)) {
          acc.push(...tokenOrSet.$set)
        }
        return acc
      }, [])

      for (const referencedToken of referencedTokens) {
        if (!('$category' in token) && '$category' in referencedToken) {
          const category = referencedToken.$category
          token.$category = category
          const type = getCategorySpec(category)?.type
          type && (token.$type = type)
        }
        if (!('$type' in token) && '$type' in referencedToken) {
          // @ts-expect-error todo
          token.$type = referencedToken.$type
        }
        if ('$type' in token && '$category' in token) {
          break
        }
      }

      if (!('$type' in token) || !('$category' in token)) {
        tokensWithUnknownCategoryOrType.push(token)
      }
    }

    // collect tokens
    traverseObj(this.tokenObject, (obj, _, keys) => {
      if (!isToken(obj)) return
      if (obj.$type) {
        this.tokens.push(obj)
      } else {
        appLogger.warnings.missingTokenType(keys)
      }
      throw 'break'
    })
  }

  // static fromJSON(data: unknown): Collection {
  //   const collection = Object.create(Collection.prototype)
  //   return Object.assign(collection, data)
  // }

  #mergeTokenObjects(
    { target, source }: { target: object; source: object },
    { onCollision }: { onCollision?: (keys: string[]) => void } = {}
  ): void {
    traverseObj(source, (obj, key, keys) => {
      const objInTarget = getObjValue(target, keys)

      if (isToken(obj) || isTokenSet(obj)) {
        if (onCollision) {
          if (isToken(objInTarget) || isTokenSet(objInTarget)) {
            onCollision(keys)
          }
        }
        if (!objInTarget && !isNaN(+keys.at(-1)!) && !Array.isArray(obj)) {
          deepSetObj(target, keys, obj)
        } else {
          deepSet(target, keys, obj)
        }
        throw 'break'
      }

      // @ts-expect-error todo
      if (isPrimitive(obj[key])) {
        if (!objInTarget && !isNaN(+key) && !Array.isArray(obj)) {
          // @ts-expect-error todo
          deepSetObj(target, [...keys, key], obj[key])
        } else {
          // @ts-expect-error todo
          deepSet(target, [...keys, key], obj[key])
        }
      }
    })
  }

  #preprocess(tokenObject: object) {
    // @ts-expect-error todo
    const tokenSetsWithWildcardVariant = []

    traverseObj(tokenObject, (obj, key, keys) => {
      if (!isToken(obj) || !obj.$variant || key !== '$variant') return

      if (
        Object.values(obj.$variant).filter((value) => value === '*').length > 1
      ) {
        appLogger.warnings.multipleWildcardVariants(keys)
      }

      const component = keys[1]
      // @ts-expect-error todo
      const wildcardVariantTokens = []
      const wildcardVariants = {}

      Object.entries(obj.$variant).forEach(([variantKey, variantValue]) => {
        if (variantValue !== '*') return

        // @ts-expect-error todo
        const variants = tokenObject.component[component].$variant[variantKey]
        // @ts-expect-error todo
        wildcardVariants[variantKey] = Object.keys(variants)
      })
      const wildcardVariantCombinations = cartesian(
        // @ts-expect-error todo
        Object.values(wildcardVariants)
      )
      const wildcardVariantKeys = Object.keys(wildcardVariants)

      wildcardVariantCombinations.forEach((wildcardVariantValues) => {
        const variant = { ...obj.$variant }
        let value = obj.$value

        wildcardVariantValues.forEach((variantValue, i) => {
          const variantKey = wildcardVariantKeys[i]
          // @ts-expect-error todo
          variant[variantKey] = variantValue
          // @ts-expect-error todo
          value = value.replace(`$${variantKey}`, variantValue)
        })

        wildcardVariantTokens.push({ ...obj, $variant: variant, $value: value })
      })

      if (!wildcardVariantTokens.length) return

      const isTokenSet = keys[keys.length - 2] === '$set'

      if (isTokenSet) {
        const tokenSet = getObjValue(tokenObject, keys.slice(0, -1))
        tokenSet.push({
          $index: keys.at(-1),
          // @ts-expect-error todo
          $tokens: wildcardVariantTokens,
        })
        tokenSetsWithWildcardVariant.push(tokenSet)
      } else {
        // * convert to $set if not a set
        const token = getObjValue(tokenObject, keys)
        // @ts-expect-error todo
        token.$set = wildcardVariantTokens
        delete token.$value
        delete token.$condition
        delete token.$variant
      }
    })

    // * clean token sets after wildcard variant expansion
    // @ts-expect-error todo
    tokenSetsWithWildcardVariant.forEach((tokenSet) => {
      // @ts-expect-error todo
      tokenSet.forEach((token, i) => {
        if (token.$index) {
          tokenSet[token.$index] = token.$tokens
          delete tokenSet[i]
        }
      })
      const length = tokenSet.length
      tokenSet.push(...tokenSet.flat())
      tokenSet.splice(0, length)
    })
  }

  #expandReferences(value: unknown, { clone = false } = {}) {
    if (!isAlias(value)) return value

    let resolvedValue

    const refs = getReferences(value)

    refs.forEach((ref) => {
      const referenced = getObjValue(this.tokenObject, ref.split('.'))
      const refString = `{${ref}}`

      if (typeof referenced === 'undefined') {
        appLogger.warnings.missingAlias(ref)
      } else if (isPrimitive(referenced)) {
        if (refs.length === 1) {
          resolvedValue = referenced
        } else {
          resolvedValue = value.replace(refString, referenced)
        }
      } else {
        if (refs.length > 1) {
          // TODO warn unexpected result
        }
        resolvedValue = clone ? klona(referenced) : referenced
      }
    })

    return resolvedValue
  }
}
