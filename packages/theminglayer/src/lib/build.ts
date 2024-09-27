import fs from 'node:fs'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import glob from 'fast-glob'
import globParent from 'glob-parent'
import slash from 'slash'

import { Collection } from '~/lib/collection'
import { PACKAGE_NAME } from '~/lib/constants'
import { appLogger } from '~/lib/logger'
import { importTokens, parseTokenString } from '~/lib/token'
import type { BuildOptions, PluginOutputFile } from '~/types'
import { deepSet, toArray, writeFile } from '~/utils/misc'
import { resolvePathFromPackage } from '~/utils/node'
import * as promises from '~/utils/promises'

function isRemote(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export type ResolvedTokenSource =
  | {
      type: 'file'
      source: string
      parent: string
    }
  | {
      type: 'url'
      source: string
    }
  | {
      type: 'glob'
      source: string
      parent: string
      pattern: string
    }
  | {
      type: 'object'
      source: object
    }
  | { type: 'not_found' }

const GLOB_PATTERN = '**/!(___*).{js,mjs,cjs,json,json5,yml,yaml}'

async function resolveSource(
  source: string | object
): Promise<ResolvedTokenSource> {
  if (typeof source === 'object') {
    return { type: 'object', source }
  } else if (isRemote(source)) {
    return { type: 'url', source }
  } else if (glob.isDynamicPattern(source)) {
    const parentDir = globParent(source)

    let parentPath: string

    if (fs.existsSync(parentDir)) {
      parentPath = nodePath.resolve(parentDir)
    } else {
      parentPath = resolvePathFromPackage(parentDir)
      if (!fs.existsSync(parentPath)) {
        return { type: 'not_found' }
      }
    }

    const pattern = source.replace(`${parentDir}/`, '')
    const parent = slash(parentPath)

    return {
      type: 'glob',
      source: `${parent}/${GLOB_PATTERN}`,
      parent,
      pattern,
    }
  } else if (fs.existsSync(source)) {
    const path = nodePath.resolve(source)
    const stat = await fsp.stat(path)
    const isDirectory = stat.isDirectory()

    if (isDirectory) {
      const parent = slash(path)

      return {
        type: 'glob',
        source: `${parent}/${GLOB_PATTERN}`,
        parent,
        pattern: GLOB_PATTERN,
      }
    } else {
      const source = slash(path)
      const parent = slash(nodePath.dirname(source))

      return { type: 'file', source, parent }
    }
  } else {
    const path = resolvePathFromPackage(source)

    if (!fs.existsSync(path)) {
      return { type: 'not_found' }
    }

    const stat = await fsp.stat(path)
    const isDirectory = stat.isDirectory()

    if (isDirectory) {
      const parent = slash(path)

      return {
        type: 'glob',
        source: `${parent}/${GLOB_PATTERN}`,
        parent,
        pattern: GLOB_PATTERN,
      }
    } else {
      const source = slash(path)
      const parent = slash(nodePath.dirname(source))

      return { type: 'file', source, parent }
    }
  }
}

async function parseTokenSource(
  resolvedTokenSource: ResolvedTokenSource
): Promise<Array<{ tokenSrc: string; tokenTree: object }>> {
  switch (resolvedTokenSource.type) {
    case 'file': {
      return [
        {
          tokenSrc: resolvedTokenSource.source,
          tokenTree: await importTokens(resolvedTokenSource.source),
        },
      ]
    }

    case 'glob': {
      const filePaths = await glob(
        `${resolvedTokenSource.parent}/${resolvedTokenSource.pattern}`
      )

      return promises.mapParallel(filePaths, async (filePath) => {
        return {
          tokenSrc: filePath,
          tokenTree: await importTokens(filePath),
        }
      })
    }

    case 'url': {
      const response = await fetch(resolvedTokenSource.source)

      return [
        {
          tokenSrc: resolvedTokenSource.source,
          tokenTree: parseTokenString(await response.text()),
        },
      ]
    }

    case 'object': {
      return [{ tokenSrc: '', tokenTree: resolvedTokenSource.source }]
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
    resolvedTokenSources: Array<ResolvedTokenSource>
  }
}> {
  const resolvedTokenSources = await promises.mapParallel(
    toArray(sources),
    resolveSource
  )

  const tokenSources = await promises.mapParallel(
    resolvedTokenSources,
    parseTokenSource
  )

  const collection = new Collection({ tokenSources })

  // ThemingLayer plugins

  const pluginData: Record<string, Record<string, string>> = {}

  function getPluginData(pluginName: string, key: string): string | undefined {
    return pluginData[pluginName]?.[key]
  }

  const outputFiles: Array<PluginOutputFile> = []

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
    appLogger.withLineHeader(PACKAGE_NAME)
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
    _internal: { resolvedTokenSources },
  }
}
