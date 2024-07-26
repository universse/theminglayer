import {
  compare,
  selectorSpecificity,
  type Specificity,
} from '@csstools/selector-specificity'
import parser from 'postcss-selector-parser'

import { toKebabCase } from '~/utils/misc'

export type Declaration = { prop: string; value: string }

export type AtRule = { name: string; params: string }

export type Rule = {
  component: string | null
  rule: {
    atRules: Array<AtRule>
    selector: string
    declarations: Array<Declaration>
  }
}

const getSpecificity = (() => {
  const processor = parser()

  return (selector: string): Specificity =>
    selectorSpecificity(processor.astSync(selector))
})()

export function createCompareRuleSpecificity(containerSelector: string) {
  return (ruleA: Rule, ruleB: Rule): number => {
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

function addDeclarations(
  target: Map<string, string>,
  declarations: Array<Declaration>
) {
  declarations.forEach(({ prop, value }) => {
    target.set(prop, value)
  })
}

function addNestedRules(
  target: Map<string, string | Map<string, string>>,
  atRules: Array<AtRule>,
  selector: string,
  declarations: Array<Declaration>
) {
  if (atRules.length === 0) {
    if (!target.get(selector)) {
      target.set(selector, new Map())
    }
    // @ts-expect-error todo
    addDeclarations(target.get(selector), declarations)
    return
  }

  const [currentAtRule, ...remainingAtRules] = atRules
  const { name, params } = currentAtRule!

  const atRuleKey = `@${name} ${params}`

  if (!target.get(atRuleKey)) {
    target.set(atRuleKey, new Map())
  }

  if (name.startsWith('custom-')) {
    return
  }

  addNestedRules(
    // @ts-expect-error todo
    target.get(atRuleKey),
    remainingAtRules,
    selector,
    declarations
  )
}

// @ts-expect-error todo
function rulesMapToCss(rulesMap, indent = ''): string {
  return [...rulesMap]
    .map(([key, value]) => {
      if (key.startsWith('@')) {
        // Handle at-rules
        const atRuleContent = rulesMapToCss(value, `${indent}  `)
        return `${indent}${key} {\n${atRuleContent}${indent}}\n`
      } else {
        // Handle selectors and their properties
        const declarations = [...value]
          .map(([prop, val]) => {
            return `${indent}  ${prop}: ${val};\n`
          })
          .join('')
        return `${indent}${key} {\n${declarations}${indent}}\n`
      }
    })
    .join('\n')
}

export function generateCss(rules: Array<Rule>) {
  const groupedByComponent = new Map()

  rules.forEach(({ component, rule }) => {
    if (!groupedByComponent.get(component)) {
      groupedByComponent.set(component, new Map())
    }

    addNestedRules(
      groupedByComponent.get(component),
      rule.atRules,
      rule.selector,
      rule.declarations
    )
  })

  return [...groupedByComponent]
    .map(([, rulesMap]) => rulesMapToCss(rulesMap))
    .join(`\n`)
}

export function cssNameFromKeys(keys: Array<string>): string {
  return toKebabCase(keys.join('-').replace(/\$/g, ''))
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
