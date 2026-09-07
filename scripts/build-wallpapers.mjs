import {promisify} from 'node:util'
import {execFile} from 'node:child_process'
import {access, mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises'
import {constants as fsConstants} from 'node:fs'
import {basename, extname, join, relative, resolve} from 'node:path'

const execFileAsync = promisify(execFile)

const SOURCE_PATH = 'ext_dev/st/wallpaper/assets'
const TARGET_PATH = 'ext/st/wallpaper/assets'
const LIST_PATH = 'ext/st/en/wallpaper/list.html'
const COLOR_SOURCE_PATH = 'ext_dev/st/wallpaper/bg-color.json'
const COLOR_LIST_PATH = 'ext/st/en/wallpaper/bg-color.html'
const ASSETS_URL = 'https://5elementsdesign.github.io/Speedtab/ext/st/wallpaper/assets/'
const PIXABAY_URL = 'https://pixabay.com/'
const MAX_IMAGE_SIZE = 1920
const THUMBNAIL_WIDTH = 300
const WEBP_QUALITY = 82
const EXCLUDE_FILENAMES = [
  'valiphotos-road-1072823.jpg',
]
const IMAGE_EXTENSIONS = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp'])
const THUMBNAIL_SUFFIX = '.thumbnail.webp'
const EXCLUDED_STEMS = new Set(EXCLUDE_FILENAMES.map((filename) => basename(filename, extname(filename))))

const sourceDir = resolve(SOURCE_PATH)
const targetDir = resolve(TARGET_PATH)
const listFile = resolve(LIST_PATH)
const colorSourceFile = resolve(COLOR_SOURCE_PATH)
const colorListFile = resolve(COLOR_LIST_PATH)

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function listImages(directory, {includeThumbnails = false} = {}) {
  if (!await exists(directory)) return []
  const entries = await readdir(directory, {withFileTypes: true})
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
    .filter((name) => includeThumbnails || !name.endsWith(THUMBNAIL_SUFFIX))
    .sort((a, b) => a.localeCompare(b))
}

async function isNewer(source, target) {
  if (!await exists(target)) return true
  const [sourceStats, targetStats] = await Promise.all([stat(source), stat(target)])
  return sourceStats.mtimeMs > targetStats.mtimeMs
}

async function exceedsMaxImageSize(path) {
  try {
    const {stdout} = await execFileAsync('identify', ['-format', '%w %h', path])
    const [width, height] = stdout.trim().split(/\s+/).map(Number)
    return width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE
  } catch {
    return true
  }
}

async function convertImage(source, target, resize) {
  try {
    await execFileAsync('convert', [
      source,
      '-auto-orient',
      '-resize', resize,
      '-strip',
      '-quality', String(WEBP_QUALITY),
      target,
    ])
  } catch (error) {
    const message = error?.stderr?.trim() || error?.message || 'Unknown ImageMagick error'
    throw new Error(`Could not process ${relative(process.cwd(), source)}: ${message}`)
  }
}

async function processRawImages() {
  const files = await listImages(sourceDir)
  let processed = 0

  for (const filename of files) {
    const source = join(sourceDir, filename)
    const targetFilename = `${basename(filename, extname(filename))}.webp`
    const target = join(targetDir, targetFilename)
    if (!await isNewer(source, target) && !await exceedsMaxImageSize(target)) continue
    await convertImage(source, target, `${MAX_IMAGE_SIZE}x${MAX_IMAGE_SIZE}>`)
    processed += 1
  }

  return processed
}

async function normalizePublishedImages() {
  const files = await listImages(targetDir)
  let processed = 0

  for (const filename of files) {
    const source = join(targetDir, filename)
    if (!await exceedsMaxImageSize(source)) continue

    const normalized = `${source}.normalized.webp`
    await convertImage(source, normalized, `${MAX_IMAGE_SIZE}x${MAX_IMAGE_SIZE}>`)
    await rename(normalized, source)
    processed += 1
  }

  return processed
}

async function ensureThumbnails() {
  const files = await listImages(targetDir)
  let created = 0

  for (const filename of files) {
    const source = join(targetDir, filename)
    const thumbnail = join(targetDir, `${basename(filename, '.webp')}${THUMBNAIL_SUFFIX}`)
    if (!await isNewer(source, thumbnail)) continue
    await convertImage(source, thumbnail, `${THUMBNAIL_WIDTH}x`)
    created += 1
  }

  return {count: files.length, created}
}

function formatFileSize(bytes) {
  const kilobytes = bytes / 1000
  if (kilobytes < 1000) return `${Math.max(1, Math.round(kilobytes))} KB`
  return `${(kilobytes / 1000).toFixed(1)} MB`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function cssBackgroundValue(preset) {
  const color = preset['bg-color'].trim()
  const image = preset['bg-image']?.trim()
  const size = preset['bg-size']?.trim()
  if (!image) return color
  return `${color} ${image}${size ? ` 0 0 / ${size}` : ''}`
}

function renderAttribute(name, value) {
  return value ? ` ${name}="${escapeHtml(value)}"` : ''
}

function renderWallpaperItem(filename, bytes) {
  const stem = basename(filename, '.webp')
  const thumbnail = `${stem}${THUMBNAIL_SUFFIX}`
  const fullUrl = `${ASSETS_URL}${encodeURIComponent(filename)}`
  const thumbnailUrl = `${ASSETS_URL}${encodeURIComponent(thumbnail)}`
  const pixabayUrl = `${PIXABAY_URL}${encodeURIComponent(stem)}`

  return `  <figure data-wp-item data-st-wallpaper-id="${fullUrl}">
    <img width="250" alt=""
      src="${thumbnailUrl}"
      data-source-url="${fullUrl}">
    <div data-wp-actions>
      <button data-click="usrCaptureImageAsWallpaper">As Wallpaper</button>
      <button
        data-wallspeed-filesize
        data-btn="ghost"
        title="Open Image"
        data-click="goToHref"
        data-href="${fullUrl}"
      >${formatFileSize(bytes)}</button>
      <button
        data-wallspeed-original
        data-click="goToHref"
        data-btn="ghost"
        title="Check it on Pixabay"
        data-href="${pixabayUrl}">
          <i data-icon="external" aria-hidden="true"></i>
        </button>
    </div>
  </figure>`
}

async function buildList() {
  const files = (await listImages(targetDir))
    .filter((filename) => !EXCLUDED_STEMS.has(basename(filename, '.webp')))
  const items = await Promise.all(files.map(async (filename) => ({
    filename,
    bytes: (await stat(join(targetDir, filename))).size,
  })))
  const html = `<section data-wallpaper-list data-st-padding="1rem">

${items.map(({filename, bytes}) => renderWallpaperItem(filename, bytes)).join('\n\n')}

  <div data-wp-item data-st-min-height="140px">
    <button data-click="usrResetWallpaper" data-btn="warning" data-st-height="100%" data-st-width="100%">Reset</button>
  </div>
</section>
`
  await writeFile(listFile, html)
  return items.length
}

async function loadColorPresets() {
  if (!await exists(colorSourceFile)) return null
  let presets
  try {
    presets = JSON.parse(await readFile(colorSourceFile, 'utf8'))
  } catch (error) {
    throw new Error(`Could not parse ${COLOR_SOURCE_PATH}: ${error.message}`)
  }
  if (!Array.isArray(presets)) throw new Error(`${COLOR_SOURCE_PATH} must contain a JSON array.`)

  return presets.map((preset, index) => {
    if (!preset || typeof preset !== 'object' || typeof preset.name !== 'string' || typeof preset['bg-color'] !== 'string') {
      throw new Error(`${COLOR_SOURCE_PATH} item ${index + 1} needs string "name" and "bg-color" values.`)
    }
    return preset
  })
}

function renderColorPreset(preset) {
  const background = cssBackgroundValue(preset)
  const previewAttributes = [
    renderAttribute('data-st-bg-size', preset['bg-size']),
    renderAttribute('data-st-bg-color', preset['bg-color']),
    renderAttribute('data-st-bg-image', preset['bg-image']),
    renderAttribute('data-st-color', preset.color),
  ].join('')
  const actionAttributes = [
    renderAttribute('data-bg-size', preset['bg-size']),
    renderAttribute('data-bg-color', preset['bg-color']),
    renderAttribute('data-bg-image', preset['bg-image']),
  ].join('')

  return `  <figure data-wp-item data-st-wallpaper-id="${escapeHtml(background)}">
    <div${previewAttributes}
      data-st-width="100%" data-st-height="140px"
      data-st-display="flex" data-st-align-items="center" data-st-justify-content="center">
      <span data-st-font-weight="500">${escapeHtml(preset.name)}</span>
    </div>
    <div data-wp-actions>
      <button
        data-click="usrCaptureCssAsBg"${actionAttributes}
        data-btn="primary">As Wallpaper</button>
    </div>
  </figure>`
}

async function buildColorList() {
  const presets = await loadColorPresets()
  if (!presets) return null
  const html = `<section data-wallpaper-list data-st-bg-color-list data-st-padding="1rem">

${presets.map(renderColorPreset).join('\n\n')}

  <div data-wp-item data-st-min-height="140px">
    <button data-click="usrResetWallpaper" data-btn="warning" data-st-height="100%" data-st-width="100%">Reset</button>
  </div>
</section>
`
  await writeFile(colorListFile, html)
  return presets.length
}

await mkdir(targetDir, {recursive: true})
const processed = await processRawImages()
const normalized = await normalizePublishedImages()
const thumbnails = await ensureThumbnails()
const listCount = await buildList()
const colorCount = await buildColorList()

console.log(`Wallpapers: ${listCount} images listed, ${colorCount ?? 0} color presets listed, ${processed + normalized} processed, ${thumbnails.created} thumbnails created (${thumbnails.count} verified).`)
