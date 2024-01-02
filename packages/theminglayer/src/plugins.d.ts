import { PluginCreator, Token } from './common.js'

declare const cssPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  files?: {
    path: string
    filter: (token: Token) => boolean
    keepAliases?: boolean
  }[]
}>

declare const tailwindPresetPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  files?: {
    path: string
    filter: (token: Token) => boolean
    format?: 'esm' | 'cjs'
    keepAliases?: boolean
  }[]
}>

declare const postcssIntegrationPlugin: PluginCreator<{
  prefix?: string
  containerSelector?: string
  keepAliases?: boolean
  safelist?: string[]
}>

export { cssPlugin, postcssIntegrationPlugin, tailwindPresetPlugin }
