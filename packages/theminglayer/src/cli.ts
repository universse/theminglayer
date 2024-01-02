import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { cac } from 'cac'
import chalk from 'chalk'
import chokidar from 'chokidar'
import micromatch from 'micromatch'

import { name as packageName, version } from '~/../package.json'
import { build } from '~/lib/build'
import { clearCache } from '~/lib/cache'
import { type Collection } from '~/lib/Collection'
import { findConfigFilePath, loadConfigFile } from '~/lib/config'
import { watchMode } from '~/lib/watchMode'
import * as promises from '~/utils/promises'

async function main() {
  const cli = cac(packageName)

  cli
    .command('init', 'Initialize ThemingLayer project')
    .option('-f, --force', 'Force')
    .action(async ({ force }) => {
      async function createConfigFile() {
        const configFilePath = './theminglayer.config.js'
        const configFileContent = `import { defineConfig } from 'theminglayer'
import { cssPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: 'design-tokens',
  plugins: [cssPlugin()],
})
`

        if (!fs.existsSync(configFilePath) || force) {
          await fsp.writeFile(configFilePath, configFileContent)
          console.log(`Created config file at ${chalk.blue(configFilePath)}.`)
        } else {
          console.log(
            `${chalk.blue(
              configFilePath
            )} already exists. Please remove the file or re-run the command with the ${chalk.blue(
              '--force'
            )}/${chalk.blue('-f')} flag.\n`
          )
        }
      }

      async function createPreset() {
        const presetPath = './design-tokens'

        if (!fs.existsSync(presetPath) || force) {
          await fsp.cp(
            new URL('../presets/base', import.meta.url),
            presetPath,
            { recursive: true }
          )
          console.log(`Created preset at ${chalk.blue(presetPath)}.`)
        } else {
          console.log(
            `${chalk.blue(
              presetPath
            )} already exists. Please remove the file or re-run the command with the ${chalk.blue(
              '--force'
            )}/${chalk.blue('-f')} flag.`
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

        const buildResults = (await promises.mapParallel(config, async (c) => {
          const {
            collection,
            _internal: { resolvedSources },
          } = await build(c)

          return {
            collection,
            resolvedSources: resolvedSources.reduce((acc, { type, source }) => {
              if (
                (type === 'glob' || type === 'file') &&
                !source.includes('node_modules')
              ) {
                acc.push(source)
              }
              return acc
            }, [] as string[]),
          }
        })) as { collection: Collection; resolvedSources: string[] }[]

        if (!watchMode.active) return process.exit(0)

        async function changeHandler(changedTokenFilePath: string) {
          await promises.mapParallel(
            buildResults,
            async ({ resolvedSources }, i) => {
              // check if changedTokenFilePath is in at least 1 of the collection's resolved sources
              if (
                resolvedSources.some((resolvedSource) =>
                  micromatch.isMatch(changedTokenFilePath, resolvedSource)
                )
              ) {
                await build(config[i!]!)
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
          await Promise.all([tokenWatcher.close(), configWatcher.close()])
        }

        process.once('SIGINT', closeWatchers)

        configWatcher.on('change', async () => {
          process.off('SIGINT', closeWatchers)
          await closeWatchers()
          await buildAndOptionallyWatch()
        })
      }
    })

  cli.help()
  cli.version(version)

  cli.parse()
}

main()
