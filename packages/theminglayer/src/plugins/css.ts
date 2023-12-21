import nodePath from 'node:path'
import postcss, {
  type AtRule,
  type PluginCreator as PostcssPluginCreator,
} from 'postcss'
import { z } from 'zod'

import { name as packageName } from '~/../package.json'
import { CssFormatter } from '~/lib/CssFormatter'
import { compareRuleSpecificity, createCachedInsertRules } from '~/lib/cssUtils'
import { type PluginCreator, type Token } from '~/types'
import * as promises from '~/utils/promises'

const buildOptionsSchema = z.object({
  outDir: z.string(),
  prefix: z.string(),
})

export const cssPlugin: PluginCreator<{
  files?: {
    path: string
    filter: (token: Token) => boolean
    outputVariable?: boolean
  }[]
}> = ({
  files = [{ path: `theme.css`, filter: () => true, outputVariable: false }],
} = {}) => {
  const postcssPlugin: PostcssPluginCreator<{
    rules: unknown[]
  }> = ({ rules } = { rules: [] }) => {
    const insertRules = createCachedInsertRules()

    return {
      postcssPlugin: `postcss-name`,
      Once(root, { postcss }) {
        let directive: AtRule
        root.walkAtRules(packageName, (atRule) => {
          directive = atRule
        })
        insertRules(rules.sort(compareRuleSpecificity), directive!, postcss)
        directive!.remove()
      },
    }
  }

  postcssPlugin.postcss = true

  return {
    name: `theminglayer/css`,
    async build({ collection, buildOptions, addOutputFile }) {
      const parsedBuildOptions = buildOptionsSchema.safeParse(buildOptions)

      if (!parsedBuildOptions.success) {
        // TODO throw
        return
      }

      const { outDir, prefix } = parsedBuildOptions.data

      const cssFormatter = new CssFormatter(collection, { prefix })

      await promises.mapParallel(
        files,
        async ({ path, filter = () => true, outputVariable = false }) => {
          const rules = []

          collection.tokens.forEach((token) => {
            const { $type: type } = token

            if (
              type === `condition` ||
              type === `variant` ||
              type === `text` ||
              // TODO future
              type === `gradient` ||
              type === `keyframes`
            )
              return

            if (!filter(token)) return

            rules.push(
              ...cssFormatter.tokenToCssRules(token, { outputVariable })
            )
          })

          // TODO add postcss preset env?
          const result = await postcss([postcssPlugin({ rules })]).process(
            `@theminglayer`,
            { from: undefined! }
          )

          addOutputFile({
            filePath: nodePath.isAbsolute(path)
              ? path
              : nodePath.join(outDir, path),
            content: result.css,
          })
        }
      )
    },
  }
}
