import postcss, {
  type AtRule,
  type PluginCreator as PostcssPluginCreator,
} from 'postcss'

import { name as packageName } from '~/../package.json'
import { CssFormatter } from '~/lib/CssFormatter'
import {
  createCachedInsertRules,
  createCompareRuleSpecificity,
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
  const postcssPlugin: PostcssPluginCreator<{
    rules: Array<unknown>
  }> = ({ rules } = { rules: [] }) => {
    const insertRules = createCachedInsertRules()

    return {
      postcssPlugin: 'postcss-name',
      Once(root, { postcss }) {
        let directive: AtRule
        root.walkAtRules(packageName, (atRule) => {
          directive = atRule
        })
        insertRules(
          rules.sort(createCompareRuleSpecificity(containerSelector)),
          directive!,
          postcss
        )
        directive!.remove()
      },
    }
  }

  postcssPlugin.postcss = true

  return {
    name: 'theminglayer/css',
    async build({ collection, addOutputFile, logger }) {
      const cssFormatter = new CssFormatter(collection, {
        prefix,
        containerSelector,
      })

      await promises.mapParallel(
        files,
        async ({ path, filter = () => true, keepAliases = false }) => {
          // @ts-expect-error todo
          const rules = []

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
                  ...cssFormatter.tokenToCssRules(token, { keepAliases })
                )
              }
            } catch (e) {
              logger.warnings.invalidCssValue(keys)
            }
          })

          // TODO add postcss preset env?
          // @ts-expect-error todo
          const result = await postcss([postcssPlugin({ rules })]).process(
            '@theminglayer',
            { from: undefined! }
          )

          addOutputFile({
            filePath: path,
            content: result.css,
          })
        }
      )
    },
  }
}
