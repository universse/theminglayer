import { toArray } from '~/utils/misc'

export const MessageHeaders = {
  MISSING_ALIAS: 'Aliases not found:',
  MULTIPLE_WILDCARD_VARIANT: 'Multiple wildcard variants are not supported:',
  TOKEN_COLLISION: 'Token collisions found:',
  UNKNOWN_TOKEN_CATEGORY: 'Unknown token category:',
  UNKNOWN_TOKEN_TYPE: 'Unknown token type:',
} as const

const lines: string[] = []

export const messageLogger = {
  add(messageLine: string | string[]) {
    lines.push('----------')
    lines.push(...toArray(messageLine))
  },
  log(messageLine: string | string[]) {
    this.flush()
    this.add(messageLine)
    this.flush()
  },
  flush() {
    if (lines.length) {
      console.log(lines.join('\n'))
      lines.length = 0
    }
  },
}
