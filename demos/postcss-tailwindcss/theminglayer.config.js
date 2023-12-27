import { defineConfig } from 'theminglayer'
import { tailwindPresetPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: [`design-tokens`, `src/components/*/tokens.json5`],
  plugins: [tailwindPresetPlugin()],
})
