import {
  compare,
  selectorSpecificity,
  type Specificity,
} from '@csstools/selector-specificity'
import { type AtRule, type Postcss } from 'postcss'
import parser from 'postcss-selector-parser'

import { toKebabCase } from '~/utils/misc'

const getSpecificity = (() => {
  const processor = parser()

  return (selector: string): Specificity =>
    selectorSpecificity(processor.astSync(selector))
})()

export function compareRuleSpecificity(ruleA, ruleB): number {
  // TODO sort viewport size atRules?

  if (ruleA.component === ruleB.component) {
    // :root always comes first
    if (ruleA.rule.selector === `:root` && ruleB.rule.selector === `:root`)
      return ruleA.rule.atRules.length - ruleB.rule.atRules.length

    if (ruleA.rule.selector === `:root`) return -1
    if (ruleB.rule.selector === `:root`) return 1

    return (
      compare(
        getSpecificity(ruleA.rule.selector),
        getSpecificity(ruleB.rule.selector)
      ) +
      ruleA.rule.atRules.length * 1_000 -
      ruleB.rule.atRules.length * 1_000
    )
  }
  if (ruleA.component === null) return -1
  if (ruleB.component === null) return 1
  return ruleA.component < ruleB.component ? -1 : 1
}

export function cssNameFromKey(keys: string[]): string {
  return cssName(keys.join(`-`))
}

function cssName(name: string) {
  return toKebabCase(name.replace(/\$/g, ``))
}

function generateNodeCacheKey(
  component: string | null,
  atRules,
  selector?: string
) {
  const cacheKeys = []

  component && cacheKeys.push(component)
  atRules.forEach(({ name, params }) => cacheKeys.push(`${name}:${params}`))
  selector && cacheKeys.push(selector)

  return cacheKeys.join(`|`).replace(/['"]/g, ``)
}

export function createCachedInsertRules() {
  const nodeCache = new Map()

  return function (rules, directive: AtRule, postcss: Postcss) {
    rules.forEach(({ component = ``, rule }) => {
      const { atRules = [], selector = ``, declarations = [] } = rule

      const nodeCacheKey = generateNodeCacheKey(component, atRules, selector)
      let node = nodeCache.get(nodeCacheKey)

      if (!node) {
        let parent

        atRules.forEach((atRule, i) => {
          const atRuleCacheKey = generateNodeCacheKey(
            component,
            atRules.slice(0, i + 1)
          )
          let atRuleNode = nodeCache.get(atRuleCacheKey)

          if (!atRuleNode) {
            atRuleNode = new postcss.AtRule({
              ...atRule,
              source: directive.source,
            })
            nodeCache.set(atRuleCacheKey, atRuleNode)
            parent ? parent.append(atRuleNode) : directive.before(atRuleNode)
          }

          parent = atRuleNode
        })

        if (selector) {
          node = new postcss.Rule({ selector, source: directive.source })
          nodeCache.set(nodeCacheKey, node)
          parent ? parent.append(node) : directive.before(node)
        }
      }

      declarations.forEach((declaration) => {
        declaration.value &&
          node.append(
            new postcss.Declaration({
              ...declaration,
              source: directive.source,
            })
          )
      })
    })
  }
}
