import kleur from 'kleur'

import { PACKAGE_NAME } from '~/lib/constants'
import { generateKeyString } from '~/utils/misc'

function createWarnings() {
  const missingAliases = new Set<string>([])
  const collisions = new Map<string, Set<string>>()
  const typeMissing = new Set<string>([])
  const invalidCssValues = new Set<string>([])

  return {
    tokenCollision(keys: Array<string>, sources: [string, string]) {
      const keyString = generateKeyString(keys)
      let collisionByKeyString = collisions.get(keyString)
      if (!collisionByKeyString) {
        collisionByKeyString = new Set()
        collisions.set(keyString, collisionByKeyString)
      }
      collisionByKeyString.add(sources[0])
      collisionByKeyString.add(sources[1])
    },
    missingAlias(key: string) {
      missingAliases.add(key)
    },
    missingTokenType(keys: Array<string>) {
      typeMissing.add(generateKeyString(keys))
    },
    invalidCssValue(keys: Array<string>) {
      invalidCssValues.add(generateKeyString(keys))
    },
    generateMessage() {
      const lines: Array<string> = []

      if (collisions.size) {
        lines.push('----------')
        lines.push('Token collisions found:')
        collisions.forEach((sources, keyString) => {
          lines.push(`- Key: ${kleur.yellow(keyString)}`)
          lines.push('- Sources:')
          sources.forEach((source) => {
            lines.push(`  ${kleur.yellow(source)}`)
          })
        })
        collisions.clear()
      }

      if (missingAliases.size) {
        lines.push('----------')
        lines.push('Aliases not found:')
        missingAliases.forEach((keyString) =>
          lines.push(`- ${kleur.yellow(keyString)}`)
        )
        missingAliases.clear()
      }

      if (typeMissing.size) {
        lines.push('----------')
        lines.push('Missing token type:')
        typeMissing.forEach((keyString) =>
          lines.push(`- ${kleur.yellow(keyString)}`)
        )
        typeMissing.clear()
      }

      if (invalidCssValues.size) {
        lines.push('----------')
        lines.push('Failed to transform token to CSS:')
        invalidCssValues.forEach((keyString) =>
          lines.push(`- ${kleur.yellow(keyString)}`)
        )
        invalidCssValues.clear()
      }

      if (lines.length) {
        lines.unshift(`${kleur.bgYellow().bold(' WARNINGS ')}`)
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
      console.log(`${kleur.green(_name)} ${message}`)
    },
    warnings: createWarnings(),
  }
}

export const appLogger = createLogger(PACKAGE_NAME)
