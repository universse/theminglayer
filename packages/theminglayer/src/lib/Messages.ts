import { toArray } from '~/utils/misc'

export const MessageHeaders = {
  MISSING_ALIAS: 'Aliases not found:',
  MULTIPLE_WILDCARD_VARIANT: 'Multiple wildcard variants are not supported:',
  TOKEN_COLLISION: 'Token collisions found:',
  UNKNOWN_TOKEN_CATEGORY: 'Unknown token category:',
  UNKNOWN_TOKEN_TYPE: 'Unknown token type:',
} as const

function createWarningMessages() {
  const warningMessageLines: string[] = []

  return {
    add(messageLine: string | string[]) {
      warningMessageLines.push('----------')
      warningMessageLines.push(...toArray(messageLine))
    },
    flush() {
      console.log(warningMessageLines.join('\n'))
      this.clear()
    },
    clear() {
      warningMessageLines.length = 0
    },
  }
}

export const warningMessages = createWarningMessages()

// export class Messages {
//   #messageLines: string[] = []

//   add(messageLine: string | string[]) {
//     this.#messageLines.push(`----------`)
//     this.#messageLines.push(...toArray(messageLine))
//   }

//   flush() {
//     console.log(this.#messageLines.join(`\n`))
//   }
// }
