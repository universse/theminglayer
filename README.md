# ThemingLayer

Extensible design token management & cross-platform code generation tool with powerful theming capabilities

⚠️ _ThemingLayer is under active development. Bugs, breaking changes and missing features are expected before the 1.0 release._

## Features

- Interopable, W3C-compatible design token format
- Three-tier token architecture - global, semantic and component
- Define contextual token values with `$condition` and `$variant` (for component tokens)
- Integrate design tokens into your design and development workflow
  - [CSS plugin](#css-plugin)
  - [PostCSS integration](#postcss-integration)
  - [Usage with Tailwind](#usage-with-tailwind)
  - Stay tuned for more!
- Foundation for a themeable design system

## Documentation

Detailed documentation is coming soon. Meanwhile, take a look at our demos.

- PostCSS + TailwindCSS

  [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/universse/theminglayer/tree/main/demos/postcss-tailwindcss?title=ThemingLayer%20Demo&file=theminglayer.config.js,design-tokens%2Fcolor.json5,src%2Fcomponents%2Fbutton%2Ftokens.json5)

- Multi-brand

  [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/universse/theminglayer/tree/main/demos/multi-brand?title=ThemingLayer%20Demo&file=theminglayer.config.js,design-tokens%2Fcore%2Fcolor.json5,design-tokens%2Fbrand-a%2Faccent.json5)

## Getting Started

To install:

```bash
npm i -D theminglayer
```

To scaffold a project:

```bash
npx theminglayer init
```

This creates `theminglayer.config.js` and `design-tokens`.

Running the CLI build command, optionally in watch mode, generates the CSS theme file at `dist-tokens/theme.css`.

```bash
npx theminglayer build [--watch | -w]
```

## Configuration

```ts
import { defineConfig } from 'theminglayer'
import { cssPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: 'design-tokens.json',
  outDir: 'dist-tokens',
  plugins: [cssPlugin()],
})
```

### `sources`

Required

Specify token source files and directories - ThemingLayer will do a deep merge of all the sources before finding and processing indivdual tokens. When there are any conflicts, tokens in the latter sources override those in the former. Conflicts within the same source should be avoided.

```ts
export default defineConfig({
  sources: [
    'design-tokens/core.json', // a json/json5 file
    'design-tokens/core', // a directory containing json/json5 files
    'design-tokens/core/**/*.json', // a glob pattern
    '@org/design-tokens/core.json', // a file from an npm package
    '@org/design-tokens/core', // a directory from an npm package
    '@org/design-tokens/core/**/*.json', // a glob pattern from an npm package
  ],
  // ...
})
```

### `outDir`

Optional, default: `dist-tokens`

Files generated by plugins will be emitted into this directory

### `plugins`

Required

List of plugins that convert design tokens into platform-specific code or any custom format

Go to the [Plugins and Integration](#plugins-and-integrations) section for more details.

### Advanced Configuration

- `defineConfig` also accepts an array of config object. This is useful for generating code in different formats for different platforms.

  <details open>
    <summary>View configuration</summary>
    <br />

  ```ts
  export default defineConfig([
    {
      sources: ['core', 'platform/**/*.web.json', 'brand-a/web'],
      outDir: 'dist/brand-a/web',
      plugins: [cssPlugin()],
    },
    {
      sources: ['core', 'platform/**/*.ios.json', 'brand-a/ios'],
      outDir: 'dist/brand-a/ios',
      plugins: [iosPlugin()], // only for example purpose
    },
    {
      sources: ['core', 'platform/**/*.android.json', 'brand-a/android'],
      outDir: 'dist/brand-a/android',
      plugins: [androidPlugin()], // only for example purpose
    },
    {
      sources: ['core', 'platform/**/*.web.json', 'brand-b/web'],
      outDir: 'dist/brand-b/web',
      plugins: [cssPlugin()],
    },
    {
      sources: ['core', 'platform/**/*.ios.json', 'brand-b/ios'],
      outDir: 'dist/brand-b/ios',
      plugins: [iosPlugin()], // only for example purpose
    },
    {
      sources: ['core', 'platform/**/*.android.json', 'brand-b/android'],
      outDir: 'dist/brand-b/android',
      plugins: [androidPlugin()], // only for example purpose
    },
  ])
  ```

  </details>

## Plugins and Integrations

Plugins bring design tokens into various design and development tools.

Given the following `design-tokens.json`:

```json
{
  "condition": {
    "color_scheme": {
      "light": {
        "$value": "[data-color-scheme='light']"
      },
      "dark": {
        "$value": "[data-color-scheme='dark']"
      }
    },
    "contrast_pref": {
      "less": {
        "$value": "@media (prefers-contrast: less)"
      },
      "more": {
        "$value": "@media (prefers-contrast: more) and (forced-colors: none)"
      },
      "forced": {
        "$value": "@media (forced-colors: active)"
      }
    }
  },
  "color": {
    "black": {
      "$value": "#000"
    },
    "white": {
      "$value": "#fff"
    },
    "gray": {
      "$value": "#999"
    }
  },
  "border_color": {
    "primary": {
      "$value": "{color.gray}"
    }
  },
  "text_color": {
    "primary": {
      "$set": [
        {
          "$condition": { "color_scheme": "light" },
          "$value": "{color.white}"
        },
        {
          "$condition": { "color_scheme": "dark" },
          "$value": "{color.black}"
        }
      ]
    }
  },
  "component": {
    "button": {
      "color": {
        "$value": "{text_color.primary}"
      }
    }
  }
}
```

### CSS Plugin

Plugin options:

```ts
import { defineConfig } from 'theminglayer'
import { cssPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: 'design-tokens.json',
  outDir: 'dist-tokens',
  plugins: [
    cssPlugin({
      prefix: 'tl-',
      containerSelector: ':root',
      files: [
        {
          path: 'theme.css',
          filter: (token) => true,
          keepAliases: false,
        },
      ],
    }),
  ],
})
```

With `keepAliases: false`, the plugin resolves any reference into CSS value if the referenced design token has no variation.

```css
/* prettified */
:root {
  --tl-color-black: #000;
  --tl-color-white: #fff;
  --tl-color-gray: #999;
  --tl-border-color-primary: #999;
}

:root[data-color-scheme='light'] {
  --tl-text-color-primary: #fff;
}

:root[data-color-scheme='dark'] {
  --tl-text-color-primary: #000;
}

.tl-button {
  --tl-color: var(--tl-text-color-primary);
}
```

With `keepAliases: true`, the plugin converts any reference into a CSS custom property.

```css
/* prettified */
:root {
  --tl-color-black: #000;
  --tl-color-white: #fff;
  --tl-color-gray: #999;
  --tl-border-color-primary: var(--tl-color-gray);
}

:root[data-color-scheme='light'] {
  --tl-text-color-primary: var(--tl-color-white);
}

:root[data-color-scheme='dark'] {
  --tl-text-color-primary: var(--tl-color-black);
}

.tl-button {
  --tl-color: var(--tl-text-color-primary);
}
```

#### Generate multiple stylesheets

```ts
export default defineConfig({
  // ...
  plugins: [
    cssPlugin({
      prefix: 'tl-',
      containerSelector: ':root',
      files: [
        {
          path: 'forced-contrast.css',
          filter: (token) => token.$condition?.contrast_pref === 'forced',
        },
        {
          path: 'standard.css',
          filter: (token) => token.$condition?.contrast_pref !== 'forced',
        },
      ],
    }),
  ],
})
```

This is useful when you want to load stylesheets with the `media` attribute.

```html
<link href="standard.css" rel="stylesheet" />
<link
  href="forced-contrast.css"
  rel="stylesheet"
  media="@media (forced-colors: active)"
/>
```

### PostCSS Integration

The CSS plugin generates theme file that contains CSS custom properties for all the design tokens. This may become an issue if you intend to use only a small subset of them. Our PostCSS plugin scans your source CSS files for CSS custom properties and component class names and generate styles only if the corresponding design tokens are defined.

The PostCSS plugin also generates [custom media](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-custom-media) and [custom selectors](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-custom-selectors) from condition and variant design tokens.

Note that our plugin does not scan HTML/JS files and thus, cannot pick up CSS custom properties from inline styles. You need to pass those to the integration plugin's `safelist` option to ensure the relevant CSS rules are generated.

To get started, add the plugin to PostCSS config:

```json
{
  "plugins": {
    "theminglayer/postcss": {}
  }
}
```

`theminglayer.config.js`

```ts
import { defineConfig } from 'theminglayer'
import { postcssIntegrationPlugin } from 'theminglayer/plugins'

export default defineConfig({
  sources: 'design-tokens.json',
  plugins: [
    postcssIntegrationPlugin({
      prefix: 'tl-',
      containerSelector: ':root',
      keepAliases: false,
      safelist: [],
    }),
  ],
})
```

Run the CLI build command:

```bash
npx theminglayer build -w
```

Add `@theminglayer` directive and write some CSS.

```css
@theminglayer;

h1 {
  color: var(--tl-text-color-primary);
}

:--tl-color-scheme-light h1 {
  /* ... */
}

@media (--tl-contrast-pref-forced) {
  h1 {
    /* ... */
  }
}
```

Output:

```css
/* prettified and annotated */
:root {
  /* from safelist */
  --tl-border-color-primary: #999;
}

/* referenced by h1 */
:root[data-color-scheme='light'] {
  --tl-text-color-primary: #000;
}

/* referenced by h1 */
:root[data-color-scheme='dark'] {
  --tl-text-color-primary: #fff;
}

h1 {
  color: var(--tl-text-color-primary);
}

/* custom selector */
[data-color-scheme='light'] h1 {
  /* ... */
}

/* custom media */
@media (forced-colors: active) {
  h1 {
    /* ... */
  }
}
```

We are actively exploring an option to convert CSS custom properties into values whenever possible. This reduces the number of CSS custom properties, thereby improving performance.

### Usage with Tailwind

Configure [PostCSS integration](#postcss-integration).

Add the Tailwind preset plugin to `theminglayer.config.js`:

```ts
import { defineConfig } from 'theminglayer'
import {
  postcssIntegrationPlugin,
  tailwindPresetPlugin,
} from 'theminglayer/plugins'

export default defineConfig({
  sources: 'design-tokens.json',
  outDir: 'dist-tokens',
  plugins: [
    postcssIntegrationPlugin({
      prefix: 'tl-',
      containerSelector: ':root',
      keepAliases: false,
      safelist: [],
    }),
    tailwindPresetPlugin({
      prefix: 'tl-',
      containerSelector: ':root',
      files: [
        {
          path: 'tailwindPreset.js',
          filter: (token) => true,
          format: 'esm', // or `cjs`
          keepAliases: false,
        },
      ],
    }),
  ],
})
```

Running the CLI build command will generate:

```ts
// prettified
import plugin from 'tailwindcss/plugin'

export const preset = {
  prefix: 'tl-',
  theme: {
    colors: { black: '#000', white: '#fff', gray: '#999' },
    borderColor: { primary: '#999' },
    textColor: { primary: 'var(--tl-text-color-primary)' },
  },
  plugins: [
    plugin(({ _addBase, _addComponents, addVariant, _theme, _options }) => {
      ;[
        ['color-scheme-light', "[data-color-scheme='light'] &"],
        ['color-scheme-dark', "[data-color-scheme='dark'] &"],
        ['contrast-pref-less', '@media (prefers-contrast: less)'],
        [
          'contrast-pref-more',
          '@media (prefers-contrast: more) and (forced-colors: none)',
        ],
        ['contrast-pref-forced', '@media (forced-colors: active)'],
      ].forEach((variant) => {
        addVariant(...variant)
      })
    }),
  ],
}
```

Add the generated preset to Tailwind config:

```ts
import { preset } from './dist-tokens/tailwindPreset.js'

export default {
  // ...
  presets: [preset],
}
```

Add `@theminglayer` directive to TailwindCSS's `@layer base`.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  @theminglayer;
}
```

### Custom Plugin

```ts
import { type PluginCreator } from 'theminglayer'

type PluginOptions = {
  // ...
}

export const plugin: PluginCreator<PluginOptions> = (options = {}) => {
  return {
    name: 'namespace/plugin-name',
    async build({ collection, addOutputFile }) {
      // plugin code
      const content = ''

      addOutputFile({
        filePath: 'filepath.json',
        content,
      })
    },
  }
}
```

- `collection`

  - `collection.tokenObject` merged object from token source files
  - `collection.tokens` flattened list of tokens
    <br />

    ```ts
    type Token = {
      $value: unknown
      $type: TokenType
      $category: string
      $condition?: Record<string, string>
      $variant?: Record<string, string | string[]>
      $extensions: {
        keys: string[]
        component: string | null
        conditionTokens: Token[]
        variantTokens: Token[]
      }
    }

    type TokenType =
      | 'color'
      | 'cubic_bezier'
      | 'dimension'
      | 'duration'
      | 'font_family'
      | 'font_style'
      | 'font_weight'
      | 'number'
      | 'border'
      | 'shadow'
      | 'stroke_style'
      | 'transition'
      | 'typography'
      | 'condition'
      | 'font_variant'
      | 'leading'
      | 'tracking'
      | 'transition_property'
      | 'variant'
      | 'outline'
      | 'drop_shadow'
    ```

- `addOutputFile` for writing generated code output to the file system

## Share Your Thoughts ❤️

As the project is still in its infancy, your feedback and suggestions are very much appreciated! Create an issue/discussion, or shoot us an email at phuoc317049@gmail.com.
