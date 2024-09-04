import fs from 'node:fs'

import { DEFAULT_PATHS } from '~/lib/constants'
import { watchMode } from '~/lib/watch-mode'
import { cssPlugin } from '~/plugins'
import type { BuildOptions } from '~/types'
import { importJs } from '~/utils/import-js'
import { toArray } from '~/utils/misc'

export function findConfigFilePath() {
  const filePath = [
    DEFAULT_PATHS['config.js'],
    DEFAULT_PATHS['config.mjs'],
    DEFAULT_PATHS['config.ts'],
  ].find((filePath) => fs.existsSync(filePath))

  return filePath
}

const DEFAULT_BUILD_CONFIG = {
  sources: DEFAULT_PATHS['design-tokens'],
  plugins: [cssPlugin()],
  outDir: DEFAULT_PATHS.dist,
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
