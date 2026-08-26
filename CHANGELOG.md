# Changelog

All notable changes to Speedtab will be documented in this file.

## [1.5.6]

### Added
- Added a dedicated ToDo module with priorities, optional color indicators, notes, due date/time support, compact task metadata, tile view, and shared module layout and quick-setting behavior.
- Added a shared App Clock with second, minute, hour, and day subscriptions; timed task updates and the Clock widget now use its central scheduler instead of separate loops.
- Added compact JSON collection import/export for visual bookmarks, notes, and ToDo tabs.
- Added per-feed-tab auto-refresh while the tab is open, with configurable intervals.
- Added Document Picture-in-Picture support for floating notes and Feed modules, including delegated interactions, async content syncing, and preserved Feed scroll position.

### Changed
- Refined Feed rendering and focused-view behavior during automatic refreshes.
- Refined Customize navigation and module tab forms, including cleaner identity and collection-import sections.

### Fixed
- Fixed ToDo due-state labels and colors so open, completed-on-time, completed-late, and overdue tasks are distinguishable.
- Fixed Feed auto-refresh from closing the focused reader view.
- Fixed PiP content updates for fetched Feed items, source filters, and URL-backed note tabs.


## [1.5.5]

### Changed
- Optimized Chrome Web Store titles (`extName`) and descriptions (`extDescription`) across all 9 supported languages (`de`, `en`, `es`, `fr`, `hi`, `nl`, `ru`, `tr`, `zh_CN`) in `_locales/*/messages.json` with targeted keywords for improved search visibility.

## [1.5.4]

### Added
- Added full French (`fr`) and Spanish (`es`) UI translations via `chrome.i18n` and the internal application locale system.
- Added localized initial example workspaces (`exampleWorkspaceDefinition`) for French, Spanish, and Russian.
- Added French and Spanish store package metadata (`_locales/fr/messages.json` & `_locales/es/messages.json`).

### Fixed
- Fixed character set encoding issues (ISO-8859-1 / Windows-1252) when fetching non-UTF-8 RSS feeds and URL metadata in the service worker.

## [1.5.3]

### Added
- Added full Dutch (`nl`), Simplified Chinese (`zh_CN`), and Russian (`ru`) UI translations via `chrome.i18n` and the internal application locale system.
- Added localized initial example workspaces (`exampleWorkspaceDefinition`) for Dutch, Simplified Chinese, and Russian.
- Added Dutch store package metadata (`_locales/nl/messages.json`).

### Changed
- Consolidated CJK locale fallback handling to standard `zh_CN` for Simplified Chinese distributions.

## [1.5.2]

### Changed
- Dropped the `identity.email` permission and removed the hidden connected-account email hint in Google Drive sync settings.
- Wrapped Clock widget analog hands in a pivot group so smooth-motion rotation is painted consistently across GPU paths.

### Fixed
- Fixed Clock widget "Clock Display" not persisting when switched from analog to digital; the normalized setting now accepts both display modes instead of falling back to the default.
- Fixed the Sorter so Speed Dial module contents can be reordered like Visual Bookmarks; the content table and record mapper now recognise the `speed-dial` module type.
- Fixed the Sorter Speed Dial card border colour and module-type label, and routed the type label through the shared `getModuleTypeMessageKey` helper so it resolves against the existing `app.moduleTypes.speedDial` translations.

## [1.5.1]

### Added
- Added a dedicated Speed Dial module with an invisible full-width surface, centered 16:9 tiles, optional tabs, configurable tile height and vertical alignment, inline add-tile support, and an optional full-page-height layout.
- Added dedicated Speed Dial image assets, custom image padding, and favicon-color-based tile visuals without additional external image services.
- Added per-page backgrounds by reusing the App Shell background editor, including CSS colors and gradients, uploaded images, archive/asset removal, and a fixed smooth transition when switching pages.
- Added module insertion placement when creating modules, an App Shell border-radius control, and an optional setting to reopen the last active page.

### Changed
- Expanded Customize navigation to list App Shell, all Pages, and the current page's Modules while keeping the selected Page editor open during page switches.
- Added a clear inactive-page hint to an open Page editor and kept background controls scoped to the page being edited.
- Added direct sibling up/down controls to Flying Config and refined shared module quick-setting behavior for bookmark-based module types.

### Fixed
- Fixed module-tab deletion so the first remaining tab becomes active instead of leaving the module in an empty state.
- Fixed removable bookmark tile colors and preserved explicit user color choices during favicon-based color detection.
- Fixed Speed Dial add-tile visibility, image padding persistence, asset references, tile sizing, vertical alignment, and full-height behavior.
- Fixed background list deletion so App Shell and Page editors retain their own selection actions after refreshing.

## [1.5.0]

### Added
- Added per-module Content Gap controls under Customize → Layout, inheriting the App Shell default when unset.
- Added bookmark tile color controls and favicon-based color detection, scoped to Big Tiles mode.
- Added the Flying Config foundation for editing nested HTML-note tab content.

### Fixed
- Fixed bookmark color state synchronization, Coloris resets, and light-theme contrast across notes, Flying Config, and feed actions.

## [1.4.4]

### Added
- Added nullable per-bookmark text and background colors, with Coloris controls and favicon-based color detection for visual bookmarks.
- Added a dedicated color-detection action in the visual-bookmark editor and support for transparent color values.
- Added a real pending-count marker for Quicknote context-menu captures, so repeated `Append to Quicknote` actions now accumulate visibly in the header instead of behaving like a one-shot flag.
- Added stronger empty-state theme controls with direct dark, light, and Speedtab-background toggles for first-run workspace setup.
- Added live widget-rail width bypass support, allowing the rail to ignore the shared page max-width boundary when configured.
- UI polish

### Changed
- Updated visual-bookmark tile sizing and color application for the “Show title below thumbnail” layout while keeping title strips neutral.
- Refined workspace background bootstrapping so theme and background selection are applied earlier and more predictably across the main dashboard and auxiliary pages.
- Refined weather-widget defaults, including slightly darker default text colors, lighter visual weight for location text, and better consistency with the rest of the rail styling.
- Refined standalone utility pages (`sorter.html` and `import-export.html`) so shared base styles, theme behavior, and light-mode readability stay aligned with the main app shell.

### Fixed
- Fixed bookmark color state synchronization across sidebar actions, Coloris resets, favicon testing, and bookmark saves.
- Fixed light-theme contrast for note-window actions, Flying Config controls, editor fields, and feed-item actions.
- Fixed background flicker and startup instability by simplifying the workspace-background load path and removing late wallpaper flashes during extension initialization.
- Fixed cascading cleanup behavior for page, module-tab, and orphan maintenance flows so deletions no longer leave broken descendants or undeletable orphaned rows behind.
- Fixed orphan-maintenance actions such as `Delete all Shown`, plus related orphan-page follow-up behavior, so cleanup tools react reliably without leaving stale UI state behind.
- Fixed favicon resolution regressions by restoring the proven hostname/subdomain lookup path, including safer handling for local installs and previously working Google subdomains.
- Fixed module empty-state presentation after deleting the final tab so empty modules no longer collapse into partially transparent, broken-looking shells.
- Fixed light-mode contrast regressions in `sorter.html`, `import-export.html`, widget surfaces, and related header/reload actions.
- Fixed Speedtab background toggles so adding or removing the wallpaper updates live instead of waiting for a page reload.
- Fixed weather-widget color defaults and supporting theme tokens so default rail colors no longer render as harsh pure white.
- Fixed Quicknote marker behavior so repeated context-menu appends now increase the visible pending value instead of stopping after the first notification.

## [1.4.3]

### Added
- Added optional Google Drive remote sync in `import-export.html`, including remote status checks, manual verification flows, configurable auto-push intervals, and a subtle widget-rail sync indicator.
- Added remote reset controls for Google Drive app-data workspaces inside `import-export.html`, separated from normal remote-provider setup actions.
- Added per-note default floating-window geometry through note metadata, allowing seeded or exported notes to define first-open width/height without hardcoded note-specific logic.
- Added note-editor window tools for resetting stored floating-note size/position back to the note's default open geometry.
- Added a safe attribute-driven style API for HTML notes and other trusted content surfaces via `data-st-*` utilities, providing controlled layout and visual overrides without re-enabling raw inline `style` attributes.
- Added an analog clock mode for the widget rail, including smooth-motion hand animation, configurable date/time formatting, localized token helpers, and widget-configuration shortcuts from both clock and weather modals.
- Added richer clock date-format helpers, including normalized token names, multiline `[br]` support, and inline divider `[hr]` support.
- Added local note-tab authoring improvements for HTML notes, including direct `Tabber` scaffolding and better default geometry support for seeded example notes such as `Tabby Tabs`.

### Changed
- Refined remote configuration and remote-sync UI flows for Google Drive, including provider-specific setup, account display, disconnect handling, and clearer sync-state messaging.
- Refined reset and destructive-action UX in `import-export.html` so provider setup stays clean while remote wipe actions live under reset options.
- Refined open-note editor tooling so window actions sit in a compact local menu instead of using the global teleported dropdown behavior.
- Refined the widget rail with a more capable clock widget, stronger default analog styling, and direct settings shortcuts from modal surfaces.
- Refined example-workspace widget defaults so the starter rail ships with the analog clock flow enabled and better note metadata coverage.

### Fixed
- Fixed remote auto-sync lineage recovery so existing synced workspaces are not misclassified as first-time devices when local remote bookkeeping is incomplete.
- Fixed widget-rail remote sync indicator timing so overlapping check/push phases no longer flicker, disappear early, or downgrade each other mid-sync.
- Fixed note-module refresh reapplication so module-level UI config such as `data-color-accent` survives note save/edit updates.
- Fixed remote pull restore behavior so pulling from WebDAV or Google Drive replaces the authored local workspace cleanly instead of colliding with existing page slugs after reinstall or reseeding.
- Fixed contradictory remote-sync states in `import-export.html` by clearing stale preview state after `Check Status` and by disabling pull/download guidance when the remote workspace is actually missing.
- Fixed example-workspace note seeding so note metadata is preserved end-to-end, allowing notes like `Tabby Tabs` to use metadata-defined default open sizes.
- Fixed note-window metadata sizing so explicit default width/height no longer get immediately overridden by HTML auto-fit on first open.
- Fixed clock-widget rerender noise so the widget shell no longer thrashes attributes or DOM every second.
- Fixed analog clock smooth-motion rendering so CSS-driven hands no longer double-rotate or drift to incorrect times.
- Fixed weather forecast modal parity by exposing the same configuration shortcut used by the clock-tools modal.

## [1.4.2]

### Added
- Added a configurable clock widget for the rail, including localized date/time formats, token insertion helpers, per-part colors, font sizing, alignment, and two-row display support.
- Added a richer weather flow with localized forecast modal access directly from the rail temperature readout.
- Added tabbable HTML-note scaffolding from the inline note editor, making it easier to author nested YaiTabs notes directly through the UI.
- Added inline tab/content management actions to `sorter.html`, including row-level title editing, keyboard save on `Enter`, and confirmed cascading deletes for tab contents.

### Changed
- Refined bookmark CRUD styling and behavior in the sidepanel, including favicon-picker tray presentation, test-button loading feedback, and stricter crop-before-save handling.
- Improved feed-reader rendering to patch live DOM more conservatively, reducing refresh churn and large-list instability during open-item interaction.
- Expanded widget and appearance configuration with cleaner grouping, better defaults, earlier color-picker initialization, and more predictable live updates.
- Improved note, bookmark, and header-shell polish across desktop and mobile layouts with targeted UI tweaks instead of broader structural changes.

### Fixed
- Fixed bookmark form CSS scoping so visual-bookmark sidepanel styling is applied reliably outside bookmark module content.
- Fixed multiple feed-reader regressions around expanded mode, large-item-list interaction, refresh highlighting, source favicons, and media rendering.
- Fixed widget-rail alignment, top-rail layout behavior, and width handling against the shared page-width token.
- Fixed bookmark test-state, preview crop state, and favicon-grid interactions in the visual-bookmark editor.
- Fixed note-tab editing edge cases including focus loss, default-tab behavior, preview interaction, and live HTML editing flows.
- Fixed several shell-level UI regressions, including search/header actions, empty-state affordances, module dropdown behavior, and mobile header layout issues.

## [1.4.1]

### Added
- Added Turkish and Hindi UI translations, plus localized example-workspace support and empty-state example language selection.
- Added module quick settings directly inside module action dropdowns for fast toggles such as quicklinks, force-favicon, inline add tile visibility, hide-header, and column span.
- Added bookmark tile option to render the title below full-size visual bookmarks.
- Added feed-item media rendering for embedded feed images and improved YouTube-specific feed extras, including thumbnail-first previews and expandable descriptions.
- Added asset-browser favicon background repair controls for fixing unreadable transparent favicons in-place.

### Changed
- Refined module dropdown quick settings into a flatter, faster control surface with inline column-span selection instead of deeper nested flyouts.
- Updated favicon normalization so dark transparent favicons can be stored with a white backing, improving visibility on dark UI surfaces.
- Improved feed reader patching to mutate live DOM surgically instead of replacing larger UI regions during refresh cycles.
- Adjusted example workspace seeding, translations, and onboarding flows to better support localized starter content.

### Fixed
- Fixed multiple feed-reader flicker and refresh regressions, including unnecessary toolbar/footer replacement, image flicker on open items, and focus-mode control desync.
- Fixed focused feed-reader close-button behavior after refresh-state patching.
- Fixed bookmark media rendering regressions around force-favicon mode, thumbnail fallback, and visible-only asset loading.
- Fixed feed-source favicon initialization so source icons load correctly on initial render.
- Fixed HTML note preview syncing during inline editing and improved note window sizing, persistence, and mobile behavior.
- Fixed empty-state example workspace language switching, locale fallback/merging, and document `lang` synchronization.
- Fixed asset-loading duplication and page/module hydration glitches that caused avoidable requests or visual jumps.
- Fixed search, dropdown, and sidepanel close interactions after later event-handler refinements.
- Fixed weather-widget localization details, widget configuration flow, and expanded forecast modal behavior.
- Fixed various mobile-shell, module-header, and feed-focus UI regressions introduced by the 1.4.0 engine migration.

## [1.4.0]

### Changed
- Rebuilt the extension on a new YaiJS/YEH-based architecture, removing the previous framework-heavy runtime in favor of delegated event handling and a lighter startup path.
- Reduced extension weight while restoring and extending the full Speedtab feature set, improving startup performance and lowering runtime overhead.
- Ported the main Speedtab workspace features onto the new engine, including bookmarks, notes, feeds, widgets, assets, sorting, data exchange, and onboarding flows.

### Added
- Added support for deeply nested interactive tab structures inside HTML notes, using the shared YaiTabs event model without per-component listener registration.
- Added full WAI-ARIA tab semantics and keyboard navigation support across the dashboard shell and nested tab interfaces.
- Added persistent floating note window lifecycle storage, preserving open state, position, size, and z-order across reloads and browser restarts.
- Added a weather forecast modal opened from the compact rail temperature, using cached Open-Meteo data and localized forecast labels.
- Added delegated swipe navigation across page and module tab interfaces with improved drag cancellation and stuck-state recovery.
- Added a dedicated workspace sorter view (`sorter.html`) for rearranging pages, modules, tabs, and content outside the live dashboard shell.
- Added a dedicated data exchange view (`import-export.html`) for local backup, restore, cleanup, remote sync, and integrity workflows.
- Added a richer Quick Start example workspace with localized onboarding notes and example module content.

### Fixed
- Fixed multiple nested tab, swipe, focus, and event-bubbling regressions introduced during the engine migration.
- Fixed bookmark and feed asset-loading behavior so only required visible media is loaded while preserving correct thumbnail/favicon fallback behavior.
- Fixed feed focus mode rendering, layout isolation, and expanded-reader behavior inside the main app shell.
- Fixed weather widget localization, forecast fetching, and compact rail interactions.
- Fixed floating note sizing, persistence, and resize behavior, including incorrect minimum-height reapplication from persisted local state.
- Fixed module and page customization regressions across shell appearance, module behavior, and widget configuration flows.

## [1.3.1]

- Added Chrome-native extension localization packaging with `/_locales/en/messages.json` and `/_locales/de/messages.json`, plus manifest `default_locale`, so Chrome and the Chrome Web Store can detect supported languages automatically.
- Moved extension-level manifest and service-worker strings onto `chrome.i18n`.
- Cleaned up duplicated background/runtime locale strings from `src/locales/en.ts` and `src/locales/de.ts`, documenting the final split between `chrome.i18n` and `vue-i18n`.
- Fixed the Copy URL modal so the generated workspace URL now follows live module-tab state changes, and adjusted the URL field for better readability with long hash-based links.

## [1.3.0]

### Added
- Full application internationalization foundation with `vue-i18n`, including English and German locale support, persisted UI language selection, browser-language fallback on first run, and onboarding language selection for empty workspaces.
- Custom background property input in Settings for valid CSS background values such as gradients, colors, and other browser-supported background declarations, with live validation and preview.
- Background Archive for saving and reusing custom background values from a dedicated shelf in Settings.
- Persistent local-only `Quicknote` scratchpad, opened from the header helper toggle and stored in `chrome.storage.local` outside workspace export/import.
- Background archive entries are now included in the standard settings export/import flow via `BackupManifestV2`.
- The UI was refined across the app, including layout and interaction polish around the new internationalization and appearance controls.

## [1.2.0]

### Added
- Remote sync through a dedicated `Data Exchange` flow, including manual push, pull, verify, compare, and repair actions.
- WebDAV remote provider support for syncing Speedtab workspaces across Chromium browsers and devices.
- Local export and remote sync status panels that clearly separate portable export state from remote freshness.
- Weather widget rail with top or bottom placement, manual refresh, location search, unit selection, and compact live conditions.
- Widget configuration mode in Settings for managing optional rail-based widgets without mixing them into normal page settings.
- Move or copy tab content between collections, including destination selection across page, module, and tab.
- Selectable transfer list for tab-content moves and copies, with per-item checkboxes plus `Select All` and `Clear All`.
- Custom bookmark favicons with built-in test, asset picking, upload, and clear flows.
- Per-module width selection with `Auto`, multi-column spans, and full-width layout support inside the page grid.
- Per-module minimum height control for stabilizing module rows and shaping denser dashboard layouts.
- Quick Start example workspace with a styled starter layout, widget showcase, encrypted note demo, and in-app Help notes.

## [1.1.0]

### Added
- Native context menu capture flow for sending selected text or the current page into the local Speedtab inbox.
- Asset browser modal with grouped asset views, per-asset details, delete actions, and favicon refresh support.
- Global search with a debounced header search box, absolute results layer, locate flow, and in-page highlight cues.
- Cleanup preview modal with grouped orphan candidates, optional unused-asset cleanup, preview tiles, and stale favicon refresh.
- HTML note image support with asset-backed placeholder tokens and rendered inline images.
- Floating note windows that can stay open across pages, with drag, resize, focus stacking, and per-note open-state locking in the module preview grid.
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
