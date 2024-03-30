import fsp from 'node:fs/promises'
import * as radixColors from '@radix-ui/colors'
import openPropsColors from 'open-props/src/colors'
import openPropsHslColors from 'open-props/src/colors-hsl'
import tailwindColors from 'tailwindcss/colors.js'

main()

async function main() {
  // await convertOpenPropsColorsToTokens()
  await convertRadixColorsToTokens()
  // await convertTailwindColorsToTokens()
}

async function convertOpenPropsColorsToTokens({ hsl = true } = {}) {
  const output = {}

  for (const [key, value] of Object.entries(openPropsColors)) {
    const [hue, step] = key.replace('--', '').split('-')
    output[hue] = output[hue] || {}
    output[hue][step] = { $value: value }
  }

  await fsp.writeFile(
    'open-props-color.json5',
    JSON.stringify({ color: output }),
    'utf8'
  )
}

async function convertRadixColorsToTokens({ p3 = false } = {}) {
  const picked = new Set([
    'amber',
    'amber_alpha',
    'amber_dark',
    'amber_dark_alpha',
    'black_alpha',
    'blue',
    'blue_alpha',
    'blue_dark',
    'blue_dark_alpha',
    'gray',
    'gray_alpha',
    'gray_dark',
    'gray_dark_alpha',
    'green',
    'green_alpha',
    'green_dark',
    'green_dark_alpha',
    'mauve',
    'mauve_alpha',
    'mauve_dark',
    'mauve_dark_alpha',
    'plum',
    'plum_alpha',
    'plum_dark',
    'plum_dark_alpha',
    'red',
    'red_alpha',
    'red_dark',
    'red_dark_alpha',
    'white_alpha',
  ])
  const scales = { ...radixColors.default }

  const output = {}

  // const a = {
  //   brown: {
  //     1: {
  //       $set: [
  //         { $value: '#fefdfc' },
  //         {
  //           $condition: { color_gamut: 'p3', supports_p3: true },
  //           $value: 'color(display-p3 ...)',
  //         },
  //       ],
  //     },
  //   },
  // }

  for (const [hue, scale] of Object.entries(scales)) {
    const isP3 = hue.includes('P3')

    const hueInSnakeCase = camelToSnakeCase(
      hue.replace('P3', '').replace(/A$/, '_alpha')
    )

    if (picked.has(hueInSnakeCase) || picked.size === 0) {
      output[hueInSnakeCase] = output[hueInSnakeCase] || {}

      for (const [shade, $value] of Object.entries(scale)) {
        const step = shade.replace(
          hue.replace('P3', '').replace('Dark', ''),
          ''
        )

        output[hueInSnakeCase][step] = output[hueInSnakeCase][step] || {
          $set: [],
        }

        output[hueInSnakeCase][step].$set[isP3 ? 1 : 0] = isP3
          ? { $condition: { color_gamut: 'p3', supports_p3: true }, $value }
          : { $value }
      }
    }
  }

  await fsp.writeFile(
    'radix-color.json5',
    JSON.stringify({ color: output }),
    'utf8'
  )
}

async function convertTailwindColorsToTokens() {
  const scales = {}

  for (const [hue, scale] of Object.entries(tailwindColors)) {
    if (Object.getOwnPropertyDescriptor(tailwindColors, hue).get) continue

    scales[hue] = scale
  }

  delete scales.inherit
  delete scales.current
  delete scales.transparent
  delete scales.black
  delete scales.white

  const output = {}

  for (const [hue, scale] of Object.entries(scales)) {
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

function camelToSnakeCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase()
}
