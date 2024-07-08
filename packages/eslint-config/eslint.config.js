import prettierRecommended from 'eslint-plugin-prettier/recommended'
import reactRecommended from 'eslint-plugin-react/configs/recommended'
import globals from 'globals'
import {
  configs as typescriptConfigs,
  parser as typescriptParser,
  plugin as typescriptPlugin,
} from 'typescript-eslint'

const typescriptRecommended = typescriptConfigs.recommended

const ERROR = 'error'
const WARN = 'warn'

const vitestFiles = ['**/__tests__/**/*', '**/*.test.*']
const testFiles = ['**/tests/**', '**/#tests/**', ...vitestFiles]

export const config = [
  {
    ignores: [
      '**/.cache/**',
      '**/node_modules/**',
      '**/build/**',
      '**/public/build/**',
      '**/playwright-report/**',
      '**/server-build/**',
      '**/dist/**',
    ],
  },

  // all files
  {
    plugins: {
      import: (await import('eslint-plugin-import-x')).default,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-warning-comments': [
        ERROR,
        { terms: ['FIXME'], location: 'anywhere' },
      ],
      'import/no-duplicates': [WARN, { 'prefer-inline': true }],
      'import/order': [
        WARN,
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [{ pattern: '#*/**', group: 'internal' }],
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
        },
      ],
    },
  },

  // JSX/TSX files
  hasReact
    ? {
        files: ['**/*.tsx', '**/*.jsx'],
        plugins: {
          react: (await import('eslint-plugin-react')).default,
        },
        languageOptions: {
          parserOptions: {
            jsx: true,
          },
        },
        rules: {
          'react/jsx-key': WARN,
        },
      }
    : null,

  // react-hook rules are applicable in ts/js/tsx/jsx, but only with React as a
  // dep
  hasReact
    ? {
        files: ['**/*.ts?(x)', '**/*.js?(x)'],
        plugins: {
          'react-hooks': (await import('eslint-plugin-react-hooks')).default,
        },
        rules: {
          'react-hooks/rules-of-hooks': ERROR,
          'react-hooks/exhaustive-deps': WARN,
        },
      }
    : null,

  // JS and JSX files
  {
    files: ['**/*.js?(x)'],
    rules: {
      // most of these rules are useful for JS but not TS because TS handles these better
      // if it weren't for https://github.com/import-js/eslint-plugin-import/issues/2132
      // we could enable this :(
      // 'import/no-unresolved': ERROR,
      'no-unused-vars': [
        WARN,
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^ignored',
        },
      ],
    },
  },

  // TS and TSX files
  hasTypeScript
    ? {
        files: ['**/*.ts?(x)'],
        languageOptions: {
          parser: typescriptParser,
          parserOptions: {
            projectService: true,
          },
        },
        plugins: {
          '@typescript-eslint': typescriptPlugin,
        },
        rules: {
          '@typescript-eslint/no-unused-vars': [
            WARN,
            {
              args: 'after-used',
              argsIgnorePattern: '^_',
              ignoreRestSiblings: true,
              varsIgnorePattern: '^ignored',
            },
          ],
          'import/consistent-type-specifier-style': [WARN, 'prefer-inline'],
          '@typescript-eslint/consistent-type-imports': [
            WARN,
            {
              prefer: 'type-imports',
              disallowTypeAnnotations: true,
              fixStyle: 'inline-type-imports',
            },
          ],
        },
      }
    : null,

  // This assumes test files are those which are in the test directory or have
  // *.test.* in the filename. If a file doesn't match this assumption, then it
  // will not be allowed to import test files.
  {
    files: ['**/*.ts?(x)', '**/*.js?(x)'],
    ignores: testFiles,
    rules: {
      'no-restricted-imports': [
        ERROR,
        {
          patterns: [
            {
              group: testFiles,
              message: 'Do not import test files in source files',
            },
          ],
        },
      ],
    },
  },
]

export default config
