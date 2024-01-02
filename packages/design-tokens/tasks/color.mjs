import fsp from 'node:fs/promises'
import * as radixColors from '@radix-ui/colors'
import tailwindColorsPkg from 'tailwindcss/colors.js'

const { colors: tailwindColors } = tailwindColorsPkg

main()

async function main() {
  await convertRadixColorsToTokens()
}

async function convertTailwindColorsToTokens() {
  const scales = {}

  for (const [hue, scale] of Object.entries(tailwindColors.default)) {
    if (Object.getOwnPropertyDescriptor(tailwindColors.default, hue).get)
      continue

    scales[hue] = scale
  }
  delete scales.inherit
  delete scales.current
  delete scales.transparent

  const output = {}

  for (const [hue, scale] of Object.entries(scales)) {
    if (typeof scale === 'string') {
      output[hue] = { $value: scale }
      continue
    }

    output[hue] = {}

    for (const [step, $value] of Object.entries(scale)) {
      output[hue][step] = { $value }
    }
  }

  await fsp.writeFile(
    'tailwind-color.json5',
    JSON.stringify({ color: output }),
    'utf8'
  )
}

async function convertRadixColorsToTokens() {
  const picked = new Set([
    'black_alpha',
    'white_alpha',
    'amber',
    'amber_alpha',
    'amber_dark',
    'amber_dark_alpha',
    'blue',
    'blue_alpha',
    'blue_dark',
    'blue_dark_alpha',
    'crimson',
    'crimson_alpha',
    'crimson_dark',
    'crimson_dark_alpha',
    'gray',
    'gray_alpha',
    'gray_dark',
    'gray_dark_alpha',
    'plum',
    'plum_alpha',
    'plum_dark',
    'plum_dark_alpha',
    'teal',
    'teal_alpha',
    'teal_dark',
    'teal_dark_alpha',
  ])
  const scales = { ...radixColors.default }

  const output = {}

  for (const [hue, scale] of Object.entries(scales)) {
    const hueInSnakeCase = camelToSnakeCase(
      hue.replace('P3', '_p3').replace(/A$/, '_alpha')
    )

    if (picked.has(hueInSnakeCase)) {
      output[hueInSnakeCase] = {}

      for (const [shade, $value] of Object.entries(scale)) {
        const step = shade.replace(
          hue.replace('P3', '').replace('Dark', ''),
          ''
        )
        output[hueInSnakeCase][step] = { $value }
      }
    }
  }

  await fsp.writeFile(
    'radix-color.json5',
    JSON.stringify({ color: output }),
    'utf8'
  )
}

function camelToSnakeCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase()
}
