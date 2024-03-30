import fs from 'node:fs'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import glob from 'fast-glob'
import globParent from 'glob-parent'

import { name as packageName } from '~/../package.json'
import { Collection } from '~/lib/Collection'
import { appLogger } from '~/lib/logger'
import { importTokens } from '~/lib/token'
import type { BuildOptions, PluginOutputFile } from '~/types'
import { deepSet, toArray, writeFile } from '~/utils/misc'
import { cwd, require } from '~/utils/node'
import * as promises from '~/utils/promises'

function resolvePathFromPackage(path: string): string {
  const parts = path.split('/')
  let packageJsonPath = ''
  let packageDir = ''

  while (!packageJsonPath) {
    if (!parts.length) return ''

    packageDir = nodePath.join(packageDir, parts.shift()!)

    try {
      // TODO consider using resolve-cwd package instead
      packageJsonPath = require.resolve(
        nodePath.join(packageDir, 'package.json'),
        { paths: [cwd] }
      )
    } catch {}
  }

  return nodePath.join(
    nodePath.dirname(packageJsonPath),
    path.slice(packageDir.length + 1)
  )
}

function isRemote(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

type ResolvedSource =
  | {
      type: 'file' | 'glob' | 'object' | 'url'
      source: string
    }
  | { type: 'not_found'; source: null }

const GLOB_PATTERN = '**/!(___*).{js,mjs,cjs,json,json5,yml,yaml}'

async function resolveSource(source: string): Promise<ResolvedSource> {
  if (typeof source === 'object') {
    return { type: 'object', source }
  } else if (isRemote(source)) {
    return { type: 'url', source }
  } else if (fs.existsSync(source)) {
    const path = nodePath.resolve(source)
    const stat = await fsp.stat(path)
    const isDirectory = stat.isDirectory()

    return isDirectory
      ? {
          type: 'glob',
          source: `${glob.convertPathToPattern(path)}/${GLOB_PATTERN}`,
        }
      : { type: 'file', source: glob.convertPathToPattern(path) }
  } else if (glob.isDynamicPattern(source)) {
    const parent = globParent(source)

    let parentPath: string

    if (fs.existsSync(parent)) {
      parentPath = nodePath.resolve(parent)
    } else {
      parentPath = resolvePathFromPackage(parent)
      if (!fs.existsSync(parentPath)) {
        return { type: 'not_found', source: null }
      }
    }

    const pattern = source.replace(`${parent}/`, '')

    return {
      type: 'glob',
      source: `${glob.convertPathToPattern(parentPath)}/${pattern}`,
    }
  } else {
    const path = resolvePathFromPackage(source)

    if (!fs.existsSync(path)) {
      return { type: 'not_found', source: null }
    }

    const stat = await fsp.stat(path)
    const isDirectory = stat.isDirectory()

    return isDirectory
      ? {
          type: 'glob',
          source: `${glob.convertPathToPattern(path)}/${GLOB_PATTERN}`,
        }
      : { type: 'file', source: glob.convertPathToPattern(path) }
  }
}

async function parseSource({
  type,
  source,
}: ResolvedSource): Promise<{ sourceUnit: string; rawTokenObject: object }[]> {
  switch (type) {
    case 'file': {
      return [
        { sourceUnit: source, rawTokenObject: await importTokens(source) },
      ]
    }
    case 'glob': {
      const filePaths = await glob(source)
      return promises.mapParallel(filePaths, async (filePath) => {
        return {
          sourceUnit: filePath,
          rawTokenObject: await importTokens(filePath),
        }
      })
    }
    case 'url':
    case 'object': {
      return []
    }

    case 'not_found': {
      // TODO log not found
      return []
    }
  }
}

export async function build({
  plugins,
  sources,
  ...buildOptions
}: BuildOptions): Promise<{
  collection: Collection
  _internal: {
    resolvedSources: ResolvedSource[]
  }
}> {
  const resolvedSources = await promises.mapParallel(
    toArray(sources),
    resolveSource
  )

  const tokenSources = await promises.mapParallel(resolvedSources, parseSource)

  const collection = new Collection({ tokenSources })

  // ThemingLayer plugins

  const pluginData: Record<string, Record<string, string>> = {}

  function getPluginData(pluginName: string, key: string): string | undefined {
    return pluginData[pluginName]?.[key]
  }

  const outputFiles: PluginOutputFile[] = []

  function addOutputFile(outputFile: PluginOutputFile): void {
    outputFiles.push(outputFile)
  }

  await promises.mapSerial(plugins, async (plugin) => {
    appLogger.withLineHeader(plugin.name)
    await plugin.build({
      collection,
      addOutputFile,
      getPluginData,
      setPluginData(key: string, value: string): void {
        deepSet(pluginData, [plugin.name, key], value)
      },
      logger: appLogger,
    })
    appLogger.withLineHeader(packageName)
  })

  const warningMessage = appLogger.warnings.generateMessage()
  warningMessage && appLogger.log(warningMessage)

  await promises.mapParallel(outputFiles, async ({ filePath, content }) =>
    writeFile(
      nodePath.isAbsolute(filePath)
        ? filePath
        : nodePath.join(buildOptions.outDir, filePath),
      content
    )
  )

  return {
    collection,
    _internal: { resolvedSources },
  }
}
