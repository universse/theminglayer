import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import { pathToFileURL } from 'node:url'
import { context, type BuildContext } from 'esbuild'

import { require } from '~/utils/node'

export async function importJs(filePath: string, { watch = false } = {}) {
  if (!watch && nodePath.extname(filePath) === '.js') {
    return {
      module: await import(pathToFileURL(filePath).toString()),
      dependencies: [],
    }
  }
  const { code, dependencies } = await bundleFile(filePath)
  const module = await compileCode({
    filePath: await fsp.realpath(filePath),
    code,
  })
  return { module, dependencies: watch ? dependencies : [] }
}

const buildContextCache = new Map<
  string,
  BuildContext<{ metafile: true; write: false }>
>()

async function bundleFile(filePath: string) {
  let buildContext = buildContextCache.get(filePath)

  if (!buildContext) {
    buildContext = await context({
      bundle: true,
      entryPoints: [filePath],
      mainFields: ['module', 'main'],
      metafile: true,
      platform: 'node',
      write: false,
      external: ['esbuild'],
    })
    buildContextCache.set(filePath, buildContext)
  }

  const bundle = await buildContext.rebuild()

  return {
    code: bundle.outputFiles[0]!.text,
    dependencies: Object.keys(bundle.metafile.inputs).reduce<Array<string>>(
      (acc, path) => {
        if (!path.includes('/node_modules/')) {
          acc.push(nodePath.resolve(path))
        }
        return acc
      },
      []
    ),
  }
}

function compileCode({ filePath, code }: { filePath: string; code: string }) {
  const extension = nodePath.extname(filePath)

  const originalLoader = require.extensions[extension]!

  require.extensions[extension] = (module, filename) => {
    if (filePath === filename) {
      module._compile(code, filename)
    } else {
      originalLoader(module, filename)
    }
  }

  delete require.cache[filePath]

  const module = require(filePath)

  require.extensions[extension] = originalLoader

  return module
}
