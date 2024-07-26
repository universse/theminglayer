import fs from 'node:fs'

import { DefaultFileAndDirectoryPaths } from '~/lib/constants'
import { watchMode } from '~/lib/watchMode'
import { cssPlugin } from '~/plugins'
import type { BuildOptions } from '~/types'
import { importJs } from '~/utils/importJs'
import { toArray } from '~/utils/misc'

export function findConfigFilePath() {
  const filePath = [
    DefaultFileAndDirectoryPaths['config.js'],
    DefaultFileAndDirectoryPaths['config.mjs'],
    DefaultFileAndDirectoryPaths['config.ts'],
  ].find((filePath) => fs.existsSync(filePath))

  return filePath
}

const DEFAULT_BUILD_CONFIG = {
  sources: DefaultFileAndDirectoryPaths['design-tokens'],
  plugins: [cssPlugin()],
  outDir: DefaultFileAndDirectoryPaths.dist,
}

type UserBuildOptions = Partial<BuildOptions> & {
  sources: BuildOptions['sources']
}

export function defineConfig(
  config: UserBuildOptions | Array<UserBuildOptions>
): Array<BuildOptions> {
  return toArray(config).map((c) => ({ ...DEFAULT_BUILD_CONFIG, ...c }))
}

export async function loadConfigFile(
  filePath: string | undefined
): Promise<{ config: Array<BuildOptions>; dependencies: Array<string> }> {
  if (!filePath)
    return {
      config: defineConfig(DEFAULT_BUILD_CONFIG),
      dependencies: [],
    }

  const { module, dependencies } = await importJs(filePath, {
    watch: watchMode.active,
  })

  return {
    config: defineConfig(module.default ?? module),
    dependencies,
  }
}
