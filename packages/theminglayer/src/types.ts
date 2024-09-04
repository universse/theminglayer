import type { Collection } from '~/lib/collection'
import type { appLogger } from '~/lib/logger'
import type { TokenType } from '~/lib/spec'

type UserTokenOptionaLAttributes = {
  $category?: string
  $type?: TokenType
  $condition?: Record<string, string>
  $variant?: Record<string, string | Array<string>>
  // $backdrop?: boolean
}

export type UserToken = {
  $value: unknown
} & UserTokenOptionaLAttributes

export type Token = {
  $value: unknown
  $type: TokenType
  $extensions: {
    keys: Array<string>
    // source: string
    component: string | null
    conditionTokens: Array<Token>
    variantTokens: Array<Token>
  }
  _internal: {
    referencedTokensOrSets: Array<Token | TokenSet>
  }
} & UserTokenOptionaLAttributes

export type RESERVED_TOKEN_KEYS =
  | '$type'
  | '$value'
  | '$description'
  | '$category'
  | '$condition'
  | '$variant'
  | '$set'
  | '$extensions'

export type TokenSet = {
  $set: Array<Token>
}

interface SharedBuildOptions {
  outDir: string
}

export interface BuildOptions extends SharedBuildOptions {
  sources: string | Array<string> | object | Array<object>
  plugins: Array<Plugin>
}

export type PostcssCachedData = {
  rulesByCustomPropertyName: Record<string, any>
  customAtRules: any
  safelist: Array<string>
  containerSelector: string
}

export type PluginOutputFile = { filePath: string; content: string }

export type Plugin = {
  name: string
  build: (args: {
    collection: Collection
    addOutputFile: (args: PluginOutputFile) => void
    getPluginData: (pluginName: string, key: string) => string | undefined
    setPluginData: (key: string, value: string) => void
    logger: typeof appLogger
  }) => Promise<unknown> | void
}

export type PluginCreator<PluginOptions> = (options?: PluginOptions) => Plugin
