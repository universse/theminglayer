import { defineConfig } from 'theminglayer'
import { cssPlugin, tailwindPresetPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: [`design-tokens`, `src/components/*/tokens.json5`],
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
    tailwindPresetPlugin(),
  ],
})
