import type { Config } from 'tailwindcss'

// import { z } from 'zod'

type TailwindThemeKey = keyof Required<Config>['theme']

export type TokenCategory =
  | `screen`
  | `breakpoint`
  | `condition`
  | `variant`
  | `color`
  | `background_color`
  | `text_color`
  | `box_shadow_color`
  | `opacity`
  | `font_family`
  | `font_size`
  | `font_weight`
  | `font_style`
  | `font_variant`
  | `leading`
  | `line_height`
  | `tracking`
  | `letter_spacing`
  | `typography`
  | `space`
  | `spacing`
  | `size`
  | `stroke_style`
  | `border_color`
  | `border_width`
  | `border_style`
  | `border_radius`
  | `border`
  | `outline_color`
  | `outline_width`
  | `outline_style`
  | `outline_offset`
  | `outline`
  | `box_shadow`
  | `drop_shadow`
  | `gradient`
  | `transition_property`
  | `duration`
  | `timing_function`
  | `cubic_bezier`
  | `easing`
  | `delay`
  | `transition`
  | `keyframes`
  | 'animation'
  | `layer`
  | `z_index`

export type TokenType =
  // w3c simple
  | 'color'
  | 'cubic_bezier'
  | 'dimension'
  | 'duration'
  | 'font_family'
  | 'font_style'
  | 'font_weight'
  | 'number'
  // w3c composite
  | 'border'
  | 'gradient'
  | 'shadow'
  | 'stroke_style'
  | 'transition'
  | 'typography'
  // tl simple
  | 'condition'
  | 'font_variant'
  | 'leading'
  | 'tracking'
  | 'transition_property'
  | 'variant'
  | 'text'
  // tl composite
  | 'outline'
  | 'drop_shadow'
  | 'keyframes'
  | 'animation'

export const FontWeightMap = {
  thin: `100`,
  hairline: `100`,
  extralight: `200`,
  ultralight: `200`,
  light: `300`,
  normal: `400`,
  regular: `400`,
  book: `400`,
  medium: `500`,
  semibold: `600`,
  demibold: `600`,
  bold: `700`,
  extrabold: `800`,
  ultrabold: `800`,
  black: `900`,
  heavy: `900`,
  extrablack: `950`,
  ultrablack: `950`,
} as const

// export const TokenTypeSchemas = {
//   // w3c simple
//   color: {},
//   cubic_bezier: {},
//   dimension: {},
//   duration: {},
//   font_family: {},
//   font_style: {},
//   font_weight: {},
//   number: {},

//   // w3c composite
//   border: {},
//   gradient: {},
//   shadow: z.object({
//     inset: z.optional(z.boolean()),
//     color: z.string(),
//     offset_x: z.string(),
//     offset_y: z.string(),
//     blur: z.string(),
//     spread: z.string(),
//   }),
//   stroke_style: {},
//   transition: {},
//   typography: {},

//   // tl simple
//   condition: {},
//   font_variant: {},
//   leading: {}, // `dimension` or `number` or `percentage
//   tracking: {}, // `dimension` or `number` or `percentage
//   transition_property: {},
//   variant: {},
//   text: {},

//   // tl composite
//   drop_shadow: {},
//   keyframes: {},
// } as const

export const TokenCategorySpec: Record<
  TokenCategory,
  { type: TokenType; tailwind?: TailwindThemeKey }
> = {
  screen: {
    type: `dimension`,
    tailwind: `screens`,
  },
  get breakpoint() {
    return this.screen
  },
  condition: {
    type: `condition`,
  },
  variant: {
    type: `variant`,
  },

  color: {
    type: `color`,
    tailwind: `colors`,
  },
  background_color: {
    type: `color`,
    tailwind: `backgroundColor`,
  },
  text_color: {
    type: `color`,
    tailwind: `textColor`,
  },
  box_shadow_color: {
    type: `color`,
    tailwind: `boxShadowColor`,
  },
  opacity: {
    type: `number`,
    tailwind: `opacity`,
  },

  font_family: {
    type: `font_family`,
    tailwind: `fontFamily`,
  },
  font_size: {
    type: `dimension`,
    tailwind: `fontSize`,
  },
  font_weight: {
    type: `font_weight`,
    tailwind: `fontWeight`,
  },
  font_style: {
    type: `font_style`,
  },
  font_variant: {
    type: `font_variant`,
  },
  leading: {
    type: `leading`,
    tailwind: `lineHeight`,
  },
  get line_height() {
    return this.leading
  },
  tracking: {
    type: `tracking`,
    tailwind: `letterSpacing`,
  },
  get letter_spacing() {
    return this.tracking
  },
  typography: {
    type: `typography`,
  },

  space: {
    type: `dimension`,
    tailwind: `spacing`,
  },
  get spacing() {
    return this.space
  },

  size: {
    type: `dimension`,
  },

  stroke_style: {
    type: `stroke_style`,
  },
  border_color: {
    type: `color`,
    tailwind: `borderColor`,
  },
  border_width: {
    type: `dimension`,
    tailwind: `borderWidth`,
  },
  get border_style() {
    return this.stroke_style
  },
  border_radius: {
    type: `dimension`,
    tailwind: `borderRadius`,
  },
  border: {
    type: `border`,
  },
  outline_color: {
    type: `color`,
    tailwind: `outlineColor`,
  },
  outline_width: {
    type: `dimension`,
    tailwind: `outlineWidth`,
  },
  get outline_style() {
    return this.stroke_style
  },
  outline_offset: {
    type: `dimension`,
    tailwind: `outlineOffset`,
  },
  outline: {
    type: `outline`,
  },

  box_shadow: {
    type: `shadow`,
    tailwind: `boxShadow`,
  },
  drop_shadow: {
    type: `drop_shadow`,
  },
  gradient: {
    type: `gradient`,
  },

  transition_property: {
    type: `transition_property`,
    tailwind: `transitionProperty`,
  },
  duration: {
    type: `duration`,
    tailwind: `transitionDuration`,
  },
  timing_function: {
    type: `cubic_bezier`,
    tailwind: `transitionTimingFunction`,
  },
  get cubic_bezier() {
    return this.timing_function
  },
  get easing() {
    return this.timing_function
  },
  delay: {
    type: `duration`,
    tailwind: `transitionDelay`,
  },
  transition: {
    type: `transition`,
  },
  keyframes: {
    type: `keyframes`,
    tailwind: `keyframes`,
  },
  animation: {
    type: `animation`,
    tailwind: `animation`,
  },

  layer: {
    type: `number`,
    tailwind: `zIndex`,
  },
  get z_index() {
    return this.layer
  },
} as const
