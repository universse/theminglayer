import { packageName } from '~/lib/constants'
import { CssFormatter } from '~/lib/CssFormatter'
import { cssNameFromKeys } from '~/lib/cssUtils'
import type { TokenCategory } from '~/lib/spec'
import { generateTokenNameKeys } from '~/lib/token'
import { cssOptions } from '~/plugins/cssOptions'
import type { PluginCreator, Token } from '~/types'
import { deepSetObj } from '~/utils/misc'
import * as promises from '~/utils/promises'

export const tailwindPresetPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  files?: Array<{
    path: string
    filter: (token: Token) => boolean
    format?: 'esm' | 'cjs'
    keepAliases?: boolean
  }>
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
    name: `${packageName}/tailwind-preset`,
    async build({ collection, addOutputFile, logger }) {
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
              $value,
              $type,
              $category,
              $extensions: { keys, conditionTokens, variantTokens },
            } = token

            if (keys[0] === 'group' || keys[0] === 'component') return
            if ($type === 'typography' || $type === 'text') return

            if ($type === 'condition') {
              const value = cssFormatter.aliasToCssValue($value)
              // @ts-expect-error todo
              const atRule = value.match(/@(\S*)/)?.[1]

              if (atRule) {
                if (atRule !== 'media') return
                // @ts-expect-error todo
                variants[cssFormatter.tokenToCssName(token)] = value
              } else {
                variants[cssFormatter.tokenToCssName(token)] = `${value} &`
              }

              return
            }

            if ($type === 'variant') {
              const value = cssFormatter.aliasToCssValue($value)
              variants[cssFormatter.tokenToCssName(token)] = `&${value}`
              return
            }

            const { themeKeys, extend } =
              ThemeConfigByCategory[$category! as TokenCategory] || {}

            if (!themeKeys) return

            const themePath = cssNameFromKeys(
              generateTokenNameKeys(keys).slice(1)
            )

            const isThemed =
              keys.includes('$set') ||
              conditionTokens.length ||
              variantTokens.length

            themeKeys.forEach((themeKey) => {
              const keyParts = [themeKey, themePath]
              extend && keyParts.unshift('extend')

              if (isThemed) {
                deepSetObj(
                  theme,
                  keyParts,
                  `var(${cssFormatter.tokenToCustomPropertyName(token)})`
                )
              } else {
                try {
                  deepSetObj(
                    theme,
                    keyParts,
                    cssFormatter.convertToCssValue(
                      { type: $type, value: $value },
                      { keepAliases }
                    )
                  )
                } catch {
                  logger.warnings.invalidCssValue(keys)
                }
              }
            })
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

type TailwindThemeKey =
  | 'screens'
  | 'colors'
  | 'backgroundColor'
  | 'textColor'
  | 'fill'
  | 'stroke'
  | 'boxShadowColor'
  | 'opacity'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'spacing'
  | 'flexBasis'
  | 'height'
  | 'maxHeight'
  | 'maxWidth'
  | 'minHeight'
  | 'minWidth'
  | 'size'
  | 'width'
  | 'borderColor'
  | 'borderWidth'
  | 'borderRadius'
  | 'outlineColor'
  | 'outlineWidth'
  | 'outlineOffset'
  | 'boxShadow'
  | 'blur'
  | 'backdropBlur'
  | 'transitionProperty'
  | 'transitionDuration'
  | 'transitionTimingFunction'
  | 'transitionDelay'
  | 'keyframes'
  | 'animation'
  | 'zIndex'

const ThemeConfigByCategory: Partial<
  Record<
    TokenCategory,
    { extend?: boolean; themeKeys?: Array<TailwindThemeKey> }
  >
> = {
  screen: {
    themeKeys: ['screens'],
  },
  get breakpoint() {
    return this.screen!
  },

  color: {
    themeKeys: ['colors'],
  },
  background_color: {
    themeKeys: ['backgroundColor'],
  },
  text_color: {
    themeKeys: ['textColor'],
  },
  icon_color: {
    themeKeys: ['fill', 'stroke'],
  },
  box_shadow_color: {
    themeKeys: ['boxShadowColor'],
  },
  opacity: {
    themeKeys: ['opacity'],
  },

  font_family: {
    themeKeys: ['fontFamily'],
  },
  font_size: {
    themeKeys: ['fontSize'],
  },
  font_weight: {
    themeKeys: ['fontWeight'],
  },
  leading: {
    themeKeys: ['lineHeight'],
  },
  get line_height() {
    return this.leading!
  },
  tracking: {
    themeKeys: ['letterSpacing'],
  },
  get letter_spacing() {
    return this.tracking!
  },

  space: {
    themeKeys: ['spacing'],
  },
  get spacing() {
    return this.space!
  },

  size: {
    extend: true,
    themeKeys: [
      'flexBasis',
      'height',
      'maxHeight',
      'maxWidth',
      'minHeight',
      'minWidth',
      'size',
      'width',
    ],
  },

  border_color: {
    themeKeys: ['borderColor'],
  },
  border_width: {
    themeKeys: ['borderWidth'],
  },
  border_radius: {
    themeKeys: ['borderRadius'],
  },
  outline_color: {
    themeKeys: ['outlineColor'],
  },
  outline_width: {
    themeKeys: ['outlineWidth'],
  },
  outline_offset: {
    themeKeys: ['outlineOffset'],
  },

  box_shadow: {
    themeKeys: ['boxShadow'],
  },
  blur: {
    themeKeys: ['blur'],
  },
  backdrop_blur: {
    themeKeys: ['backdropBlur'],
  },

  transition_property: {
    themeKeys: ['transitionProperty'],
  },
  duration: {
    themeKeys: ['transitionDuration'],
  },
  timing_function: {
    themeKeys: ['transitionTimingFunction'],
  },
  get cubic_bezier() {
    return this.timing_function!
  },
  get easing() {
    return this.timing_function!
  },
  delay: {
    themeKeys: ['transitionDelay'],
  },
  keyframes: {
    themeKeys: ['keyframes'],
  },
  animation: {
    themeKeys: ['animation'],
  },

  layer: {
    themeKeys: ['zIndex'],
  },
  get z_index() {
    return this.layer!
  },
} as const
