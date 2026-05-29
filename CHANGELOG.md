# Changelog

All notable changes to Speedtab will be documented in this file.

## [1.1.0]

### Added
- Native context menu capture flow for sending selected text or the current page into the local Speedtab inbox.
- Asset browser modal with grouped asset views, per-asset details, delete actions, and favicon refresh support.
- Global search with a debounced header search box, absolute results layer, locate flow, and in-page highlight cues.
- Cleanup preview modal with grouped orphan candidates, optional unused-asset cleanup, preview tiles, and stale favicon refresh.
- HTML note image support with asset-backed placeholder tokens and rendered inline images.
- Bookmark module option to disable hover action buttons.
- Bookmark quicklinks mode for compact favicon-first bookmark grids.
- Feed module `Expand` width selector with multiple reading widths and stacked compact layout for narrow widths.
- Feed module local search input in the header for filtering loaded items in the active feed tab.
- Feed source lookup flow for discovering RSS/Atom feeds from normal site URLs.
- Feed search URL template in global settings.
- Built-in modal maximize/restore support.
- Dedicated favicon cache tests.

### Changed
- Export/import now remaps bookmark preview assets, bookmark favicon assets, and HTML note image tokens correctly across browsers.
- Backup JSON export is now minified instead of pretty-printed.
- Favicon handling now uses a shared cached asset layer with hostname tracking and in-place refresh behavior.
- Bookmark saves now attach a real favicon asset reference even when a custom preview image is present.
- Bookmark preview image quality was raised further and now uses WebP quality `0.98`.
- Search scope is now intentionally limited to bookmarks, notes, feed sources, and archived feed content.
- Feed modules now support width-based focused reading instead of the old maximize toggle.
- Feed reader layout switches to a single-column stacked mode at `320px` and `480px` expanded widths.
- Module action trigger styling was simplified to a lighter tab-like button with a plain `+`.
- Bookmark module defaults now favor denser layouts, including a default grid value of `10`.
- Theme token system now also drives feed surfaces, shell colors, and light-theme-compatible UI states.
- Feed auto-refresh configuration now lives at feed-tab level instead of module level, with backward-compatible fallback from old module config.
- Feed content and note content now support global content-scale settings from appearance preferences.

### Fixed
- Bookmark image assets exported from one browser now import and reconnect correctly in another browser.
- Favicon checksum collisions no longer fail when multiple hosts share the same remote favicon blob.
- Oversized cached favicons are normalized down to a maximum of `48x48`.
- Favicon resolution now falls back from unsupported subdomains to the parent domain when available.
- Favicon detail previews in the asset browser no longer stretch awkwardly.
- Feed item save/read UI regressions and loading-state visibility issues.
- Page icon picker layout and bookmark module layout regressions from recent UI changes.
- Quicklinks accidental action-button clicks were reduced.
- Settings modal viewport overflow when a background image preview is visible.
- Asset cleanup now preserves referenced image-based note content and updates asset references more safely.
- Search results now stay readable on light themes, close on outside click, and wrap long encrypted-note payloads safely.
- YouTube feed items now use a thumbnail-first preview instead of a broken iframe embed inside the extension page.
- Feed lists and source sidebars no longer hide their scrollbars.
- Feed sidebar sizing was adjusted for denser real-world subscriptions, and `Show New` / `Unread` feed filters now behave like stable temporary inbox views.
- Feed search now auto-focuses when opened.
- Note content scaling now also applies correctly to teleported note viewer modals.

### Tests
- Added regression coverage for:
  - bookmark favicon asset remapping on import
  - bookmark module `config_json` round-tripping
  - favicon cache reuse across shared blobs
  - stale favicon refresh behavior
- Added focused feed-view regression coverage for:
  - local feed search filtering
  - unread-filter reset on collection switch
- Full suite currently passes via `npm test`, with `type-check` and `build` also green.
