import { PluginCreator } from 'postcss'

type PluginOptions = {
  safelist?: string[]
  outputVariable?: boolean
}
declare const plugin: PluginCreator<PluginOptions>

export { type PluginOptions, plugin as default }
