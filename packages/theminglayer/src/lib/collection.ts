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
  traverseObj,
} from '~/utils/misc'

export class Collection {
  tokenTree: object = {}
  tokens: Array<Token> = []

  constructor({
    tokenSources,
  }: {
    tokenSources: Array<Array<{ tokenSrc: string; tokenTree: object }>>
  }) {
    tokenSources.forEach((tokenSource) => {
      const tokenTreeFromSource = {}

      tokenSource.forEach(({ tokenSrc, tokenTree }) => {
        this.#mergeTokenTrees(
          { target: tokenTreeFromSource, source: tokenTree },
          {
            onCollision(keys) {
              const nameKeys = generateTokenNameKeys(keys)

              const { tokenSrc: existingTokenSrc } = tokenSource.find(
                ({ tokenTree }) => {
                  return getObjValue(tokenTree, keys)
                }
              )!

              appLogger.warnings.tokenCollision(nameKeys, [
                existingTokenSrc,
                tokenSrc,
              ])
            },
          }
        )
      })
      this.#preprocess(tokenTreeFromSource)
      this.#mergeTokenTrees({
        target: this.tokenTree,
        source: tokenTreeFromSource,
      })
    })

    // resolve any references except for those in token-like objects
    traverseObj(this.tokenTree, (obj, key, _) => {
      if (isToken(obj)) throw 'break'
      // @ts-expect-error todo
      if (!isAlias(obj[key])) return
      // @ts-expect-error todo
      obj[key] = this.#expandReferences(obj[key], { clone: true })
    })

    // convert token-like objects to tokens
    const tokensWithUnknownCategoryOrType: Array<Token> = []

    traverseObj(this.tokenTree, (obj, _, keys) => {
      if (!isToken(obj)) return

      const isComponent = keys[0] === 'component'
      const isGroup = keys[0] === 'group'
      let category: string | null = isComponent || isGroup ? null : keys[0]!
      const component = isComponent ? keys[1] : null

      if (obj.$category) {
        category = obj.$category
      }

      if (isComponent && keys[2] === '$variant') {
        category = 'variant'
      }

      // TODO references may not be a token or token set
      const referencedTokensOrSets = getReferences(obj.$value).reduce<
        Array<Token | TokenSet>
      >((acc, ref) => {
        const referenced = this.#expandReferences(`{${ref}}`)

        if (isToken(referenced) || isTokenSet(referenced)) acc.push(referenced)

        return acc
      }, [])

      const conditionTokens = Object.entries(obj.$condition || {}).map((keys) =>
        this.#expandReferences(`{${['condition', ...keys].join('.')}}`)
      )

      const variantTokens = Object.entries(obj.$variant || {}).reduce(
        (acc, [key, value]) => {
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
          type = getObjValue(this.tokenTree, keys.slice(0, i + 1)).$type || null
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
        Array<Token>
      >((acc, tokenOrSet) => {
        if (isToken(tokenOrSet)) {
          acc.push(tokenOrSet)
        } else if (isTokenSet(tokenOrSet)) {
          acc.push(...tokenOrSet.$set)
        }
        return acc
      }, [])

      for (const referencedToken of referencedTokens) {
        if (
          !Object.hasOwn(token, '$category') &&
          Object.hasOwn(referencedToken, '$category')
        ) {
          const category = referencedToken.$category
          token.$category = category!
          const type = getCategorySpec(category!)?.type
          type && (token.$type = type)
        }
        if (
          !Object.hasOwn(token, '$type') &&
          Object.hasOwn(referencedToken, '$type')
        ) {
          token.$type = referencedToken.$type
        }
        if (
          Object.hasOwn(token, '$type') &&
          Object.hasOwn(token, '$category')
        ) {
          break
        }
      }

      if (
        !Object.hasOwn(token, '$type') ||
        !Object.hasOwn(token, '$category')
      ) {
        tokensWithUnknownCategoryOrType.push(token)
      }
    }

    // collect tokens
    traverseObj(this.tokenTree, (obj, _, keys) => {
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

  #mergeTokenTrees(
    { target, source }: { target: object; source: object },
    { onCollision }: { onCollision?: (keys: Array<string>) => void } = {}
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

  #preprocess(tokenTree: object) {
    // @ts-expect-error todo
    const tokenSetsWithWildcardVariant = []

    traverseObj(tokenTree, (obj, key, keys) => {
      if (!isToken(obj) || !obj.$variant || key !== '$variant') return

      const component = keys[1]
      // @ts-expect-error todo
      const wildcardVariantTokens = []
      const wildcardVariants = {}

      Object.entries(obj.$variant).forEach(([variantKey, variantValue]) => {
        if (variantValue !== '*') return

        // @ts-expect-error todo
        const variants = tokenTree.component[component].$variant[variantKey]
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
        const tokenSet = getObjValue(tokenTree, keys.slice(0, -1))
        tokenSet.push({
          $index: keys.at(-1),
          // @ts-expect-error todo
          $tokens: wildcardVariantTokens,
        })
        tokenSetsWithWildcardVariant.push(tokenSet)
      } else {
        // * convert to $set if not a set
        const token = getObjValue(tokenTree, keys)
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
      const referenced = getObjValue(this.tokenTree, ref.split('.'))
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
