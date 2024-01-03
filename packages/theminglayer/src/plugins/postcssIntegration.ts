import nodePath from 'node:path'

import { CACHE_DIRECTORY } from '~/lib/cache'
import { CssFormatter } from '~/lib/CssFormatter'
import { cssOptions } from '~/plugins/cssOptions'
import { type PluginCreator, type PostcssCachedData } from '~/types'

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
  return {
    name: 'theminglayer/postcss-integration',
    async build({ collection, addOutputFile }) {
      const cssFormatter = new CssFormatter(collection, {
        prefix,
        containerSelector,
      })

      const data: PostcssCachedData = {
        rulesByCustomPropertyName: {},
        rulesByComponentClassSelector: {},
        typographyRules: [],
        customAtRules: [
          {
            rule: {
              atRules: [
                {
                  name: 'custom-selector',
                  params: `:--tl-container ${
                    containerSelector.startsWith(':is(') &&
                    containerSelector.endsWith(')')
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
          $category: category,
          $extensions: { component },
        } = token

        if (category === 'variant' || category === 'condition') {
          data.customAtRules.push(...cssFormatter.tokenToCssRules(token))
          return
        }

        if (category === 'typography' && !component) {
          data.typographyRules.push(
            ...cssFormatter.tokenToCssRules(token, { keepAliases })
          )
          return
        }

        if (component) {
          const componentClassSelector =
            cssFormatter.tokenToComponentClassSelector(token)

          data.rulesByComponentClassSelector[componentClassSelector] =
            data.rulesByComponentClassSelector[componentClassSelector] || []

          data.rulesByComponentClassSelector[componentClassSelector]!.push(
            ...cssFormatter.tokenToCssRules(token, { keepAliases })
          )
        } else {
          const customPropertyName =
            cssFormatter.tokenToCssCustomPropertyName(token)

          data.rulesByCustomPropertyName[customPropertyName] =
            data.rulesByCustomPropertyName[customPropertyName] || []

          data.rulesByCustomPropertyName[customPropertyName]!.push(
            ...cssFormatter.tokenToCssRules(token, { keepAliases })
          )
        }
      })

      addOutputFile({
        filePath: nodePath.join(CACHE_DIRECTORY, `${Date.now()}`),
        content: JSON.stringify(data),
      })
    },
  }
}
