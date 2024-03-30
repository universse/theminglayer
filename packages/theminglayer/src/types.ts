import type { Collection } from '~/lib/Collection'
import type { appLogger } from '~/lib/logger'
import type { TokenType } from '~/lib/spec'

type UserTokenOptionaLAttributes = {
  $category?: string
  $type?: TokenType
  $condition?: Record<string, string>
  $variant?: Record<string, string | string[]>
  // $backdrop?: boolean
}

export type UserToken = {
  $value: unknown
} & UserTokenOptionaLAttributes

export type Token = {
  $value: unknown
  $type: TokenType
  $extensions: {
    keys: string[]
    // source: string
    component: string | null
    conditionTokens: Token[]
    variantTokens: Token[]
  }
  _internal: {
    referencedTokensOrSets: (Token | TokenSet)[]
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
  $set: Token[]
}

interface SharedBuildOptions {
  outDir: string
}

export interface BuildOptions extends SharedBuildOptions {
  sources: string | string[]
  plugins: Plugin[]
}

export type PostcssCachedData = {
  rulesByCustomPropertyName: Record<string, any>
  rulesByClassSelector: Record<string, any>
  customAtRules: any
  safelist: string[]
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
