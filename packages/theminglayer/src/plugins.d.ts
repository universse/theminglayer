import { PluginCreator, Token } from './common.js'

declare const cssPlugin: PluginCreator<{
  files?: {
    path: string
    filter: (token: Token) => boolean
    outputVariable?: boolean
  }[]
}>

type ModuleFormat = 'esm' | 'cjs'
declare const tailwindPresetPlugin: PluginCreator<{
  files?: {
    path: string
    filter: (token: Token) => boolean
    format?: ModuleFormat
    outputVariable?: boolean
  }[]
}>

export { cssPlugin, tailwindPresetPlugin }
