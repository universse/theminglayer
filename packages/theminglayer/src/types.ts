import { type Collection } from '~/lib/Collection'
import { type TokenType } from '~/lib/spec'

type UserTokenOptionaLAttributes = {
  $category?: string
  $type?: TokenType
  $condition?: Record<string, string>
  $variant?: Record<string, string | string[]>
  $backdrop?: boolean
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
  | `$type`
  | `$value`
  | `$description`
  | `$category`
  | `$condition`
  | `$variant`
  | `$set`
  | `$extensions`

export type TokenSet = {
  $set: Token[]
}

interface SharedBuildOptions {
  outDir: string
  [key: string]: unknown
}

export interface BuildOptions extends SharedBuildOptions {
  sources: string | string[]
  plugins: Plugin[]
}

export type CachedBuild = {
  data: {
    collectionData: Collection
    buildOptions: SharedBuildOptions
  }[]
}

export type PluginOutputFile = { filePath: string; content: string }

export type Plugin = {
  name: string
  build: (args: {
    collection: Collection
    buildOptions: SharedBuildOptions
    addOutputFile: (args: PluginOutputFile) => void
    getPluginData: (pluginName: string, key: string) => string | undefined
    setPluginData: (key: string, value: string) => void
  }) => Promise<unknown> | void
}

export type PluginCreator<PluginOptions> = (options?: PluginOptions) => Plugin
