import { fixupPluginRules } from '@eslint/compat'
import js from '@eslint/js'
import markdown from '@eslint/markdown'
import importX from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import * as mdx from 'eslint-plugin-mdx'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import react from 'eslint-plugin-react'
import reactCompiler from 'eslint-plugin-react-compiler'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import ts from 'typescript-eslint'

import { defineConfig } from './utils.js'

const ERROR = 'error'
const WARN = 'warn'
const OFF = 'off'

const vitestFiles = ['**/__tests__/**/*', '**/*.test.*']
const testFiles = ['**/tests/**', '**/#tests/**', ...vitestFiles]

// https://github.com/ixahmedxi/orbitkit/tree/main/packages/config/eslint/src/configs
// https://github.com/epicweb-dev/config/blob/main/eslint.js

export const core = defineConfig(
  {
    ignores: ['dist', 'build', 'public', '.astro', '*.min.js', '*.generated.*'],
  },

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        ...globals.worker,
      },
      parserOptions: {
        projectService: true,
      },
    },
  },

  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': OFF,
      '@typescript-eslint/no-import-type-side-effects': ERROR,
      '@typescript-eslint/no-unused-vars': OFF,
      '@typescript-eslint/strict-boolean-expressions': [
        ERROR,
        { allowNumber: false },
      ],
    },
  },
  prettierRecommended,

  importX.flatConfigs.recommended,
  {
    rules: {
      'import-x/no-unresolved': OFF,
    },
  },
  importX.flatConfigs.typescript,

  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      ...react.configs.flat.recommended.plugins,
      ...jsxA11y.flatConfigs.strict.plugins,
      'react-hooks/exhaustive-deps': [
        'warn',
        { additionalHooks: '(useIsomorphicLayoutEffect)' },
      ],
      'react-compiler': fixupPluginRules(reactCompiler),
    },
    languageOptions: {
      parser: ts.parser,
      ...react.configs.flat['jsx-runtime'].languageOptions,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...jsxA11y.flatConfigs.strict.rules,
      'react/jsx-sort-props': [
        'error',
        {
          ignoreCase: true,
          reservedFirst: true,
        },
      ],
      'react-compiler/react-compiler': ERROR,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.ts?(x)', '**/*.js?(x)'],
    plugins: {
      'react-hooks': fixupPluginRules(reactHooks),
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  ...markdown.configs.recommended,

  {
    ...mdx.flat,
    processor: mdx.createRemarkProcessor({
      lintCodeBlocks: true,
    }),
  },
  {
    ...mdx.flatCodeBlocks,
    rules: {
      ...mdx.flatCodeBlocks.rules,
    },
  }
)
