import fsp from 'node:fs/promises'
import { type AtRule, type PluginCreator, type Postcss } from 'postcss'

import { name as packageName } from '~/../package.json'
import { CACHE_DIRECTORY, readCachedFile } from '~/lib/cache'
import {
  createCachedInsertRules,
  createCompareRuleSpecificity,
} from '~/lib/cssUtils'
import { type Token } from '~/types'
import * as promises from '~/utils/promises'

const PLUGIN_NAME = 'postcss-plugin-theminglayer'

async function createJitEngine() {
  const CUSTOM_PROPERTY_RE = `var\\(\\s*(--[\\w\\d-_]+)`
  const SELECTOR_RE = `\\.[\\w\\d-_]+`

  const JIT: {
    rulesByCustomPropertyName: Record<string, Token[]>
    rulesByComponentClassSelector: Record<string, Token[]>
    processedCustomPropertyNamesAndClassSelectors: Set<string>
    collectedCustomAtRules: any
    collectedRules: any
    containerSelector: string
  } = {
    rulesByCustomPropertyName: {},
    rulesByComponentClassSelector: {},
    processedCustomPropertyNamesAndClassSelectors: new Set(),
    collectedCustomAtRules: [],
    collectedRules: [],
    containerSelector: '',
  }

  const cacheFilePaths = await fsp.readdir(CACHE_DIRECTORY)

  await promises.mapParallel(cacheFilePaths, async (cacheFilePath) => {
    const {
      rulesByCustomPropertyName,
      rulesByComponentClassSelector,
      typographyRules,
      customAtRules,
      safelist,
      containerSelector,
    } = await readCachedFile(cacheFilePath)

    Object.assign(
      JIT.rulesByComponentClassSelector,
      rulesByComponentClassSelector
    )
    Object.assign(JIT.rulesByCustomPropertyName, rulesByCustomPropertyName)

    JIT.collectedRules.push(...typographyRules)
    JIT.collectedCustomAtRules.push(...customAtRules)
    JIT.containerSelector = containerSelector
    safelist.forEach((value) => {
      collectRulesFromDeclarationValue(value)
    })
  })

  function collectRules(rules: any[]) {
    rules.forEach((rule) => {
      JIT.collectedRules.push(rule)

      rule.rule.declarations.forEach(({ value }) => {
        collectRulesFromDeclarationValue(value)
      })
    })
  }

  function collectRulesFromDeclarationValue(declarationValue: string) {
    const customPropertyRe = new RegExp(CUSTOM_PROPERTY_RE, 'g')
    const matches = [...declarationValue.matchAll(customPropertyRe)]

    matches.forEach(([, customPropertyName]) => {
      if (
        JIT.processedCustomPropertyNamesAndClassSelectors.has(
          customPropertyName!
        )
      )
        return
      JIT.processedCustomPropertyNamesAndClassSelectors.add(customPropertyName!)

      const rules = JIT.rulesByCustomPropertyName[customPropertyName!] || []
      collectRules(rules)
    })
  }

  function collectRulesFromSelector(selector: string) {
    const selectorRe = new RegExp(SELECTOR_RE, 'g')
    const matches = [...selector.matchAll(selectorRe)]

    matches.forEach(([classSelector]) => {
      if (JIT.processedCustomPropertyNamesAndClassSelectors.has(classSelector))
        return
      JIT.processedCustomPropertyNamesAndClassSelectors.add(classSelector)

      const rules = JIT.rulesByComponentClassSelector[classSelector] || []
      collectRules(rules)
    })
  }

  const insertRules = createCachedInsertRules()

  return {
    collectRulesFromDeclarationValue,
    collectRulesFromSelector,
    insertCustomAtRules(directive: AtRule, postcss: Postcss) {
      insertRules(JIT.collectedCustomAtRules, directive, postcss)
    },
    insertCollectedRules(directive: AtRule, postcss: Postcss) {
      insertRules(
        JIT.collectedRules.sort(
          createCompareRuleSpecificity(JIT.containerSelector)
        ),
        directive,
        postcss
      )
    },
  }
}

const plugin: PluginCreator<never> = () => {
  return {
    postcssPlugin: PLUGIN_NAME,
    prepare() {
      let directive: AtRule

      let jitEngine: ReturnType<typeof createJitEngine>

      function getJitEngine() {
        if (!jitEngine) {
          jitEngine = createJitEngine()
        }
        return jitEngine
      }

      return {
        async Once(root, { result, postcss }) {
          root.walkAtRules(packageName, (atRule) => {
            directive = atRule
          })

          if (!directive) return

          const { insertCustomAtRules } = await getJitEngine()

          result.messages.push({
            type: 'dir-dependency',
            dir: CACHE_DIRECTORY,
            plugin: PLUGIN_NAME,
            parent: result.opts.from,
          })

          insertCustomAtRules(directive, postcss)
        },
        async OnceExit(root, { postcss }) {
          if (!directive) return

          // reassign to handle Tailwind usage as @theminglayer is recommended to be nested within Tailwind's @layer base
          root.walkAtRules(packageName, (atRule) => {
            directive = atRule
          })

          const { insertCollectedRules } = await getJitEngine()

          insertCollectedRules(directive, postcss)

          directive.remove()
        },
        async Rule(rule) {
          if (!directive) return

          const { collectRulesFromDeclarationValue, collectRulesFromSelector } =
            await getJitEngine()

          rule.nodes.forEach((node) => {
            if (node.type === 'decl') {
              collectRulesFromDeclarationValue(node.value)
            }
          })

          collectRulesFromSelector(rule.selector)
        },
      }
    },
  }
}

plugin.postcss = true

export default plugin
