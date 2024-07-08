import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { Node, PluginCreator, Postcss, Root } from 'postcss'

import { name as packageName } from '~/../package.json'
import { CACHE_DIRECTORY, getCacheFilePath, readCachedFile } from '~/lib/cache'
import {
  createCachedInsertRules,
  createCompareRuleSpecificity,
} from '~/lib/cssUtils'

const PLUGIN_NAME = 'postcss-plugin-theminglayer'

type JITEngine = {
  collectRulesFromDeclarationValue: (declarationValue: string) => void
  insertCustomAtRules: (where: Node, postcss: Postcss) => void
  insertCollectedRules: (where: Node, postcss: Postcss) => void
  replaceStaticCustomPropertiesInDeclarationValue: (
    declarationValue: string
  ) => string
}

let lastMtime = 0
let jitEngine: JITEngine

async function getJitEngine(): Promise<JITEngine> {
  const cacheFilePaths = await fsp.readdir(CACHE_DIRECTORY)

  const mtime = cacheFilePaths.reduce<number>(
    (acc, curr) =>
      Math.max(acc, fs.statSync(getCacheFilePath(curr)).mtime.getTime()),
    lastMtime
  )

  if (mtime === lastMtime) {
    return jitEngine
  }

  lastMtime = mtime

  const CUSTOM_PROPERTY_RE_STR = 'var\\(\\s*(--[\\w\\d-_]+)'
  const REPLACEABLE_CUSTOM_PROPERTY_RE_STR = '(var\\(\\s*(--[\\w\\d-_]+)\\))'

  const JIT: {
    rulesByCustomPropertyName: Record<string, Array<any>>
    processedCustomPropertyNames: Set<string>
    collectedCustomAtRules: any
    collectedRules: any
    containerSelector: string
  } = {
    rulesByCustomPropertyName: {},
    processedCustomPropertyNames: new Set(),
    collectedCustomAtRules: [],
    collectedRules: [],
    containerSelector: '',
  }

  cacheFilePaths.forEach((cacheFilePath) => {
    const {
      rulesByCustomPropertyName,
      customAtRules,
      safelist,
      containerSelector,
    } = readCachedFile(cacheFilePath)

    Object.assign(JIT.rulesByCustomPropertyName, rulesByCustomPropertyName)

    JIT.collectedCustomAtRules.push(...customAtRules)
    JIT.containerSelector = containerSelector
    safelist.forEach((value) => {
      collectRulesFromDeclarationValue(value)
    })
  })

  function collectRules(rules: Array<any>) {
    rules.forEach((rule) => {
      JIT.collectedRules.push(rule)

      // @ts-expect-error todo
      rule.rule.declarations.forEach(({ value }) => {
        collectRulesFromDeclarationValue(value)
      })
    })
  }

  function collectRulesFromDeclarationValue(declarationValue: string) {
    const customPropertyRe = new RegExp(CUSTOM_PROPERTY_RE_STR, 'g')
    const matches = [...declarationValue.matchAll(customPropertyRe)]

    matches.forEach(([, customPropertyName]) => {
      if (JIT.processedCustomPropertyNames.has(customPropertyName!)) return
      JIT.processedCustomPropertyNames.add(customPropertyName!)

      const rules =
        // @ts-expect-error todo
        JIT.rulesByCustomPropertyName[customPropertyName!]?.rules || []

      collectRules(rules)
    })
  }

  function replaceStaticCustomPropertiesInDeclarationValue(
    declarationValue: string
  ) {
    return declarationValue.replace(
      new RegExp(REPLACEABLE_CUSTOM_PROPERTY_RE_STR, 'g'),
      (_, customProperty, customPropertyName) => {
        // @ts-expect-error todo
        const { isStatic, rules = [] } =
          JIT.rulesByCustomPropertyName[customPropertyName!] || {}

        // * declarations.length is always 1
        if (isStatic) {
          return rules[0].rule.declarations[0].value
        }

        return customProperty
      }
    )
  }

  jitEngine = {
    collectRulesFromDeclarationValue,
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
    replaceStaticCustomPropertiesInDeclarationValue,
  }

  return jitEngine
}

function getDirective(root: Root): Node | undefined {
  let directive: Node

  root.walkAtRules(packageName, (atRule) => {
    directive = atRule
  })

  return directive!
}

const plugin: PluginCreator<never> = () => {
  return {
    postcssPlugin: PLUGIN_NAME,
    prepare() {
      const jitEnginePromise = getJitEngine()

      return {
        async Declaration(declaration) {
          const {
            collectRulesFromDeclarationValue,
            replaceStaticCustomPropertiesInDeclarationValue,
          } = await jitEnginePromise

          declaration.value = replaceStaticCustomPropertiesInDeclarationValue(
            declaration.value
          )

          collectRulesFromDeclarationValue(declaration.value)
        },
        async Once(root, { postcss }) {
          if (!root.first) return

          const { insertCustomAtRules } = await jitEnginePromise

          insertCustomAtRules(root.first, postcss)
        },
        async OnceExit(root, { result, postcss }) {
          const directive = getDirective(root)
          if (!directive) return

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
      }
    },
  }
}

plugin.postcss = true

export default plugin
