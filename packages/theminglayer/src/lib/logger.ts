import chalk from 'chalk'

import { name as packageName } from '~/../package.json'
import { generateKeyString } from '~/utils/misc'

function createWarnings() {
  const missingAliases = new Set<string>([])
  const invalidVariants = new Set<string>([])
  const collisions = new Map<string, Set<string>>()
  const typeMissing = new Set<string>([])
  const invalidCssValues = new Set<string>([])

  return {
    tokenCollision(keys: string[], sources: [string, string]) {
      const keyString = generateKeyString(keys)
      let collisionByKeyString = collisions.get(keyString)
      if (!collisionByKeyString) {
        collisionByKeyString = new Set()
        collisions.set(keyString, collisionByKeyString)
      }
      collisionByKeyString.add(sources[0])
      collisionByKeyString.add(sources[1])
    },
    multipleWildcardVariants(keys: string[]) {
      invalidVariants.add(generateKeyString(keys))
    },
    missingAlias(key: string) {
      missingAliases.add(key)
    },
    missingTokenType(keys: string[]) {
      typeMissing.add(generateKeyString(keys))
    },
    invalidCssValue(keys: string[]) {
      invalidCssValues.add(generateKeyString(keys))
    },
    generateMessage() {
      const lines: string[] = []

      if (collisions.size) {
        lines.push('----------')
        lines.push('Token collisions found:')
        collisions.forEach((sources, keyString) => {
          lines.push(`- Key: ${chalk.yellowBright(keyString)}`)
          lines.push(`- Sources:`)
          sources.forEach((source) => {
            lines.push(`  ${chalk.yellowBright(source)}`)
          })
        })
        collisions.clear()
      }

      if (invalidVariants.size) {
        lines.push('----------')
        lines.push('Multiple wildcard variants are not supported:')
        invalidVariants.forEach((keyString) =>
          lines.push(`- ${chalk.yellowBright(keyString)}`)
        )
        invalidVariants.clear()
      }

      if (missingAliases.size) {
        lines.push('----------')
        lines.push('Aliases not found:')
        missingAliases.forEach((keyString) =>
          lines.push(`- ${chalk.yellowBright(keyString)}`)
        )
        missingAliases.clear()
      }

      if (typeMissing.size) {
        lines.push('----------')
        lines.push('Missing token type:')
        typeMissing.forEach((keyString) =>
          lines.push(`- ${chalk.yellowBright(keyString)}`)
        )
        typeMissing.clear()
      }

      if (invalidCssValues.size) {
        lines.push('----------')
        lines.push('Failed to transform token to CSS:')
        invalidCssValues.forEach((keyString) =>
          lines.push(`- ${chalk.yellowBright(keyString)}`)
        )
        invalidCssValues.clear()
      }

      if (lines.length) {
        lines.unshift(`${chalk.bgYellowBright.bold(' WARNINGS ')}`)
        lines.push('----------')
        const message = lines.join('\n')
        lines.length = 0
        return message
      }
    },
  }
}

function createLogger(name: string) {
  let _name = name
  return {
    withLineHeader(name: string) {
      _name = name
    },
    log(message: string) {
      console.log(`${chalk.green(_name)} ${message}`)
    },
    warnings: createWarnings(),
  }
}

export const appLogger = createLogger(packageName)
