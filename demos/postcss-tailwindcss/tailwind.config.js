import plugin from 'tailwindcss/plugin'

import { preset } from './.theminglayer/dist/tailwindPreset.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['src/**/*.{astro,jsx,tsx,mdx}'],
  presets: [preset],
  plugins: [
    plugin(({ addComponents }) => {
      addComponents({
        '.typography-body': {
          fontFamily: 'var(--tl-typography-body-font-family)',
          fontSize: 'var(--tl-typography-body-font-size)',
          fontStyle: 'var(--tl-typography-body-font-style)',
          fontWeight: 'var(--tl-typography-body-font-weight)',
          letterSpacing: 'var(--tl-typography-body-letter-spacing)',
          lineHeight: 'var(--tl-typography-body-line-height)',
        },
        '.typography-button': {
          fontFamily: 'var(--tl-typography-button-font-family)',
          fontSize: 'var(--tl-typography-button-font-size)',
          fontStyle: 'var(--tl-typography-button-font-style)',
          fontWeight: 'var(--tl-typography-button-font-weight)',
          letterSpacing: 'var(--tl-typography-button-letter-spacing)',
          lineHeight: 'var(--tl-typography-button-line-height)',
        },
      })
    }),
  ],
}
