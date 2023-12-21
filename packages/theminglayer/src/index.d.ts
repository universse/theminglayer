import { BuildOptions } from './common.js'

export { Collection, Plugin, PluginCreator } from './common.js'

type UserBuildOptions = Partial<BuildOptions> & {
  sources: BuildOptions['sources']
}
declare function defineConfig(
  config: UserBuildOptions | UserBuildOptions[]
): BuildOptions[]

export { defineConfig }
