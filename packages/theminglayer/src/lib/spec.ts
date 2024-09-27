export type TokenCategory =
  | 'screen'
  | 'breakpoint'
  | 'condition'
  | 'variant'
  | 'color'
  | 'background_color'
  | 'text_color'
  | 'icon_color'
  | 'box_shadow_color'
  | 'opacity'
  | 'font_family'
  | 'font_size'
  | 'font_weight'
  | 'font_style'
  | 'font_variant'
  | 'leading'
  | 'line_height'
  | 'tracking'
  | 'letter_spacing'
  | 'typography'
  | 'space'
  | 'spacing'
  | 'size'
  | 'stroke_style'
  | 'border_color'
  | 'border_width'
  | 'border_style'
  | 'border_radius'
  | 'border'
  | 'outline_color'
  | 'outline_width'
  | 'outline_style'
  | 'outline_offset'
  | 'outline'
  | 'box_shadow'
  | 'drop_shadow'
  | 'blur'
  | 'backdrop_blur'
  | 'gradient'
  | 'transition_property'
  | 'duration'
  | 'timing_function'
  | 'cubic_bezier'
  | 'easing'
  | 'delay'
  | 'transition'
  | 'keyframes'
  | 'animation'
  | 'layer'
  | 'z_index'
  | 'runtime'

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
  | 'runtime'
  // tl composite
  | 'outline'
  | 'drop_shadow'
  | 'keyframes'
  | 'animation'

export const FONT_WEIGHT_MAP = {
  thin: '100',
  hairline: '100',
  extralight: '200',
  ultralight: '200',
  light: '300',
  normal: '400',
  regular: '400',
  book: '400',
  medium: '500',
  semibold: '600',
  demibold: '600',
  bold: '700',
  extrabold: '800',
  ultrabold: '800',
  black: '900',
  heavy: '900',
  extrablack: '950',
  ultrablack: '950',
} as const

export const TOKEN_CATEGORY_SPEC: Record<TokenCategory, { type: TokenType }> = {
  screen: {
    type: 'dimension',
  },
  get breakpoint() {
    return this.screen
  },
  condition: {
    type: 'condition',
  },
  variant: {
    type: 'variant',
  },

  color: {
    type: 'color',
  },
  background_color: {
    type: 'color',
  },
  text_color: {
    type: 'color',
  },
  icon_color: {
    type: 'color',
  },
  box_shadow_color: {
    type: 'color',
  },
  opacity: {
    type: 'number',
  },

  font_family: {
    type: 'font_family',
  },
  font_size: {
    type: 'dimension',
  },
  font_weight: {
    type: 'font_weight',
  },
  font_style: {
    type: 'font_style',
  },
  font_variant: {
    type: 'font_variant',
  },
  leading: {
    type: 'leading',
  },
  get line_height() {
    return this.leading
  },
  tracking: {
    type: 'tracking',
  },
  get letter_spacing() {
    return this.tracking
  },
  typography: {
    type: 'typography',
  },

  space: {
    type: 'dimension',
  },
  get spacing() {
    return this.space
  },

  size: {
    type: 'dimension',
  },

  stroke_style: {
    type: 'stroke_style',
  },
  border_color: {
    type: 'color',
  },
  border_width: {
    type: 'dimension',
  },
  get border_style() {
    return this.stroke_style
  },
  border_radius: {
    type: 'dimension',
  },
  border: {
    type: 'border',
  },
  outline_color: {
    type: 'color',
  },
  outline_width: {
    type: 'dimension',
  },
  get outline_style() {
    return this.stroke_style
  },
  outline_offset: {
    type: 'dimension',
  },
  outline: {
    type: 'outline',
  },

  box_shadow: {
    type: 'shadow',
  },
  drop_shadow: {
    type: 'drop_shadow',
  },
  blur: {
    type: 'dimension',
  },
  backdrop_blur: {
    type: 'dimension',
  },
  gradient: {
    type: 'gradient',
  },

  transition_property: {
    type: 'transition_property',
  },
  duration: {
    type: 'duration',
  },
  timing_function: {
    type: 'cubic_bezier',
  },
  get cubic_bezier() {
    return this.timing_function
  },
  get easing() {
    return this.timing_function
  },
  delay: {
    type: 'duration',
  },
  transition: {
    type: 'transition',
  },
  keyframes: {
    type: 'keyframes',
  },
  animation: {
    type: 'animation',
  },

  layer: {
    type: 'number',
  },
  get z_index() {
    return this.layer
  },

  runtime: {
    type: 'runtime',
  },
} as const
