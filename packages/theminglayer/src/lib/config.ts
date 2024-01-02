import fs from 'node:fs'

import { watchMode } from '~/lib/watchMode'
import { postcssIntegrationPlugin } from '~/plugins'
import { type BuildOptions } from '~/types'
import { importJs } from '~/utils/importJs'
import { toArray } from '~/utils/misc'

export function findConfigFilePath() {
  const filePath = [
    'theminglayer.config.js',
    'theminglayer.config.mjs',
    'theminglayer.config.ts',
  ].find((filePath) => fs.existsSync(filePath))

  return filePath
}

const DEFAULT_BUILD_CONFIG = {
  sources: 'design-tokens.json',
  plugins: [postcssIntegrationPlugin()],
  outDir: 'dist-tokens',
}

type UserBuildOptions = Partial<BuildOptions> & {
  sources: BuildOptions['sources']
}

export function defineConfig(
  config: UserBuildOptions | UserBuildOptions[]
): BuildOptions[] {
  return toArray(config).map((c) => ({ ...DEFAULT_BUILD_CONFIG, ...c }))
}

export async function loadConfigFile(
  filePath: string | undefined
): Promise<{ config: BuildOptions[]; dependencies: string[] }> {
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
