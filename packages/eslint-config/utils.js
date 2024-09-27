/** @type {import('typescript-eslint').config} */
export const defineConfig = (...configs) =>
  configs.map((config) => ({
    files: ['**/*.ts', '**/*.js'],
    ...config,
  }))
