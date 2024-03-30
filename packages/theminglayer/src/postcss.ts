import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { Node, PluginCreator, Postcss } from 'postcss'

import { name as packageName } from '~/../package.json'
import { CACHE_DIRECTORY, getCacheFilePath, readCachedFile } from '~/lib/cache'
import {
  createCachedInsertRules,
  createCompareRuleSpecificity,
} from '~/lib/cssUtils'
import type { Token } from '~/types'
import * as promises from '~/utils/promises'

const PLUGIN_NAME = 'postcss-plugin-theminglayer'

let lastMtime = 0
// @ts-expect-error todo
let jitEngine

async function getJitEngine() {
  const cacheFilePaths = await fsp.readdir(CACHE_DIRECTORY)

  const mtime = cacheFilePaths.reduce<number>(
    (acc, curr) =>
      Math.max(acc, fs.statSync(getCacheFilePath(curr)).mtime.getTime()),
    lastMtime
  )

  if (mtime === lastMtime) {
    // @ts-expect-error todo
    return jitEngine
  }

  lastMtime = mtime

  const CUSTOM_PROPERTY_RE = `var\\(\\s*(--[\\w\\d-_]+)`
  const SELECTOR_RE = `\\.[\\w\\d-_]+`

  const JIT: {
    rulesByCustomPropertyName: Record<string, Token[]>
    rulesByClassSelector: Record<string, Token[]>
    processedCustomPropertyNamesAndClassSelectors: Set<string>
    collectedCustomAtRules: any
    collectedRules: any
    containerSelector: string
  } = {
    rulesByCustomPropertyName: {},
    rulesByClassSelector: {},
    processedCustomPropertyNamesAndClassSelectors: new Set(),
    collectedCustomAtRules: [],
    collectedRules: [],
    containerSelector: '',
  }

  await promises.mapParallel(cacheFilePaths, async (cacheFilePath) => {
    const {
      rulesByCustomPropertyName,
      rulesByClassSelector,
      customAtRules,
      safelist,
      containerSelector,
    } = await readCachedFile(cacheFilePath)

    Object.assign(JIT.rulesByClassSelector, rulesByClassSelector)
    Object.assign(JIT.rulesByCustomPropertyName, rulesByCustomPropertyName)

    JIT.collectedCustomAtRules.push(...customAtRules)
    JIT.containerSelector = containerSelector
    safelist.forEach((value) => {
      collectRulesFromDeclarationValue(value)
    })
  })

  function collectRules(rules: any[]) {
    rules.forEach((rule) => {
      JIT.collectedRules.push(rule)

      // @ts-expect-error todo
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

      const rules = JIT.rulesByClassSelector[classSelector] || []
      collectRules(rules)
    })
  }

  jitEngine = {
    collectRulesFromDeclarationValue,
    collectRulesFromSelector,
    insertCustomAtRules(where: Node, postcss: Postcss) {
      const insertRules = createCachedInsertRules()
      insertRules(JIT.collectedCustomAtRules, where, postcss)
    },
    insertCollectedRules(where: Node, postcss: Postcss) {
      const insertRules = createCachedInsertRules()
      insertRules(
        JIT.collectedRules.sort(
          createCompareRuleSpecificity(JIT.containerSelector)
        ),
        where,
        postcss
      )
    },
  }

  return jitEngine
}

const plugin: PluginCreator<never> = () => {
  return {
    postcssPlugin: PLUGIN_NAME,
    prepare() {
      const jitEnginePromise = getJitEngine()

      return {
        async Once(root, { postcss }) {
          if (!root.first) return

          const { insertCustomAtRules } = await jitEnginePromise
          insertCustomAtRules(root.first, postcss)
        },
        async OnceExit(root, { result, postcss }) {
          let directive: Node

          root.walkAtRules(packageName, (atRule) => {
            directive = atRule
          })

          if (!directive!) return

          const { insertCollectedRules } = await jitEnginePromise
          insertCollectedRules(directive, postcss)

          directive.remove()

          result.messages.push({
            type: 'dir-dependency',
            dir: CACHE_DIRECTORY,
            plugin: PLUGIN_NAME,
            parent: result.opts.from,
          })
        },
        async Rule(rule) {
          const { collectRulesFromDeclarationValue, collectRulesFromSelector } =
            await jitEnginePromise

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
