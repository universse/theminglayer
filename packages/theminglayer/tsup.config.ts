import { defineConfig } from 'tsup'

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: ['src/index.ts', 'src/cli.ts', 'src/plugins.ts'],
    format: ['esm'],
    external: ['esbuild'],
  },
  {
    clean: true,
    dts: true,
    entry: {
      'browser/index': 'src/index.ts',
      'browser/plugins': 'src/plugins.ts',
      'browser/build': 'src/lib/build.ts',
    },
    format: ['esm'],
    minify: true,
    platform: 'browser',
  },
  {
    clean: true,
    dts: true,
    entry: ['src/postcss.ts'],
    format: ['esm', 'cjs'],
  },
])
