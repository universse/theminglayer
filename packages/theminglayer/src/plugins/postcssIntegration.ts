import nodePath from 'node:path'

import { DefaultFileAndDirectoryPaths, packageName } from '~/lib/constants'
import { CssFormatter } from '~/lib/CssFormatter'
import { isSimpleIsSelector } from '~/lib/cssUtils'
import { cssOptions } from '~/plugins/cssOptions'
import type { PluginCreator, PostcssCachedData } from '~/types'

export const postcssIntegrationPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  keepAliases?: boolean
  safelist?: Array<string>
}> = ({
  prefix = cssOptions.prefix,
  containerSelector = cssOptions.containerSelector,
  keepAliases = false,
  safelist = [],
} = {}) => {
  const filePath = `${Date.now()}`

  return {
    name: `${packageName}/postcss-integration`,
    async build({ collection, addOutputFile, logger }) {
      const cssFormatter = new CssFormatter(collection, {
        prefix,
        containerSelector,
      })

      const data: PostcssCachedData = {
        rulesByCustomPropertyName: {},
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
          $extensions: { keys, conditionTokens, variantTokens },
        } = token

        const isThemed =
          keys.includes('$set') ||
          conditionTokens.length ||
          variantTokens.length

        try {
          if ($type === 'variant' || $type === 'condition') {
            data.customAtRules.push(...cssFormatter.tokenToCssRules(token))
            return
          }

          if ($type === 'typography') {
            const rules = cssFormatter.typographyTokenToCssRules(token, {
              keepAliases,
            })

            rules.forEach((rule) => {
              rule.rule.declarations.forEach((declaration) => {
                data.rulesByCustomPropertyName[declaration.prop] = data
                  .rulesByCustomPropertyName[declaration.prop] || {
                  isStatic: !isThemed,
                  rules: [],
                }

                data.rulesByCustomPropertyName[declaration.prop]!.rules.push({
                  ...rule,
                  rule: {
                    ...rule.rule,
                    declarations: [declaration],
                  },
                })
              })
            })
            return
          }

          const rules = cssFormatter.tokenToCssRules(token, { keepAliases })

          const customPropertyName =
            cssFormatter.tokenToCustomPropertyName(token)

          data.rulesByCustomPropertyName[customPropertyName] = data
            .rulesByCustomPropertyName[customPropertyName] || {
            isStatic: !isThemed,
            rules: [],
          }

          data.rulesByCustomPropertyName[customPropertyName]!.rules.push(
            ...rules
          )
        } catch (e) {
          console.log(e)
          logger.warnings.invalidCssValue(keys)
        }
      })

      addOutputFile({
        filePath: nodePath.join(
          DefaultFileAndDirectoryPaths['.cache'],
          filePath
        ),
        content: JSON.stringify(data),
      })
    },
  }
}
