import {
  compare,
  selectorSpecificity,
  type Specificity,
} from '@csstools/selector-specificity'
import type { Node, Postcss } from 'postcss'
import parser from 'postcss-selector-parser'

import { toKebabCase } from '~/utils/misc'

const getSpecificity = (() => {
  const processor = parser()

  return (selector: string): Specificity =>
    selectorSpecificity(processor.astSync(selector))
})()

export function createCompareRuleSpecificity(containerSelector: string) {
  return (ruleA, ruleB): number => {
    // TODO sort viewport size atRules?

    if (ruleA.component === ruleB.component) {
      // containerSelector always comes first
      if (
        ruleA.rule.selector === containerSelector &&
        ruleB.rule.selector === containerSelector
      )
        return ruleA.rule.atRules.length - ruleB.rule.atRules.length

      if (ruleA.rule.selector === containerSelector) return -1
      if (ruleB.rule.selector === containerSelector) return 1

      return (
        compare(
          getSpecificity(ruleA.rule.selector),
          getSpecificity(ruleB.rule.selector)
        ) +
        1000 * (ruleA.rule.atRules.length - ruleB.rule.atRules.length)
      )
    }
    if (ruleA.component === null) return -1
    if (ruleB.component === null) return 1
    return ruleA.component < ruleB.component ? -1 : 1
  }
}

export function cssNameFromKeys(keys: string[]): string {
  return toKebabCase(keys.join('-').replace(/\$/g, ''))
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

  return cacheKeys.join('|').replace(/['"]/g, '')
}

export function createCachedInsertRules() {
  const nodeCache = new Map()

  return function (rules, where: Node, postcss: Postcss) {
    rules.forEach(({ component = '', rule }) => {
      const { atRules = [], selector = '', declarations = [] } = rule

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
            atRuleNode = new postcss.AtRule(atRule)
            nodeCache.set(atRuleCacheKey, atRuleNode)
            parent ? parent.append(atRuleNode) : where.before(atRuleNode)
          }

          parent = atRuleNode
        })

        if (selector) {
          node = new postcss.Rule({ selector })
          nodeCache.set(nodeCacheKey, node)
          parent ? parent.append(node) : where.before(node)
        }
      }

      declarations.forEach((declaration) => {
        declaration.value && node.append(new postcss.Declaration(declaration))
      })
    })
  }
}

export function isSimpleIsSelector(selector: string): boolean {
  if (selector.startsWith(':is(') && selector.endsWith(')')) {
    let count = 1
    for (let i = 4; i < selector.length; i++) {
      if (selector.charAt(i) === '(') {
        count++
      } else if (selector.charAt(i) === ')') {
        count--
      }
      if (count === 0) {
        return i === selector.length - 1
      }
    }
  }
  return false
}
