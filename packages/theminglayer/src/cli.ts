#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { cac } from 'cac'
import chokidar from 'chokidar'
import kleur from 'kleur'
import micromatch from 'micromatch'

import { build } from '~/lib/build'
import { clearCache } from '~/lib/cache'
import { findConfigFilePath, loadConfigFile } from '~/lib/config'
import {
  DefaultFileAndDirectoryPaths,
  packageName,
  version,
} from '~/lib/constants'
import { appLogger } from '~/lib/logger'
import { watchMode } from '~/lib/watchMode'
import { resolvePathFromPackage } from '~/utils/node'
import * as promises from '~/utils/promises'
import { writeFile } from './utils/misc'

async function main() {
  const cli = cac(packageName)

  cli
    .command('init', 'Initialize ThemingLayer project')
    .option('-f, --force', 'Force')
    .action(async ({ force }) => {
      async function createConfigFile() {
        const configFileContent = `import { defineConfig } from 'theminglayer'
import { cssPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: 'design-tokens',
  plugins: [cssPlugin()],
})
`

        const configFilePath = DefaultFileAndDirectoryPaths['config.js']

        if (!fs.existsSync(configFilePath) || force) {
          await writeFile(configFilePath, configFileContent)
          appLogger.log(`Created config file at ${kleur.blue(configFilePath)}.`)
        } else {
          appLogger.log(
            `${kleur.blue(
              configFilePath
            )} already exists. Please remove the file or re-run the command with the ${kleur.blue(
              '--force'
            )}/${kleur.blue('-f')} flag.\n`
          )
        }
      }

      async function createPreset() {
        const presetDirectoryPath =
          DefaultFileAndDirectoryPaths['design-tokens']

        if (!fs.existsSync(presetDirectoryPath) || force) {
          await fsp.cp(
            resolvePathFromPackage('@theminglayer/design-tokens/src'),
            presetDirectoryPath,
            { recursive: true }
          )
          appLogger.log(`Created preset at ${kleur.blue(presetDirectoryPath)}.`)
        } else {
          appLogger.log(
            `${kleur.blue(
              presetDirectoryPath
            )} already exists. Please remove the file or re-run the command with the ${kleur.blue(
              '--force'
            )}/${kleur.blue('-f')} flag.`
          )
        }
      }

      await promises.parallel(createConfigFile(), createPreset())
    })

  cli
    .command('build', 'Build tokens')
    .option('-w, --watch', 'Watch')
    .action(async ({ watch }) => {
      if (watch) {
        watchMode.activate()
      }

      const poll = false
      const POLL_INTERVAL = 10

      const watcherOptions = {
        atomic: true,
        usePolling: poll,
        interval: POLL_INTERVAL,
        ignoreInitial: true,
        ignorePermissionErrors: true,
        awaitWriteFinish:
          poll || process.platform === 'win32'
            ? { stabilityThreshold: 50, pollInterval: POLL_INTERVAL }
            : false,
      }

      const configFilePath = findConfigFilePath()

      await buildAndOptionallyWatch()

      async function buildAndOptionallyWatch() {
        await clearCache()

        const { config, dependencies: configDependencies } =
          await loadConfigFile(configFilePath)

        const buildResults = await promises.mapSerial(config, async (c, i) => {
          appLogger.log(
            `Building token collection ${i! + 1}/${config.length}...`
          )

          const {
            _internal: { resolvedSources },
          } = await build(c)

          appLogger.log(`Built token collection ${i! + 1}/${config.length}`)

          return {
            resolvedSources: resolvedSources.reduce<Array<string>>(
              (acc, { type, source }) => {
                if (
                  (type === 'glob' || type === 'file') &&
                  !source.includes('node_modules')
                ) {
                  acc.push(source)
                }
                return acc
              },
              []
            ),
          }
        })

        if (!watchMode.active) return process.exit(0)

        async function changeHandler(changedTokenFilePath: string) {
          await promises.mapSerial(
            buildResults,
            async ({ resolvedSources }, i) => {
              // check if changedTokenFilePath is in at least 1 of the collection's resolved sources
              if (
                resolvedSources.some((resolvedSource) =>
                  micromatch.isMatch(changedTokenFilePath, resolvedSource)
                )
              ) {
                appLogger.log(
                  `Rebuilding token collection ${i! + 1}/${config.length}`
                )
                await build(config[i!]!)
                appLogger.log(
                  `Rebuilt token collection ${i! + 1}/${config.length}`
                )
              }
            }
          )
        }

        const tokenWatcher = chokidar
          .watch(
            buildResults.flatMap(({ resolvedSources }) => resolvedSources),
            watcherOptions
          )
          .on('add', changeHandler)
          .on('change', changeHandler)
          .on('unlink', changeHandler)

        const configWatcher = chokidar.watch(configDependencies, watcherOptions)

        async function closeWatchers() {
          await promises.parallel(tokenWatcher.close(), configWatcher.close())
        }

        process.once('SIGINT', closeWatchers)

        configWatcher.on('change', async () => {
          process.off('SIGINT', closeWatchers)
          await closeWatchers()

          appLogger.log('Config change detected')
          await buildAndOptionallyWatch()
        })
      }
    })

  cli.help()
  cli.version(version)

  cli.parse()
}

main()
