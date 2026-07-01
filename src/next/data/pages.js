import {db, isActiveRecord, makeCreateMetadata} from '../../db/db.ts'

function slugifyPageTitle(value) {
  const base = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/['"`]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || 'page'
}

async function buildUniquePageSlug(title) {
  const base = slugifyPageTitle(title)
  let slug = base
  let suffix = 2

  for (;;) {
    const existing = await db.pages.where('slug').equals(slug).first()
    if (!existing) return slug
    slug = `${base}-${suffix}`
    suffix++
  }
}

export async function loadPages() {
  return db.pages
    .orderBy('sort_order')
    .filter(isActiveRecord)
    .toArray()
}

export async function loadPageBySyncId(syncId) {
  return db.pages.where('sync_id').equals(syncId).first()
}

export async function createPageData(payload = {}) {
  const now = Date.now()
  const title = payload.title?.trim?.() || 'Page'
  const slug = payload.slug?.trim?.() || await buildUniquePageSlug(title)

  return db.transaction('rw', db.pages, async () => {
    const activePages = await db.pages.filter(isActiveRecord).toArray()
    const shouldBeHome = payload.is_home === 1 || activePages.length === 0

    if (shouldBeHome) {
      const currentHomes = activePages.filter((page) => page.is_home === 1)
      await Promise.all(currentHomes.map((page) =>
        db.pages.update(page.id, {is_home: 0, updated_at: now})
      ))
    }

    const id = await db.pages.add({
      slug,
      title,
      nav_group: payload.nav_group ?? 'main',
      icon: payload.icon ?? null,
      is_home: shouldBeHome ? 1 : 0,
      sort_order: activePages.length,
      config_json: payload.config_json ?? JSON.stringify({modulesPerRow: 2, maxWidth: null}),
      ...makeCreateMetadata(now),
    })

    return db.pages.get(id)
  })
}

export async function savePageData(id, updates) {
  await db.transaction('rw', db.pages, async () => {
    if (updates?.is_home === 1) {
      const otherHomes = await db.pages.where('is_home').equals(1).toArray()
      await Promise.all(otherHomes
        .filter((page) => page.id !== id)
        .map((page) => db.pages.update(page.id, {is_home: 0, updated_at: Date.now()})))
    }

    await db.pages.update(id, {...updates, updated_at: Date.now()})
  })
}

export async function softDeletePage(id) {
  await db.pages.update(id, {deleted_at: Date.now(), updated_at: Date.now()})
}

export function getHashPageSlug() {
  return new URLSearchParams(location.hash.slice(1)).get('pages') || null
}

export function resolveActivePage(pages, pageSlug) {
  if (!pages.length) return null

  if (pageSlug) {
    const bySlug = pages.find((page) => page.slug === pageSlug)
    if (bySlug) return bySlug
  }

  const home = pages.find((page) => page.is_home === 1)
  return home || pages[0]
}
