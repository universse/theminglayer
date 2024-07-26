import { packageName } from '~/lib/constants'
import { CssFormatter } from '~/lib/CssFormatter'
import {
  createCompareRuleSpecificity,
  generateCss,
  type Rule,
} from '~/lib/cssUtils'
import { cssOptions } from '~/plugins/cssOptions'
import type { PluginCreator, Token } from '~/types'
import * as promises from '~/utils/promises'

export const cssPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  files?: Array<{
    path: string
    filter: (token: Token) => boolean
    keepAliases?: boolean
  }>
}> = ({
  prefix = cssOptions.prefix,
  containerSelector = cssOptions.containerSelector,
  files = [{ path: 'theme.css', filter: () => true, keepAliases: false }],
} = {}) => {
  return {
    name: `${packageName}/css`,
    async build({ collection, addOutputFile, logger }) {
      const cssFormatter = new CssFormatter(collection, {
        prefix,
        containerSelector,
      })

      await promises.mapParallel(
        files,
        async ({ path, filter = () => true, keepAliases = false }) => {
          const rules: Array<Rule> = []

          collection.tokens.forEach((token) => {
            const {
              $type,
              $extensions: { keys },
            } = token

            if (
              $type === 'condition' ||
              $type === 'variant' ||
              $type === 'text'
            )
              return

            if (!filter(token)) return

            try {
              if ($type === 'typography') {
                rules.push(
                  ...cssFormatter.typographyTokenToCssRules(token, {
                    keepAliases,
                  })
                )
              } else {
                rules.push(
                  // @ts-expect-error todo
                  ...cssFormatter.tokenToCssRules(token, { keepAliases })
                )
              }
            } catch (e) {
              logger.warnings.invalidCssValue(keys)
            }
          })

          addOutputFile({
            filePath: path,
            content: generateCss(
              rules.sort(createCompareRuleSpecificity(containerSelector))
            ),
          })
        }
      )
    },
  }
}
