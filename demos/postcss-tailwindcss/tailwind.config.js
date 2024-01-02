import { preset } from './dist-tokens/tailwindPreset.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    'src/components/**/*.{astro,jsx,tsx,mdx}',
    'src/pages/**/*.{astro,jsx,tsx,mdx}',
  ],
  presets: [preset],
}
