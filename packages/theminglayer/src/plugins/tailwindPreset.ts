import { CssFormatter } from '~/lib/CssFormatter'
import { cssNameFromKey } from '~/lib/cssUtils'
import { generateTokenNameKeys, getCategorySpec } from '~/lib/token'
import { cssOptions } from '~/plugins/cssOptions'
import { type PluginCreator, type Token } from '~/types'
import { deepSetObj } from '~/utils/misc'
import * as promises from '~/utils/promises'

export const tailwindPresetPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  files?: {
    path: string
    filter: (token: Token) => boolean
    format?: 'esm' | 'cjs'
    keepAliases?: boolean
  }[]
}> = ({
  prefix = cssOptions.prefix,
  containerSelector = cssOptions.containerSelector,
  files = [
    {
      path: 'tailwindPreset.js',
      format: 'esm' as const,
      filter: () => true,
      keepAliases: false,
    },
  ],
} = {}) => {
  return {
    name: 'theminglayer/tailwind-preset',
    async build({ collection, addOutputFile }) {
      const cssFormatter = new CssFormatter(collection, {
        prefix,
        containerSelector,
      })

      await promises.mapParallel(
        files,
        async ({
          path,
          filter = () => true,
          format = 'esm',
          keepAliases = false,
        }) => {
          const theme = {}
          const variants: Record<string, string> = {}

          collection.tokens.forEach((token) => {
            if (!filter(token)) return

            const {
              $type: type,
              $category: category,
              $extensions: { component },
            } = token

            if (component) return
            if (
              type === 'typography' ||
              type === 'text' ||
              // future
              type === 'gradient' ||
              type === 'keyframes'
            )
              return

            if (category === 'condition') {
              const value = cssFormatter.aliasesToCssValue(token.$value)
              const atRule = value.match(/@(\S*)/)?.[1]

              if (atRule) {
                if (atRule !== 'media') return
                variants[cssFormatter.tokenToCssName(token)] = value
              } else {
                variants[cssFormatter.tokenToCssName(token)] = `${value} &`
              }

              return
            }

            if (category === 'variant') {
              const value = cssFormatter.aliasesToCssValue(token.$value)
              variants[cssFormatter.tokenToCssName(token)] = `&${value}`
              return
            }

            const themeKey = getCategorySpec(category!)?.tailwind
            if (!themeKey) return

            const themePath = cssNameFromKey(
              generateTokenNameKeys(token.$extensions.keys).slice(1)
            )

            if (
              token.$extensions.keys.includes('$set') ||
              token.$extensions.conditionTokens.length ||
              token.$extensions.variantTokens.length
            ) {
              deepSetObj(
                theme,
                [themeKey, themePath],
                `var(${cssFormatter.tokenToCssCustomPropertyName(token)})`
              )
            } else {
              deepSetObj(
                theme,
                [themeKey, themePath],
                cssFormatter.convertToCssValue(
                  { type: token.$type, value: token.$value },
                  { keepAliases }
                )
              )
            }
          })

          const code = js({ prefix, theme, variants })

          addOutputFile({
            filePath: path,
            content: format === 'esm' ? esm({ code }) : cjs({ code }),
          })
        }
      )
    },
  }
}

function js({ prefix = '', theme = {}, variants = {} } = {}) {
  return `{
  prefix: '${prefix}',
  theme: ${JSON.stringify(theme)},
  plugins: [
    plugin(
      ({ _addBase, _addComponents, addVariant, _theme, _options }) => {
        ;${JSON.stringify(Object.entries(variants))}.forEach(variant => {
          addVariant(...variant)
        })
      }
    ),
  ],
}
`
}

function esm({ code = '{}' } = {}) {
  return `import plugin from 'tailwindcss/plugin'

export const preset = ${code}
`
}
function cjs({ code = '{}' } = {}) {
  return `const plugin = require('tailwindcss/plugin')

exports.preset = ${code}
`
}
