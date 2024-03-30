import nodePath from 'node:path'

import { CACHE_DIRECTORY } from '~/lib/cache'
import { CssFormatter } from '~/lib/CssFormatter'
import { isSimpleIsSelector } from '~/lib/cssUtils'
import { cssOptions } from '~/plugins/cssOptions'
import type { PluginCreator, PostcssCachedData } from '~/types'

export const postcssIntegrationPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  keepAliases?: boolean
  safelist?: string[]
}> = ({
  prefix = cssOptions.prefix,
  containerSelector = cssOptions.containerSelector,
  keepAliases = false,
  safelist = [],
} = {}) => {
  const filePath = `${Date.now()}`

  return {
    name: 'theminglayer/postcss-integration',
    async build({ collection, addOutputFile, logger }) {
      const cssFormatter = new CssFormatter(collection, {
        prefix,
        containerSelector,
      })

      const data: PostcssCachedData = {
        rulesByCustomPropertyName: {},
        rulesByClassSelector: {},
        customAtRules: [
          {
            rule: {
              atRules: [
                {
                  name: 'custom-selector',
                  params: `:--tl-container ${
                    isSimpleIsSelector(containerSelector)
                      ? containerSelector.slice(4, -1)
                      : containerSelector
                  }`,
                },
              ],
            },
          },
        ],
        safelist,
        containerSelector,
      }

      collection.tokens.forEach((token) => {
        const {
          $type,
          $extensions: { keys, component },
        } = token

        try {
          if ($type === 'variant' || $type === 'condition') {
            data.customAtRules.push(...cssFormatter.tokenToCssRules(token))
            return
          }

          if ($type === 'typography') {
            const {
              customPropertyRules,
              // classSelectorRules
            } = cssFormatter.typographyTokenToCssRules(token, { keepAliases })

            if (component) {
              const componentClassSelector =
                cssFormatter.tokenToComponentClassSelector(token)

              data.rulesByClassSelector[componentClassSelector] =
                data.rulesByClassSelector[componentClassSelector] || []

              data.rulesByClassSelector[componentClassSelector]!.push(
                ...customPropertyRules
              )
            } else {
              // const typographyClassSelector =
              //   cssFormatter.typographyTokenToClassSelector(token)

              // data.rulesByClassSelector[typographyClassSelector] =
              //   data.rulesByClassSelector[typographyClassSelector] || []

              // data.rulesByClassSelector[typographyClassSelector]!.push(
              //   ...classSelectorRules
              // )

              // const customPropertyName =
              //   cssFormatter.tokenToCustomPropertyName(token)

              customPropertyRules.forEach((rule) => {
                // @ts-expect-error todo
                rule.rule.declarations.forEach((declaration) => {
                  data.rulesByCustomPropertyName[declaration.prop] =
                    data.rulesByCustomPropertyName[declaration.prop] || []

                  data.rulesByCustomPropertyName[declaration.prop]!.push({
                    // @ts-expect-error todo
                    ...rule,
                    rule: {
                      // @ts-expect-error todo
                      ...rule.rule,
                      declarations: [declaration],
                    },
                  })
                })
              })
            }
            return
          }

          const rules = cssFormatter.tokenToCssRules(token, { keepAliases })

          if (component) {
            const componentClassSelector =
              cssFormatter.tokenToComponentClassSelector(token)

            data.rulesByClassSelector[componentClassSelector] =
              data.rulesByClassSelector[componentClassSelector] || []

            data.rulesByClassSelector[componentClassSelector]!.push(...rules)
          } else {
            const customPropertyName =
              cssFormatter.tokenToCustomPropertyName(token)

            data.rulesByCustomPropertyName[customPropertyName] =
              data.rulesByCustomPropertyName[customPropertyName] || []

            data.rulesByCustomPropertyName[customPropertyName]!.push(...rules)
          }
        } catch (e) {
          logger.warnings.invalidCssValue(keys)
        }
      })

      addOutputFile({
        filePath: nodePath.join(CACHE_DIRECTORY, filePath),
        content: JSON.stringify(data),
      })
    },
  }
}
