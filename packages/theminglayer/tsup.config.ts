import { defineConfig } from 'tsup'

export default defineConfig([
  {
    clean: !!process.env.CI,
    dts: true,
    entry: ['src/index.ts', 'src/cli.ts', 'src/plugins.ts'],
    format: ['esm'],
    external: ['esbuild'],
  },
  {
    clean: !!process.env.CI,
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
    clean: !!process.env.CI,
    dts: true,
    entry: ['src/postcss.ts'],
    format: ['esm', 'cjs'],
  },
])
