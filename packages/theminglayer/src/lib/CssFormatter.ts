import { clsx } from 'clsx/lite'
import { klona } from 'klona/json'
import groupBy from 'lodash.groupby'

import type { Collection } from '~/lib/Collection'
import { cssNameFromKeys, isSimpleIsSelector } from '~/lib/cssUtils'
import { FontWeightMap, type TokenType } from '~/lib/spec'
import {
  generateTokenNameKeys,
  getReferences,
  isAlias,
  isMathExpression,
  isToken,
  isTokenSet,
} from '~/lib/token'
import type { Token, TokenSet } from '~/types'
import {
  getObjValue,
  isNullish,
  isPrimitive,
  toKebabCase,
  toSnakeCase,
  traverseObj,
} from '~/utils/misc'

const SystemColors = new Set([
  'Canvas',
  'CanvasText',
  'LinkText',
  'VisitedText',
  'ActiveText',
  'ButtonFace',
  'ButtonText',
  'ButtonBorder',
  'Field',
  'FieldText',
  'Highlight',
  'HighlightText',
  'SelectedItem',
  'SelectedItemText',
  'Mark',
  'MarkText',
  'GrayText',
  'AccentColor',
  'AccentColorText',
])

const TypographyKeys = [
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
]

export class CssFormatter {
  constructor(
    public collection: Collection,
    public options: { prefix: string; containerSelector: string }
  ) {}

  tokenToCssRules(token: Token, { keepAliases = false } = {}) {
    const {
      $type: type,
      $extensions: { component },
    } = token

    if (type === 'condition') {
      const resolvedValue = this.aliasToCssValue(token.$value)
      const atRule = resolvedValue.match(/@(\S*)/)?.[1]

      if (atRule) {
        // TODO container, supports when spec allows
        if (atRule !== 'media') return []

        return [
          {
            rule: {
              atRules: [
                {
                  name: `custom-${atRule}`,
                  params: `${this.tokenToCustomPropertyName(
                    token
                  )} ${resolvedValue.replace(`@${atRule}`, '').trim()}`,
                },
              ],
            },
          },
        ]
      } else {
        let resolvedValue = this.aliasToCssValue(token.$value).trim()

        if (isSimpleIsSelector(resolvedValue)) {
          resolvedValue = resolvedValue.slice(4, -1)
        }

        return [
          {
            rule: {
              atRules: [
                {
                  name: 'custom-selector',
                  params: `:${this.tokenToCustomPropertyName(
                    token
                  )} ${resolvedValue}`,
                },
              ],
            },
          },
        ]
      }
    }

    if (type === 'variant') {
      let resolvedValue = this.aliasToCssValue(token.$value).trim()

      if (isSimpleIsSelector(resolvedValue)) {
        resolvedValue = resolvedValue.slice(4, -1)
      }

      return [
        {
          rule: {
            atRules: [
              {
                name: 'custom-selector',
                params: `:${this.tokenToCustomPropertyName(
                  token
                )} ${resolvedValue}`,
              },
            ],
          },
        },
      ]
    }

    const atRules = []

    const { selector: conditionSelector, atRules: conditionAtRules } =
      this.#parseConditions(token)

    let selector = `${this.options.containerSelector.trim()}${conditionSelector}`

    atRules.push(...conditionAtRules)

    if (component) {
      const {
        variantSelector,
        parentVariantSelector,
        atRules: variantAtRules,
      } = this.#parseVariants(token)

      selector = clsx(
        conditionSelector && selector,
        parentVariantSelector,
        variantSelector
      )

      atRules.push(...variantAtRules)
    }

    const declarations = [
      {
        prop: this.tokenToCustomPropertyName(token),
        value: this.convertToCssValue(
          {
            type: token.$type,
            value: token.$value,
          },
          { keepAliases }
        ),
      },
    ]

    const rules = [{ component, rule: { atRules, selector, declarations } }]

    if (!component && token.$backdrop) {
      rules.push({
        component,
        rule: {
          atRules,
          selector: clsx(selector, '::backdrop'),
          declarations,
        },
      })
    }

    return rules
  }

  convertToCssTypographyValues(
    { value }: { value: unknown },
    { keepAliases = false } = {}
  ) {
    const properties: Array<{ type: TokenType; prop: string; value: any }> = [
      {
        type: 'font_family',
        prop: 'font-family',
        value: value.family || value.font_family || value.fontFamily,
      },
      {
        type: 'dimension',
        prop: 'font-size',
        value: value.size || value.font_size || value.fontSize,
      },
      {
        type: 'font_style',
        prop: 'font-style',
        value: value.style || value.font_style || value.fontStyle,
      },
      // {
      //   type: 'font_stretch',
      //   prop: 'font-stretch',
      //   value:
      //     value.stretch ||
      //     value.font_stretch ||
      //     value.fontStretch,
      // },
      // {
      //   type: 'font_variant',
      //   prop: 'font-variant',
      //   value:
      //     value.variant ||
      //     value.font_variant ||
      //     value.fontVariant,
      // },
      {
        type: 'font_weight',
        prop: 'font-weight',
        value: value.weight || value.font_weight || value.fontWeight,
      },
      {
        type: 'tracking',
        prop: 'letter-spacing',
        value: value.tracking || value.letter_spacing || value.letterSpacing,
      },
      {
        type: 'leading',
        prop: 'line-height',
        value: value.leading || value.line_height || value.lineHeight,
      },
    ]

    const result = []

    properties.forEach(({ type, prop, value }) => {
      if (isNullish(value)) return
      result.push({
        prop,
        value: this.convertToCssValue({ type, value }, { keepAliases }),
      })
    })

    return result
  }

  aliasTokenToCssTypographyValue(tokenOrSet) {
    const customPropertyName = this.tokenToCustomPropertyName(tokenOrSet)

    return [
      {
        prop: 'font-family',
        value: `var(${customPropertyName}-font-family)`,
      },
      {
        prop: 'font-size',
        value: `var(${customPropertyName}-font-size)`,
      },
      {
        prop: 'font-style',
        value: `var(${customPropertyName}-font-style)`,
      },
      {
        prop: 'font-weight',
        value: `var(${customPropertyName}-font-weight)`,
      },
      {
        prop: 'letter-spacing',
        value: `var(${customPropertyName}-letter-spacing)`,
      },
      {
        prop: 'line-height',
        value: `var(${customPropertyName}-line-height)`,
      },
    ]
  }

  typographyTokenToCssRules(token: Token, { keepAliases = false } = {}) {
    const { tokenObject } = this.collection
    const { prefix } = this.options

    let typographyValue = []

    if (keepAliases && isAlias(token.$value)) {
      typographyValue = this.aliasTokenToCssTypographyValue(token)
    } else {
      let resolvedTokenOrSet = token

      while (isAlias(resolvedTokenOrSet.$value)) {
        const ref = getReferences(resolvedTokenOrSet.$value)[0]
        resolvedTokenOrSet = getObjValue(tokenObject, ref.split('.'))
      }

      // TODO here
      if (isToken(resolvedTokenOrSet)) {
        if (token === resolvedTokenOrSet) {
          typographyValue = this.convertToCssTypographyValues(
            { value: resolvedTokenOrSet.$value },
            { keepAliases }
          )
        } else {
          if (
            '$condition' in resolvedTokenOrSet ||
            '$variant' in resolvedTokenOrSet
          ) {
            typographyValue =
              this.aliasTokenToCssTypographyValue(resolvedTokenOrSet)
          } else {
            typographyValue = this.convertToCssTypographyValues(
              { value: resolvedTokenOrSet.$value },
              { keepAliases }
            )
          }
        }
      } else if (isTokenSet(resolvedTokenOrSet)) {
        typographyValue =
          this.aliasTokenToCssTypographyValue(resolvedTokenOrSet)
      } else if (typeof resolvedTokenOrSet === 'undefined') {
        // TODO warn
        return []
      } else {
        // TODO warn
        return []
      }
    }

    const { keys, component } = token.$extensions

    const declarations = []

    const nameKeys = generateTokenNameKeys(keys)
    if (keys[0] === 'component' || keys[0] === 'group') nameKeys.splice(0, 1)

    typographyValue.forEach(({ prop, value }) => {
      declarations.push({
        prop: `--${prefix}${cssNameFromKeys([...nameKeys, prop])}`,
        value,
      })
    })

    const atRules = []

    const { selector: conditionSelector, atRules: conditionAtRules } =
      this.#parseConditions(token)

    let selector = `${this.options.containerSelector.trim()}${conditionSelector}`

    atRules.push(...conditionAtRules)

    if (component) {
      const {
        variantSelector,
        parentVariantSelector,
        atRules: variantAtRules,
      } = this.#parseVariants(token)

      selector = clsx(
        conditionSelector && selector,
        parentVariantSelector,
        variantSelector
      )

      atRules.push(...variantAtRules)
    }

    return [
      {
        component,
        rule: {
          declarations,
          selector,
          atRules,
        },
      },
    ]
  }

  transform(
    { type, value }: { type: TokenType; value: unknown },
    { keepAliases = false } = {}
  ) {
    switch (toSnakeCase(type) as TokenType) {
      case 'color': {
        return value
      }
      case 'cubic_bezier': {
        if (typeof value === 'string') return value
        return `cubic-bezier(${value.join(', ')})`
      }
      case 'dimension': {
        return String(value)
      }
      case 'duration': {
        return String(value)
      }
      case 'font_family': {
        if (typeof value === 'string') return value
        return value.join(', ')
      }
      case 'font_style': {
        return value
      }
      case 'font_weight': {
        const normalizedValue = value.toLowerCase().replace(/[\s-_]/g, '')

        if (FontWeightMap[normalizedValue]) {
          return FontWeightMap[normalizedValue]
        }

        return value
      }
      case 'number': {
        return String(value)
      }

      case 'border': {
        // TODO warn missing border style
        if (typeof value === 'string') return value

        const border = []

        const parts: Array<{ type: TokenType; value: any }> = [
          { type: 'dimension', value: value.width || 'medium' },
          { type: 'stroke_style', value: value.style || 'none' },
          { type: 'color', value: value.color || 'currentcolor' },
        ]

        parts.forEach((part) => {
          !isNullish(part.value) &&
            border.push(this.convertToCssValue(part, { keepAliases }))
        })

        return border.join(' ')
      }
      case 'gradient': {
        if (typeof value === 'string') return value
        return value
      }
      case 'shadow': {
        if (typeof value === 'string') return value

        if (Array.isArray(value)) {
          return value
            .map((shadow) => {
              return this.convertToCssValue(
                { type: 'shadow', value: shadow },
                { keepAliases }
              )
            })
            .join(', ')
        }

        const shadow = value.inset ? ['inset'] : []

        const parts: Array<{ type: TokenType; value: any }> = [
          {
            type: 'dimension',
            value: value.offset_x || value.offsetX || value.x || 0,
          },
          {
            type: 'dimension',
            value: value.offset_y || value.offsetY || value.y || 0,
          },
          { type: 'dimension', value: value.blur || 0 },
          { type: 'dimension', value: value.spread || 0 },
          { type: 'color', value: value.color || '#000000' },
        ]

        parts.forEach((part) => {
          shadow.push(this.convertToCssValue(part, { keepAliases }))
        })

        return shadow.join(' ')
      }
      case 'stroke_style': {
        if (typeof value === 'string') return value
        return 'dashed'
      }
      case 'transition': {
        if (typeof value === 'string') return value

        if (Array.isArray(value)) {
          return value
            .map((transition) => {
              return this.convertToCssValue(
                { type: 'transition', value: transition },
                { keepAliases }
              )
            })
            .join(', ')
        }

        let transitionProperties = value.transition_property ||
          value.transitionProperty || ['all']

        if (typeof transitionProperties === 'string') {
          transitionProperties = transitionProperties.split(/,\s*/)
        }

        const transitions: Array<string> = []

        transitionProperties.forEach((transitionProperty) => {
          const transition = []

          const parts: Array<{ type: TokenType; value: any }> = [
            { type: 'transition_property', value: transitionProperty },
            {
              type: 'duration',
              value: value.duration || 0,
            },
            {
              type: 'cubic_bezier',
              value:
                value.timing_function ||
                value.timingFunction ||
                value.cubic_bezier ||
                value.cubicBezier ||
                value.easing ||
                'ease',
            },
            { type: 'duration', value: value.delay || 0 },
          ]

          parts.forEach((part) => {
            transition.push(this.convertToCssValue(part, { keepAliases }))
          })

          transitions.push(transition.join(' '))
        })

        return transitions.join(', ')
      }

      case 'font_variant': {
        return value
      }
      case 'leading': {
        return value
      }
      case 'tracking': {
        if (typeof value === 'number') {
          return `${value}em`
        }
        if (value.endsWith('%')) {
          return `${Number(value.slice(0, -1)) / 100}em`
        }

        return value
      }
      case 'transition_property': {
        if (typeof value === 'string') return value
        return value.join(', ')
      }

      case 'outline': {
        // TODO warn missing outline style
        if (typeof value === 'string') return value

        const outline = []

        const parts: Array<{ type: TokenType; value: any }> = [
          { type: 'dimension', value: value.width || 'medium' },
          { type: 'stroke_style', value: value.style || 'none' },
          { type: 'color', value: value.color || 'currentcolor' },
        ]

        parts.forEach((part) => {
          !isNullish(part.value) &&
            outline.push(this.convertToCssValue(part, { keepAliases }))
        })

        return outline.join(' ')
      }
      case 'drop_shadow': {
        if (typeof value === 'string') return value

        if (Array.isArray(value)) {
          return value
            .map((shadow) => {
              return this.convertToCssValue(
                { type: 'drop_shadow', value: shadow },
                { keepAliases }
              )
            })
            .join(' ')
        }

        const shadow = []

        const parts: Array<{ type: TokenType; value: any }> = [
          {
            type: 'dimension',
            value: value.offset_x || value.offsetX || value.x || 0,
          },
          {
            type: 'dimension',
            value: value.offset_y || value.offsetY || value.y || 0,
          },
          { type: 'dimension', value: value.blur || 0 },
          { type: 'color', value: value.color || '#000000' },
        ]

        parts.forEach((part) => {
          shadow.push(this.convertToCssValue(part, { keepAliases }))
        })

        return `drop-shadow(${shadow.join(' ')})`
      }
      // case 'keyframes': {
      //   return value
      // }

      default: {
        return value
      }
    }
  }

  convertToCssValue(
    { type, value }: { type: TokenType; value: unknown },
    { keepAliases = false } = {}
  ): string {
    if (keepAliases && isAlias(value)) {
      const cssValue = this.#aliasToCustomProperty(value)
      return isMathExpression(value) ? `calc(${cssValue})` : cssValue
    }

    const resolvedValue = this.aliasToCssValue(value, {
      keepAliases,
    })

    if (isNullish(resolvedValue) || !type) {
      throw new Error('This should not happen. Please fix code.')
    }

    const cssValue = this.transform(
      { type, value: resolvedValue },
      { keepAliases }
    )

    if (typeof cssValue !== 'string') {
      throw new Error()
    }

    return isMathExpression(value) ? `calc(${cssValue})` : cssValue
  }

  // TODO return value type is string or any valid token schema
  aliasToCssValue(value: unknown, { keepAliases = false } = {}): unknown {
    const clone = klona({ value })

    traverseObj(clone, (obj, key) => {
      while (isAlias(obj[key])) {
        const refs = getReferences(obj[key])

        refs.forEach((ref) => {
          const referenced = getObjValue(
            this.collection.tokenObject,
            ref.split('.')
          )
          const refString = `{${ref}}`

          if (isToken(referenced)) {
            if ('$condition' in referenced || '$variant' in referenced) {
              obj[key] = obj[key].replace(
                refString,
                `var(${this.tokenToCustomPropertyName(referenced)})`
              )
            } else {
              obj[key] = obj[key].replace(
                refString,
                this.convertToCssValue(
                  { type: referenced.$type, value: referenced.$value },
                  { keepAliases }
                )
              )
            }
          } else if (isTokenSet(referenced)) {
            obj[key] = obj[key].replace(
              refString,
              `var(${this.tokenToCustomPropertyName(referenced)})`
            )
          } else if (typeof referenced === 'undefined') {
            const customProperty = `var(--${cssNameFromKeys(ref.split('.'))})`
            obj[key] = obj[key].replace(refString, customProperty)
          } else if (isPrimitive(referenced)) {
            obj[key] = obj[key].replace(
              refString,
              this.aliasToCssValue(referenced, { keepAliases: false })
            )
          } else {
            // * refs are object or array
            if (refs.length !== 1) {
              // TODO warn
            }
            obj[key] = referenced
          }
        })
      }
    })

    return clone.value as string
  }

  tokenToCustomPropertyName(tokenOrSet: Token | TokenSet): string {
    const name = this.tokenToCssName(tokenOrSet)

    return `--${this.options.prefix}${name}`
  }

  tokenToComponentClassSelector({ $extensions: { component } }: Token): string {
    return component
      ? `.${this.options.prefix}${toKebabCase(component)}`.trim()
      : ''
  }

  typographyTokenToClassSelector(token: Token) {
    const name = this.tokenToCssName(token)

    return `.${this.options.prefix}${name}`
  }

  tokenToCssName(tokenOrSet: Token | TokenSet): string {
    const { keys } = tokenOrSet.$extensions || tokenOrSet.$set[0].$extensions

    const nameKeys = generateTokenNameKeys(keys)

    if (keys[0] === 'component' || keys[0] === 'group') {
      // remove 'component' from keys
      nameKeys.splice(0, 1)

      if (nameKeys[1] === '$variant') {
        // remove 'true' from keys
        nameKeys.at(-1) === 'true' && nameKeys.splice(-1, 1)
      }
    }

    return cssNameFromKeys(nameKeys)
  }

  #parseConditions(token: Token): {
    selector: string
    atRules: Array<{ name: string; params: string }>
  } {
    const {
      selector = [],
      media = [],
      container = [],
      supports = [],
    } = groupBy(token.$extensions.conditionTokens, (conditionToken) => {
      const atRule = conditionToken.$value!.match(/@(\S*)/)?.[1]
      return atRule || 'selector'
    })

    const atRules = []

    if (media.length) {
      const params = media
        .map((token) => {
          // TODO alternatively, output the custom property name
          // return `(${this.tokenToCustomPropertyName(token)})`
          return this.aliasToCssValue(token.$value).replace('@media', '').trim()
        })
        .sort()
        .join(' and ')

      atRules.push({ name: 'media', params })
    }

    if (supports.length) {
      const params = supports
        .map((token) => {
          return this.aliasToCssValue(token.$value)
            .replace('@supports', '')
            .trim()
        })
        .sort()
        .join(' and ')

      atRules.push({ name: 'supports', params })
    }

    // TODO container

    return {
      selector: selector
        // TODO alternatively, output the custom property name
        .map((token) => {
          // return `:${this.tokenToCustomPropertyName(token)}`
          return this.aliasToCssValue(token.$value).trim()
        })
        .sort()
        .join(''),
      atRules,
    }
  }

  #parseVariants(token: Token): {
    variantSelector: string
    parentVariantSelector: string
    atRules: Array<{ name: string; params: string }>
  } {
    // TODO validate only 1 parent component is allowed e.g. tabs.visual and tabs.color, not tabs.visual and tab_list.orientation

    const { selector = [], container = [] } = groupBy(
      token.$extensions.variantTokens,
      (variantToken) => {
        const atRule = /@container/.test(variantToken.$value!)

        return atRule ? 'container' : 'selector'
      }
    )

    const atRules = []

    if (container.length) {
      container
        .map((token) => {
          return this.aliasToCssValue(token.$value)
            .replace('@container', '')
            .trim()
        })
        .sort()
        .forEach((params) => {
          atRules.push({ name: 'container', params })
        })
    }

    const { self = [], parent = [] } = groupBy(selector, (variantToken) =>
      token.$extensions.component === variantToken.$extensions.component
        ? 'self'
        : 'parent'
    )

    return {
      variantSelector:
        this.tokenToComponentClassSelector(token) +
        self
          .map((token) => {
            // TODO alternatively, output the custom property name
            // return `:${this.tokenToCustomPropertyName(token)}`
            return this.aliasToCssValue(token.$value).trim()
          })
          .sort()
          .join(''),
      parentVariantSelector: parent.length
        ? this.tokenToComponentClassSelector(parent[0]) +
          parent
            .map((token) => {
              // TODO alternatively, output the custom property name
              // return `:${this.tokenToCustomPropertyName(token)}`
              return this.aliasToCssValue(token.$value).trim()
            })
            .sort()
            .join('')
        : '',
      atRules,
    }
  }

  #aliasToCustomProperty(value) {
    const refs = getReferences(value)

    refs.forEach((ref) => {
      const obj = getObjValue(this.collection.tokenObject, ref.split('.'))

      if (isToken(obj) || isTokenSet(obj)) {
        const customProperty = `var(${this.tokenToCustomPropertyName(obj)})`
        value = value.replace(`{${ref}}`, customProperty)
      } else {
        const customProperty = `var(--${cssNameFromKeys(ref.split('.'))})`
        value = value.replace(`{${ref}}`, customProperty)
      }
    })

    return value
  }
}
