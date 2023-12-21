type TokenType =
  | 'color'
  | 'cubic_bezier'
  | 'dimension'
  | 'duration'
  | 'font_family'
  | 'font_style'
  | 'font_weight'
  | 'number'
  | 'border'
  | 'shadow'
  | 'stroke_style'
  | 'transition'
  | 'typography'
  | 'condition'
  | 'font_variant'
  | 'leading'
  | 'tracking'
  | 'transition_property'
  | 'variant'
  | 'outline'
  | 'drop_shadow'

type UserTokenOptionaLAttributes = {
  $category?: string
  $type?: TokenType
  $condition?: Record<string, string>
  $variant?: Record<string, string | string[]>
  $backdrop?: boolean
}
type Token = {
  $value: unknown
  $type: TokenType
  $tl: {
    keys: string[]
    component: string | null
    conditionTokens: Token[]
    variantTokens: Token[]
  }
  _internal: {
    referencedTokensOrSets: (Token | TokenSet)[]
  }
} & UserTokenOptionaLAttributes
type TokenSet = {
  $set: Token[]
}
interface SharedBuildOptions {
  outDir: string
  [key: string]: unknown
}
interface BuildOptions extends SharedBuildOptions {
  sources: string | string[]
  plugins: Plugin[]
}
type PluginOutputFile = {
  filePath: string
  content: string
}
type Plugin = {
  name: string
  build: (args: {
    collection: Collection
    buildOptions: SharedBuildOptions
    addOutputFile: (args: PluginOutputFile) => void
    getPluginData: (pluginName: string, key: string) => string | undefined
    setPluginData: (key: string, value: string) => void
  }) => Promise<unknown> | void
}
type PluginCreator<PluginOptions> = (options?: PluginOptions) => Plugin

declare class Collection {
  #private
  tokenObject: object
  tokens: Token[]
  constructor({
    tokenSources,
  }: {
    tokenSources: {
      sourceUnit: string
      rawTokenObject: object
    }[][]
  })
  static fromJSON(data: unknown): Collection
}

export {
  type BuildOptions,
  Collection,
  type Plugin,
  type Token,
  type PluginCreator,
}
