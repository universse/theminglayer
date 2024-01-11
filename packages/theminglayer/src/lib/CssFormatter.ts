import { klona } from 'klona/json'
import groupBy from 'lodash.groupby'

import { type Collection } from '~/lib/Collection'
import { cssNameFromKeys } from '~/lib/cssUtils'
import { FontWeightMap, type TokenType } from '~/lib/spec'
import {
  generateTokenNameKeys,
  getReferences,
  isAlias,
  isToken,
  isTokenSet,
} from '~/lib/token'
import { type Token, type TokenSet } from '~/types'
import {
  getObjValue,
  isNullish,
  isPrimitive,
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
      const resolvedValue = this.aliasesToCssValue(token.$value)
      const atRule = resolvedValue.match(/@(\S*)/)?.[1]

      if (atRule) {
        // TODO container, supports
        if (atRule !== 'media') return []

        return [
          {
            rule: {
              atRules: [
                {
                  name: `custom-${atRule}`,
                  params: `${this.tokenToCssCustomPropertyName(
                    token
                  )} ${resolvedValue.replace(`@${atRule}`, '').trim()}`,
                },
              ],
            },
          },
        ]
      } else {
        let resolvedValue = this.aliasesToCssValue(token.$value).trim()

        if (resolvedValue.startsWith(':is(') && resolvedValue.endsWith(')')) {
          resolvedValue = resolvedValue.slice(4, -1)
        }

        return [
          {
            rule: {
              atRules: [
                {
                  name: 'custom-selector',
                  params: `:${this.tokenToCssCustomPropertyName(
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
      let resolvedValue = this.aliasesToCssValue(token.$value).trim()

      if (resolvedValue.startsWith(':is(') && resolvedValue.endsWith(')')) {
        resolvedValue = resolvedValue.slice(4, -1)
      }

      return [
        {
          rule: {
            atRules: [
              {
                name: 'custom-selector',
                params: `:${this.tokenToCssCustomPropertyName(
                  token
                )} ${resolvedValue}`,
              },
            ],
          },
        },
      ]
    }

    if (type === 'typography') {
      return this.typographyTokenToCssRules(
        { token, originalToken: token },
        { keepAliases }
      )
    }

    const { selector: conditionSelector = '', atRules } =
      this.#parseConditions(token)

    const { selector: variantSelector = '' } = this.#parseVariants(token)

    const componentSelector = this.tokenToComponentClassSelector(token)

    let selector: string
    const containerSelector = this.options.containerSelector.trim()

    if (componentSelector) {
      const parentSelector = conditionSelector
        ? `${containerSelector}${conditionSelector}`
        : ''

      selector =
        `${parentSelector} ${componentSelector}${variantSelector}`.trim()
    } else {
      selector = `${containerSelector}${conditionSelector}`
    }

    const declarations = [
      {
        prop: this.tokenToCssCustomPropertyName(token),
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
          selector: `${selector} ::backdrop`,
          declarations,
        },
      })
    }

    return rules
  }

  typographyTokenToCssRules(
    {
      token,
      originalToken,
      rules = [],
    }: {
      token: Token
      originalToken: Token
      rules?: []
    },
    { keepAliases = false } = {}
  ) {
    const { tokenObject } = this.collection
    const { prefix } = this.options

    let resolvedValue = token.$value

    while (isAlias(resolvedValue)) {
      const ref = getReferences(resolvedValue)[0]
      resolvedValue = getObjValue(tokenObject, ref.split('.')).$value
    }

    if (isTokenSet(resolvedValue)) {
      resolvedValue.$set.forEach((tokenInSet) => {
        this.typographyTokenToCssRules(
          {
            token: tokenInSet,
            originalToken,
            rules,
          },
          { keepAliases }
        )
      })
      return rules
    }

    const { component } = originalToken.$extensions

    const { selector: conditionSelector = '', atRules } =
      this.#parseConditions(token)

    const { selector: variantSelector = '' } = this.#parseVariants(token)

    const componentSelector = this.tokenToComponentClassSelector(originalToken)

    const selector = componentSelector
      ? `${conditionSelector} ${componentSelector}${variantSelector}`.trim()
      : `${conditionSelector} ${this.typographyTokenToClassSelector(
          originalToken
        )}`.trim()

    const properties: { type: TokenType; prop: string; value: any }[] = [
      {
        type: 'font_family',
        prop: 'font-family',
        value:
          resolvedValue.family ||
          resolvedValue.font_family ||
          resolvedValue.fontFamily,
      },
      {
        type: 'dimension',
        prop: 'font-size',
        value:
          resolvedValue.size ||
          resolvedValue.font_size ||
          resolvedValue.fontSize,
      },
      {
        type: 'font_style',
        prop: 'font-style',
        value:
          resolvedValue.style ||
          resolvedValue.font_style ||
          resolvedValue.fontStyle,
      },
      {
        type: 'font_variant',
        prop: 'font-variant',
        value:
          resolvedValue.variant ||
          resolvedValue.font_variant ||
          resolvedValue.fontVariant,
      },
      {
        type: 'font_weight',
        prop: 'font-weight',
        value:
          resolvedValue.weight ||
          resolvedValue.font_weight ||
          resolvedValue.fontWeight,
      },
      {
        type: 'tracking',
        prop: 'letter-spacing',
        value:
          resolvedValue.tracking ||
          resolvedValue.letter_spacing ||
          resolvedValue.letterSpacing,
      },
      {
        type: 'leading',
        prop: 'line-height',
        value:
          resolvedValue.leading ||
          resolvedValue.line_height ||
          resolvedValue.lineHeight,
      },
    ]

    // TODO extract to function?
    const propPrefix = component ? `--${prefix}` : ''
    const declarations = []

    properties.forEach(({ type, prop, value }) => {
      !isNullish(value) &&
        declarations.push({
          prop: `${propPrefix}${prop}`,
          value: this.convertToCssValue({ type, value }, { keepAliases }),
        })
    })

    rules.push({ component, rule: { declarations, selector, atRules } })

    return rules
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

        const parts: { type: TokenType; value: any }[] = [
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
        if (typeof value === `string`) return value
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

        const parts: { type: TokenType; value: any }[] = [
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

        const transition = []

        const parts: { type: TokenType; value: any }[] = [
          {
            type: 'transition_property',
            value:
              value.transition_property || value.transitionProperty || 'all',
          },
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

        return transition.join(' ')
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
        return value
      }

      case 'outline': {
        // TODO warn missing outline style
        if (typeof value === 'string') return value

        const outline = []

        const parts: { type: TokenType; value: any }[] = [
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

        const parts: { type: TokenType; value: any }[] = [
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
      // case `keyframes`: {
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
      return this.#aliasesToCustomProperty(value)
    }

    const resolvedValue = this.aliasesToCssValue(value, {
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

    return cssValue
  }

  // TODO return value type is string or any valid token schema
  aliasesToCssValue(value: unknown, { keepAliases = false } = {}): unknown {
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
            obj[key] = obj[key].replace(
              refString,
              this.convertToCssValue(
                { type: referenced.$type, value: referenced.$value },
                { keepAliases }
              )
            )
          } else if (isTokenSet(referenced)) {
            obj[key] = obj[key].replace(
              refString,
              `var(${this.tokenToCssCustomPropertyName(referenced)})`
            )
          } else if (typeof referenced === 'undefined') {
            const cssCustomProperty = `var(--${cssNameFromKeys(
              ref.split('.')
            )})`
            obj[key] = obj[key].replace(refString, cssCustomProperty)
          } else if (isPrimitive(referenced)) {
            obj[key] = obj[key].replace(refString, referenced)
          } else {
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

  tokenToCssCustomPropertyName(tokenOrSet: Token | TokenSet): string {
    const name = this.tokenToCssName(tokenOrSet)

    return `--${this.options.prefix}${name}`
  }

  tokenToComponentClassSelector({ $extensions: { component } }: Token): string {
    return component ? `.${this.options.prefix}${component}`.trim() : ''
  }

  typographyTokenToClassSelector(token: Token) {
    const name = this.tokenToCssName(token)

    return `.${this.options.prefix}${name}`
  }

  tokenToCssName(tokenOrSet: Token | TokenSet): string {
    const { component, keys } =
      tokenOrSet.$extensions || tokenOrSet.$set[0].$extensions

    const nameKeys = generateTokenNameKeys(keys)

    if (component) {
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
    atRules: { name: string; params: string }[]
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
          // return `(${this.tokenToCssCustomPropertyName(token)})`
          return this.aliasesToCssValue(token.$value)
            .replace('@media', '')
            .trim()
        })
        .sort()
        .join(' and ')

      atRules.push({ name: 'media', params })
    }

    // TODO container, supports

    return {
      selector: selector
        // TODO alternatively, output the custom property name
        .map((token) => {
          // return `:${this.tokenToCssCustomPropertyName(token)}`
          return this.aliasesToCssValue(token.$value).trim()
        })
        .sort()
        .join(''),
      atRules,
    }
  }

  #parseVariants(token: Token): { selector: string } {
    return {
      selector: token.$extensions.variantTokens
        .map((token) => {
          // TODO alternatively, output the custom property name
          // return `:${this.tokenToCssCustomPropertyName(token)}`
          return this.aliasesToCssValue(token.$value).trim()
        })
        .sort()
        .join(''),
    }
  }

  #aliasesToCustomProperty(value) {
    const refs = getReferences(value)

    refs.forEach((ref) => {
      const obj = getObjValue(this.collection.tokenObject, ref.split('.'))

      if (isToken(obj) || isTokenSet(obj)) {
        const cssCustomProperty = `var(${this.tokenToCssCustomPropertyName(
          obj
        )})`
        value = value.replace(`{${ref}}`, cssCustomProperty)
      } else {
        const cssCustomProperty = `var(--${cssNameFromKeys(ref.split('.'))})`
        value = value.replace(`{${ref}}`, cssCustomProperty)
      }
    })

    return value
  }
}
