import type { BackgroundId } from '../types/story'

/**
 * Per-world reader backgrounds.
 *
 * Drop an image into src/assets/worlds/ named after the world id, for example
 * hongkong_circle.jpg or apocalypse.png, and it is picked up automatically:
 * the glob below is resolved at build time, so no code change is needed. Any
 * world without a file keeps the default artwork.
 *
 * Accepted names are exactly the world ids:
 *   modern_city, entertainment, hongkong_circle, campus, esports, overseas,
 *   historical_court, republican_era, fantasy, apocalypse
 *
 * Accepted extensions: jpg, jpeg, png, webp, avif.
 */
const files = import.meta.glob<string>(
  '../assets/worlds/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, query: '?url', import: 'default' },
)

const byWorld = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
  const name = path
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '')
  if (name) byWorld.set(name, url)
}

export const defaultReaderBackground = '/figma/6-7-img.png'

export function readerBackground(world?: BackgroundId) {
  return (world && byWorld.get(world)) || defaultReaderBackground
}

/**
 * Note: import.meta.glob is resolved by Vite, so this module cannot be loaded
 * by the node test runner. Its correctness is covered by the build and by the
 * browser test rather than by a unit test.
 */
