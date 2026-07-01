# Running Tests

Tests use [Vitest](https://vitest.dev/) with a jsdom environment and
[fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) for IndexedDB
isolation (no real browser needed).

## Commands

```bash
# Run all tests once
npm test

# Run all tests in watch mode (re-runs on save)
npm run test:watch

# Run only the src/next test suite
npx vitest run src/next/tests/

# Run a single test file
npx vitest run src/next/tests/pages.test.ts

# Run with verbose output (shows every test name)
npx vitest run src/next/tests/ --reporter=verbose

# Run with coverage report (output in coverage/)
npx vitest run --coverage
```

## Test files

| File | What it covers |
|------|---------------|
| `html.test.ts` | `escapeHtml`, `buildAttributes` pure utils |
| `ordered-entities.test.ts` | Shared CRUD helpers: `createOrderedEntity`, `updateEntity`, `softDeleteEntity`, `getNextSortOrder`, `loadEntityById`, `loadEntityBySyncId` |
| `pages.test.ts` | Page creation, loading, saving, soft-delete, `resolveActivePage`, `getHashPageSlug` |
| `modules.test.ts` | Module creation (with default tab/collection), loading by page, saving, soft-delete |
| `tabs.test.ts` | Tab (collection) creation, loading by module, saving, soft-delete |
| `bookmarks.test.ts` | Bookmark CRUD, loading by tab, soft-delete |
| `notes.test.ts` | Note CRUD, batch loading by IDs, loading by collection, soft-delete |
| `app-settings.test.ts` | Default merging, JSON parsing, `saveAppSetting`, `getCachedAppSettings`, background archive |
| `local-tools.test.ts` | `normalizeLocalToolsState` (pure), load/save from DB |
| `ui-config-normalize.test.ts` | `normalizeUiConfig`, `getEffectiveUiConfig`, `hasCustomUiConfig` |
| `i18n.test.ts` | Locale loading, `t()` translation, interpolation |

## Writing new tests

Each test file follows this pattern:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 1. Mock the global DB with an isolated fake-indexeddb instance
vi.mock('../../db/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  return { ...actual, db: testDb }
})

// 2. Import module under test AFTER the mock
import { myFunction } from '../data/my-module.js'

// 3. Open/close DB around each test for isolation
beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.myTable.clear()
  await testDb.close()
})
```

> **Important:** always import the module under test *after* `vi.mock(...)` so
> Vitest's hoisting picks up the mock before the module's top-level `import`
> of `db` runs.
