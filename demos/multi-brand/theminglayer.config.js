import { defineConfig } from 'theminglayer'
import { cssPlugin } from 'theminglayer/plugins'

export default defineConfig([
  {
    sources: [`design-tokens/core`, `design-tokens/brand-a`],
    outDir: `public/dist-tokens/brand-a`,
    plugins: [
      cssPlugin({
        files: [
          {
            path: `forced-contrast-styles.css`,
            filter: (token) => token.$condition?.contrast_pref === `forced`,
          },
          {
            path: `styles.css`,
            filter: (token) => token.$condition?.contrast_pref !== `forced`,
          },
        ],
      }),
    ],
  },
  {
    sources: [`design-tokens/core`, `design-tokens/brand-b`],
    outDir: `public/dist-tokens/brand-b`,
    plugins: [
      cssPlugin({
        files: [
          {
            path: `forced-contrast-styles.css`,
            filter: (token) => token.$condition?.contrast_pref === `forced`,
          },
          {
            path: `styles.css`,
            filter: (token) => token.$condition?.contrast_pref !== `forced`,
          },
        ],
      }),
    ],
  },
])
