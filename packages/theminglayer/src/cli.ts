#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import watcher from '@parcel/watcher'
import { cac } from 'cac'
import kleur from 'kleur'
import micromatch from 'micromatch'

import { build } from '~/lib/build'
import { clearCache } from '~/lib/cache'
import { findConfigFilePath, loadConfigFile } from '~/lib/config'
import { DEFAULT_PATHS, PACKAGE_NAME, PACKAGE_VERSION } from '~/lib/constants'
import { appLogger } from '~/lib/logger'
import { watchMode } from '~/lib/watch-mode'
import { resolvePathFromPackage } from '~/utils/node'
import * as promises from '~/utils/promises'
import { writeFile } from './utils/misc'

async function main() {
  const cli = cac(PACKAGE_NAME)

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

        const configFilePath = DEFAULT_PATHS['config.js']

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
        const presetDirectoryPath = DEFAULT_PATHS['design-tokens']

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

      const configFilePath = findConfigFilePath()

      await buildAndOptionallyWatch()

      async function buildAndOptionallyWatch() {
        await clearCache()

        const { config, dependencies: configDependencies } =
          await loadConfigFile(configFilePath)

        const buildResults = await promises.mapSerial(config, async (c, i) => {
          const {
            _internal: { resolvedTokenSources },
          } = await build(c)

          appLogger.log(`Built token collection ${i! + 1}/${config.length}`)

          return {
            sourcesToWatch: resolvedTokenSources.reduce<
              Array<
                | {
                    type: 'glob'
                    source: string
                    parent: string
                    pattern: string
                  }
                | { type: 'file'; source: string; parent: string }
              >
            >((acc, resolvedTokenSource) => {
              if (resolvedTokenSource.type === 'glob') {
                const { parent, pattern } = resolvedTokenSource
                const source = `${parent}/${pattern}`
                if (!source.includes('/node_modules/')) {
                  acc.push({ ...resolvedTokenSource, source })
                }
              }
              if (resolvedTokenSource.type === 'file') {
                if (!resolvedTokenSource.source.includes('/node_modules/')) {
                  acc.push(resolvedTokenSource)
                }
              }
              return acc
            }, []),
          }
        })

        if (!watchMode.active) return process.exit(0)

        const tokenDirectories = buildResults.reduce<Set<string>>(
          (acc, { sourcesToWatch }) => {
            sourcesToWatch.forEach((source) => {
              acc.add(source.parent)
            })
            return acc
          },
          new Set()
        )

        const watcherPromises: Array<Promise<watcher.AsyncSubscription>> = []

        tokenDirectories.forEach((directory) => {
          watcherPromises.push(
            watcher.subscribe(directory, (_err, events) => {
              events.forEach(async (event) => {
                await promises.mapSerial(
                  buildResults,
                  async ({ sourcesToWatch }, i) => {
                    // check if event.path is in at least 1 of the collection's resolved sources
                    if (
                      sourcesToWatch.some((s) =>
                        micromatch.isMatch(event.path, s.source)
                      )
                    ) {
                      await build(config[i!]!)
                      appLogger.log(
                        `Rebuilt token collection ${i! + 1}/${config.length}`
                      )
                    }
                  }
                )
              })
            })
          )
        })

        const configDirectories = configDependencies.reduce<Set<string>>(
          (acc, path) => {
            const dir = nodePath.dirname(path)
            acc.add(dir)
            return acc
          },
          new Set()
        )

        configDirectories.forEach((directory) => {
          watcherPromises.push(
            watcher.subscribe(directory, (_err, events) => {
              events.forEach(async (event) => {
                await promises.mapSerial(
                  configDependencies,
                  async (dependency) => {
                    if (micromatch.isMatch(event.path, dependency)) {
                      process.off('SIGINT', closeWatchers)
                      await closeWatchers()
                      appLogger.log('Config change detected')
                      await buildAndOptionallyWatch()
                    }
                  }
                )
              })
            })
          )
        })

        const watchers = await Promise.all(watcherPromises)

        async function closeWatchers() {
          await promises.mapParallel(watchers, (watcher) =>
            watcher.unsubscribe()
          )
        }

        process.once('SIGINT', closeWatchers)
      }
    })

  cli.help()
  cli.version(PACKAGE_VERSION)

  cli.parse()
}

main()
