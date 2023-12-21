import fsp from 'node:fs/promises'
import { type AtRule, type PluginCreator, type Postcss } from 'postcss'

import { name as packageName } from '~/../package.json'
import { cacheFilePath } from '~/lib/cache'
import { CssFormatter } from '~/lib/CssFormatter'
import { compareRuleSpecificity, createCachedInsertRules } from '~/lib/cssUtils'
import { type CachedBuild, type Token } from '~/types'

export type PluginOptions = {
  safelist?: string[]
  outputVariable?: boolean
}

const PLUGIN_NAME = `postcss-plugin-theminglayer`

async function createJitEngine({
  safelist,
  outputVariable,
}: Required<PluginOptions>) {
  const JIT: {
    cssFormattersByPrefix: Map<string, CssFormatter>
    tokensByVariableName: Record<string, Token[]>
    tokensByComponentClassSelector: Record<string, Token[]>
    processVariableNamesAndClassSelectors: Set<string>
    prefixesToMatch: string[]
    collectedRules: any
    collectedCustomAtRules: any
  } = {
    cssFormattersByPrefix: new Map(),
    tokensByVariableName: {},
    tokensByComponentClassSelector: {},
    processVariableNamesAndClassSelectors: new Set(),
    prefixesToMatch: [],
    collectedRules: [],
    collectedCustomAtRules: [],
  }

  const { Collection } = await import(`theminglayer`)

  const { data }: CachedBuild = JSON.parse(
    await fsp.readFile(cacheFilePath, `utf-8`)
  )

  data.forEach(({ collectionData, buildOptions: { prefix } }) => {
    const collection = Collection.fromJSON(collectionData)

    const { tokens } = collection

    const cssFormatter = new CssFormatter(collection, { prefix })

    JIT.cssFormattersByPrefix.set(prefix, cssFormatter)
    JIT.prefixesToMatch.push(prefix)

    tokens.forEach((token) => {
      const {
        $category: category,
        $extensions: { component },
      } = token

      if (category === `variant` || category === `condition`) {
        JIT.collectedCustomAtRules.push(...cssFormatter.tokenToCssRules(token))
        return
      }

      if (category === `typography` && !component) {
        JIT.collectedRules.push(
          ...cssFormatter.tokenToCssRules(token, { outputVariable })
        )
        return
      }

      if (component) {
        const componentClassSelector = `.${prefix}${component}`

        JIT.tokensByComponentClassSelector[componentClassSelector] =
          JIT.tokensByComponentClassSelector[componentClassSelector] || []

        JIT.tokensByComponentClassSelector[componentClassSelector]!.push(token)
      } else {
        const variableName = cssFormatter.tokenToCssVariableName(token)

        JIT.tokensByVariableName[variableName] =
          JIT.tokensByVariableName[variableName] || []

        JIT.tokensByVariableName[variableName]!.push(token)
      }
    })
  })

  const prefixRegExp = JIT.prefixesToMatch.join(`|`)
  const CUSTOM_PROPERTY_REG_EXP = `var\\(\\s*(--(${prefixRegExp})[\\w\\d-_]+)`
  const SELECTOR_REG_EXP = `\\.(${prefixRegExp})[\\w\\d-_]+`

  safelist.forEach((value) => {
    collectRulesFromDeclarationValue(value)
  })

  function rulesFromTokens(tokens: Token[], prefix: string) {
    tokens.forEach((token) => {
      const rules = JIT.cssFormattersByPrefix
        .get(prefix)!
        .tokenToCssRules(token, { outputVariable })

      JIT.collectedRules.push(...rules)

      rules.forEach(({ rule: { declarations } }) => {
        declarations.forEach(({ value }) => {
          collectRulesFromDeclarationValue(value)
        })
      })
    })
  }

  function collectRulesFromDeclarationValue(declarationValue: string) {
    const regExp = new RegExp(CUSTOM_PROPERTY_REG_EXP, `g`)
    const matches = [...declarationValue.matchAll(regExp)]

    matches.forEach(([, variableName, prefix]) => {
      if (JIT.processVariableNamesAndClassSelectors.has(variableName!)) return
      JIT.processVariableNamesAndClassSelectors.add(variableName!)

      const tokens = JIT.tokensByVariableName[variableName!] || []
      rulesFromTokens(tokens, prefix!)
    })
  }

  function collectRulesFromSelector(selector: string) {
    const regExp = new RegExp(SELECTOR_REG_EXP, `g`)
    const matches = [...selector.matchAll(regExp)]

    matches.forEach(([classSelector, prefix]) => {
      if (JIT.processVariableNamesAndClassSelectors.has(classSelector)) return
      JIT.processVariableNamesAndClassSelectors.add(classSelector)

      const tokens = JIT.tokensByComponentClassSelector[classSelector] || []
      rulesFromTokens(tokens, prefix!)
    })
  }

  const insertRules = createCachedInsertRules()

  return {
    cacheFilePath,
    collectRulesFromDeclarationValue,
    collectRulesFromSelector,
    insertCustomAtRules(directive: AtRule, postcss: Postcss) {
      insertRules(JIT.collectedCustomAtRules, directive, postcss)
    },
    insertCollectedRules(directive: AtRule, postcss: Postcss) {
      insertRules(
        JIT.collectedRules.sort(compareRuleSpecificity),
        directive,
        postcss
      )
    },
  }
}

const plugin: PluginCreator<PluginOptions> = (options = {}) => {
  const DEFAULT_OPTIONS = { safelist: [], outputVariable: false }

  return {
    postcssPlugin: PLUGIN_NAME,
    prepare() {
      const pluginOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
      }

      let directive: AtRule

      let jitEngine: ReturnType<typeof createJitEngine>

      function getJitEngine() {
        if (!jitEngine) {
          jitEngine = createJitEngine(pluginOptions)
        }
        return jitEngine
      }

      return {
        async Once(root, { result, postcss }) {
          root.walkAtRules(packageName, (atRule) => {
            directive = atRule
          })

          if (!directive) return

          const { cacheFilePath, insertCustomAtRules } = await getJitEngine()

          result.messages.push({
            type: `dependency`,
            file: cacheFilePath,
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
            if (node.type === `decl`) {
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
