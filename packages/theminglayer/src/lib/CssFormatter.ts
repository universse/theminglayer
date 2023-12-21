import { klona } from 'klona/json'
import groupBy from 'lodash.groupby'

import { type Collection } from '~/lib/Collection'
import { cssNameFromKey } from '~/lib/cssUtils'
import { MessageHeaders, warningMessages } from '~/lib/Messages'
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
  `Canvas`,
  `CanvasText`,
  `LinkText`,
  `VisitedText`,
  `ActiveText`,
  `ButtonFace`,
  `ButtonText`,
  `ButtonBorder`,
  `Field`,
  `FieldText`,
  `Highlight`,
  `HighlightText`,
  `SelectedItem`,
  `SelectedItemText`,
  `Mark`,
  `MarkText`,
  `GrayText`,
  `AccentColor`,
  `AccentColorText`,
])

const ROOT_SELECTOR = `:where(:root)`

export class CssFormatter {
  constructor(
    public collection: Collection,
    public options: { prefix: string }
  ) {}

  tokenToCssRules(token: Token, { outputVariable = false } = {}) {
    const {
      $category: category,
      $extensions: { component },
    } = token

    if (category === `condition`) {
      const resolvedValue = this.resolveReferencesToCss(token.$value)
      const atRule = resolvedValue.match(/@(\S*)/)?.[1]

      if (atRule) {
        // TODO container, supports
        if (atRule !== `media`) return []

        return [
          {
            rule: {
              atRules: [
                {
                  name: `custom-${atRule}`,
                  params: `${this.tokenToCssVariableName(token)} ${resolvedValue
                    .replace(`@${atRule}`, ``)
                    .trim()}`,
                },
              ],
            },
          },
        ]
      } else {
        let resolvedValue = this.resolveReferencesToCss(token.$value).trim()

        if (resolvedValue.startsWith(`:is(`) && resolvedValue.endsWith(`)`)) {
          resolvedValue = resolvedValue.slice(4, -1)
        }

        return [
          {
            rule: {
              atRules: [
                {
                  name: `custom-selector`,
                  params: `:${this.tokenToCssVariableName(
                    token
                  )} ${resolvedValue}`,
                },
              ],
            },
          },
        ]
      }
    }

    if (category === `variant`) {
      let resolvedValue = this.resolveReferencesToCss(token.$value).trim()

      if (resolvedValue.startsWith(`:is(`) && resolvedValue.endsWith(`)`)) {
        resolvedValue = resolvedValue.slice(4, -1)
      }

      return [
        {
          rule: {
            atRules: [
              {
                name: `custom-selector`,
                params: `:${this.tokenToCssVariableName(
                  token
                )} ${resolvedValue}`,
              },
            ],
          },
        },
      ]
    }

    if (category === `typography`) {
      return this.typographyTokenToCssRules(
        { token, originalToken: token },
        { outputVariable }
      )
    }

    const { selector: conditionSelector = ``, atRules } =
      this.#parseConditions(token)

    const { selector: variantSelector = `` } = this.#parseVariants(token)

    const componentSelector = component
      ? `.${this.options.prefix}${component}`.trim()
      : ``

    let selector: string

    if (componentSelector) {
      const parentSelector = conditionSelector
        ? `${ROOT_SELECTOR}${conditionSelector}`
        : ``

      selector =
        `${parentSelector} ${componentSelector}${variantSelector}`.trim()
    } else {
      selector = `${ROOT_SELECTOR}${conditionSelector}`
    }

    const declarations = [
      {
        prop: this.tokenToCssVariableName(token),
        value: this.convertToCssValue(
          {
            type: token.$type,
            value: token.$value,
          },
          { outputVariable }
        ),
      },
    ]

    const rules = [{ component, rule: { atRules, selector, declarations } }]

    if (!component && token.$backdrop) {
      rules.push({
        component,
        rule: {
          atRules,
          selector:
            selector === ROOT_SELECTOR
              ? `:where(::backdrop)`
              : selector + ` :where(::backdrop)`,
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
    { outputVariable = false } = {}
  ) {
    const { tokenObject } = this.collection
    const { prefix } = this.options

    let resolvedValue = token.$value

    while (isAlias(resolvedValue)) {
      const ref = getReferences(resolvedValue)[0]
      resolvedValue = getObjValue(tokenObject, ref.split(`.`)).$value
    }

    if (isTokenSet(resolvedValue)) {
      resolvedValue.$set.forEach((tokenInSet) => {
        this.typographyTokenToCssRules(
          {
            token: tokenInSet,
            originalToken,
            rules,
          },
          { outputVariable }
        )
      })
      return rules
    }

    const { component } = originalToken.$extensions

    const { selector: conditionSelector = ``, atRules } =
      this.#parseConditions(token)

    const { selector: variantSelector = `` } = this.#parseVariants(token)

    const componentSelector = component ? `.${prefix}${component}`.trim() : ``

    const selector = componentSelector
      ? `${conditionSelector} ${componentSelector}${variantSelector}`.trim()
      : `${conditionSelector} ${this.tokenToClassSelector(
          originalToken
        )}`.trim()

    const properties: { type: TokenType; prop: string; value: any }[] = [
      {
        type: `font_family`,
        prop: `font-family`,
        value:
          resolvedValue.family ||
          resolvedValue.font_family ||
          resolvedValue.fontFamily,
      },
      {
        type: `dimension`,
        prop: `font-size`,
        value:
          resolvedValue.size ||
          resolvedValue.font_size ||
          resolvedValue.fontSize,
      },
      {
        type: `font_style`,
        prop: `font-style`,
        value:
          resolvedValue.style ||
          resolvedValue.font_style ||
          resolvedValue.fontStyle,
      },
      {
        type: `font_variant`,
        prop: `font-variant`,
        value:
          resolvedValue.variant ||
          resolvedValue.font_variant ||
          resolvedValue.fontVariant,
      },
      {
        type: `font_weight`,
        prop: `font-weight`,
        value:
          resolvedValue.weight ||
          resolvedValue.font_weight ||
          resolvedValue.fontWeight,
      },
      {
        type: `tracking`,
        prop: `letter-spacing`,
        value:
          resolvedValue.tracking ||
          resolvedValue.letter_spacing ||
          resolvedValue.letterSpacing,
      },
      {
        type: `leading`,
        prop: `line-height`,
        value:
          resolvedValue.leading ||
          resolvedValue.line_height ||
          resolvedValue.lineHeight,
      },
    ]

    // TODO extract to function?
    const propPrefix = component ? `--${prefix}` : ``
    const declarations = []

    properties.forEach(({ type, prop, value }) => {
      !isNullish(value) &&
        declarations.push({
          prop: `${propPrefix}${prop}`,
          value: this.convertToCssValue({ type, value }, { outputVariable }),
        })
    })

    rules.push({ component, rule: { declarations, selector, atRules } })

    return rules
  }

  convertToCssValue(
    { type, value }: { type: TokenType; value: unknown },
    { outputVariable = false } = {}
  ): string {
    if (outputVariable && isAlias(value)) {
      return this.#replaceReferencesWithCssVariables(value)
    }

    const resolvedValue = this.resolveReferencesToCss(value, {
      outputVariable,
    })

    // if (!type) return resolvedValue

    try {
      if (isNullish(resolvedValue) || !type) {
        throw new Error(`This should not happen.`)
      }

      switch (toSnakeCase(type) as TokenType) {
        case `color`: {
          return resolvedValue
        }
        case `cubic_bezier`: {
          if (typeof resolvedValue === `string`) return resolvedValue
          return `cubic-bezier(${resolvedValue.join(`, `)})`
        }
        case `dimension`: {
          return String(resolvedValue)
        }
        case `duration`: {
          return String(resolvedValue)
        }
        case `font_family`: {
          if (typeof resolvedValue === `string`) return resolvedValue
          return resolvedValue.join(`, `)
        }
        case `font_style`: {
          return resolvedValue
        }
        case `font_weight`: {
          const value = resolvedValue.toLowerCase().replace(/[\s-_]/g, ``)

          if (FontWeightMap[value]) {
            return FontWeightMap[value]
          }

          return resolvedValue
        }
        case `number`: {
          return String(resolvedValue)
        }

        case `border`: {
          // TODO warn missing border style
          if (typeof resolvedValue === `string`) return resolvedValue

          const border = []

          const parts: { type: TokenType; value: any }[] = [
            { type: `dimension`, value: resolvedValue.width || `medium` },
            { type: `stroke_style`, value: resolvedValue.style || `none` },
            { type: `color`, value: resolvedValue.color || `currentcolor` },
          ]

          parts.forEach((part) => {
            !isNullish(part.value) &&
              border.push(this.convertToCssValue(part, { outputVariable }))
          })

          return border.join(` `)
        }
        // case `gradient`: {
        //   if (typeof resolvedValue === `string`) return resolvedValue
        //   return resolvedValue
        // }
        case `shadow`: {
          if (typeof resolvedValue === `string`) return resolvedValue

          if (Array.isArray(resolvedValue)) {
            return resolvedValue
              .map((shadow) => {
                return this.convertToCssValue(
                  { type: `shadow`, value: shadow },
                  { outputVariable }
                )
              })
              .join(`, `)
          }
          const shadow = resolvedValue.inset ? [`inset`] : []

          const parts: { type: TokenType; value: any }[] = [
            {
              type: `dimension`,
              value:
                resolvedValue.offset_x ||
                resolvedValue.offsetX ||
                resolvedValue.x ||
                0,
            },
            {
              type: `dimension`,
              value:
                resolvedValue.offset_y ||
                resolvedValue.offsetY ||
                resolvedValue.y ||
                0,
            },
            { type: `dimension`, value: resolvedValue.blur || 0 },
            { type: `dimension`, value: resolvedValue.spread || 0 },
            { type: `color`, value: resolvedValue.color || `#000000` },
          ]

          parts.forEach((part) => {
            shadow.push(this.convertToCssValue(part, { outputVariable }))
          })

          return shadow.join(` `)
        }
        case `stroke_style`: {
          if (typeof resolvedValue === `string`) return resolvedValue
          return `dashed`
        }
        case `transition`: {
          if (typeof resolvedValue === `string`) return resolvedValue

          const transition = []

          const parts: { type: TokenType; value: any }[] = [
            {
              type: `transition_property`,
              value:
                resolvedValue.transition_property ||
                resolvedValue.transitionProperty ||
                `all`,
            },
            {
              type: `duration`,
              value: resolvedValue.duration || 0,
            },
            {
              type: `cubic_bezier`,
              value:
                resolvedValue.timing_function ||
                resolvedValue.timingFunction ||
                resolvedValue.cubic_bezier ||
                resolvedValue.cubicBezier ||
                resolvedValue.easing ||
                `ease`,
            },
            { type: `duration`, value: resolvedValue.delay || 0 },
          ]

          parts.forEach((part) => {
            transition.push(this.convertToCssValue(part, { outputVariable }))
          })

          return transition.join(` `)
        }

        case `font_variant`: {
          return resolvedValue
        }
        case `leading`: {
          return resolvedValue
        }
        case `tracking`: {
          if (typeof resolvedValue === `number`) {
            return `${resolvedValue}em`
          }
          if (resolvedValue.endsWith(`%`)) {
            return `${Number(resolvedValue.slice(0, -1)) / 100}em`
          }

          return resolvedValue
        }
        case `transition_property`: {
          return resolvedValue
        }

        case `outline`: {
          // TODO warn missing outline style
          if (typeof resolvedValue === `string`) return resolvedValue

          const outline = []

          const parts: { type: TokenType; value: any }[] = [
            { type: `dimension`, value: resolvedValue.width || `medium` },
            { type: `stroke_style`, value: resolvedValue.style || `none` },
            { type: `color`, value: resolvedValue.color || `currentcolor` },
          ]

          parts.forEach((part) => {
            !isNullish(part.value) &&
              outline.push(this.convertToCssValue(part, { outputVariable }))
          })

          return outline.join(` `)
        }
        case `drop_shadow`: {
          // TODO
          if (typeof resolvedValue === `string`) return resolvedValue

          if (Array.isArray(resolvedValue)) {
            return resolvedValue
              .map((shadow) => {
                return this.convertToCssValue(
                  { type: `drop_shadow`, value: shadow },
                  { outputVariable }
                )
              })
              .join(` `)
          }
          const shadow = []

          const parts: { type: TokenType; value: any }[] = [
            {
              type: `dimension`,
              value:
                resolvedValue.offset_x ||
                resolvedValue.offsetX ||
                resolvedValue.x ||
                0,
            },
            {
              type: `dimension`,
              value:
                resolvedValue.offset_y ||
                resolvedValue.offsetY ||
                resolvedValue.y ||
                0,
            },
            { type: `dimension`, value: resolvedValue.blur || 0 },
            { type: `color`, value: resolvedValue.color || `#000000` },
          ]

          parts.forEach((part) => {
            shadow.push(this.convertToCssValue(part, { outputVariable }))
          })

          return `drop-shadow(${shadow.join(` `)})`
        }
        // case `keyframes`: {
        //   return resolvedValue
        // }

        default: {
          if (
            typeof resolvedValue !== `string` &&
            typeof resolvedValue !== `number`
          ) {
            throw new Error(`This should not happen.`)
          }
          return String(resolvedValue)
        }
      }
    } catch {
      console.log(`error`, type, value)
      // TODO add a generic error message with warningMessages
      return ``
    }
  }

  // TODO return value type is string or any valid token schema
  resolveReferencesToCss(
    value: unknown,
    { outputVariable = false } = {}
  ): unknown {
    const clone = klona({ value })

    traverseObj(clone, (obj, key) => {
      while (isAlias(obj[key])) {
        const refs = getReferences(obj[key])

        refs.forEach((ref) => {
          const referenced = getObjValue(
            this.collection.tokenObject,
            ref.split(`.`)
          )
          const refString = `{${ref}}`

          if (isToken(referenced)) {
            obj[key] = obj[key].replace(
              refString,
              this.convertToCssValue(
                { type: referenced.$type, value: referenced.$value },
                { outputVariable }
              )
            )
          } else if (isTokenSet(referenced)) {
            obj[key] = obj[key].replace(
              refString,
              `var(${this.tokenToCssVariableName(referenced)})`
            )
          } else if (typeof referenced === `undefined`) {
            const cssVariable = `var(--${cssNameFromKey(ref.split(`.`))})`
            obj[key] = obj[key].replace(refString, cssVariable)
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

  tokenToCssVariableName(tokenOrSet: Token | TokenSet): string {
    const name = this.tokenToCssName(tokenOrSet)

    return `--${this.options.prefix}${name}`
  }

  tokenToClassSelector(token: Token) {
    const name = this.tokenToCssName(token)

    return `.${this.options.prefix}${name}`
  }

  tokenToCssName(tokenOrSet: Token | TokenSet): string {
    const { component, keys } =
      tokenOrSet.$extensions || tokenOrSet.$set[0].$extensions

    const nameKeys = generateTokenNameKeys(keys)

    if (nameKeys[0] === `variant` || nameKeys[0] === `condition`) {
      nameKeys.splice(0, 1)
    }

    if (component) {
      // remove 'component' from keys
      nameKeys.splice(0, 1)

      if (nameKeys[1] === `$variant`) {
        // remove '$variant' from keys
        nameKeys.splice(1, 1)
      } else {
        // remove component name from keys
        nameKeys.splice(0, 1)
      }
    }

    return cssNameFromKey(nameKeys)
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
      return atRule || `selector`
    })

    const atRules = []

    if (media.length) {
      const params = media
        .map((token) => {
          // TODO alternatively, output the variable name
          // return `(${this.tokenToCssVariableName(token)})`
          return this.resolveReferencesToCss(token.$value)
            .replace(`@media`, ``)
            .trim()
        })
        .sort()
        .join(` and `)

      atRules.push({ name: `media`, params })
    }

    // TODO container, supports

    return {
      selector: selector
        // TODO alternatively, output the variable name
        .map((token) => {
          // return `:${this.tokenToCssVariableName(token)}`
          return this.resolveReferencesToCss(token.$value).trim()
        })
        .sort()
        .join(``),
      atRules,
    }
  }

  #parseVariants(token: Token): { selector: string } {
    return {
      selector: token.$extensions.variantTokens
        .map((token) => {
          // TODO alternatively, output the variable name
          // return `:${this.tokenToCssVariableName(token)}`
          return this.resolveReferencesToCss(token.$value).trim()
        })
        .sort()
        .join(``),
    }
  }

  #replaceReferencesWithCssVariables(value) {
    const refs = getReferences(value)

    refs.forEach((ref) => {
      const obj = getObjValue(this.collection.tokenObject, ref.split(`.`))

      if (isToken(obj) || isTokenSet(obj)) {
        const cssVariable = `var(${this.tokenToCssVariableName(obj)})`
        value = value.replace(`{${ref}}`, cssVariable)
      } else {
        const cssVariable = `var(--${cssNameFromKey(ref.split(`.`))})`
        value = value.replace(`{${ref}}`, cssVariable)
      }
    })

    return value
  }
}
