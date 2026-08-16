Speedtab: The ultra-fast, local-first New Tab workspace that doesn't track you. Built with pure Vanilla JS, zero frameworks, and a minimal memory footprint.

Speedtab replaces the default browser New Tab page with a fast, dense, local-first Speed Dial and productivity dashboard. No account. No Speedtab backend. No tracking. Optional remote sync. Just your data, your way.

Build custom startpages for different contexts, split them into modular grids, and organize your content into tabs. Combine visual bookmarks, RSS/Atom feeds, quick notes, code snippets, link lists, HTML components, and encrypted private notes in one ultra-fast, unified workspace.

Speedtab is designed for structure, speed, and complete ownership over your data:

- no account required
- no Speedtab backend service
- no cloud account required
- true local-first storage inside the browser
- portable export/import for complete data freedom

What you can do with Speedtab:

- organize bookmarks into pages, modules, and custom tabs
- enjoy a classic, high-performance Speed Dial experience tailored to your workflows
- upload local preview images and custom favicons for your bookmarks
- create text, code, link, custom HTML, and encrypted notes
- build infinite, deeply nested tab structures inside your HTML notes powered by YaiTabs
- read RSS/Atom feeds directly inside your new tab startpage
- track read/unread states and archive interesting feed items with comments
- customize the visual theme, grid layouts, and CSS backgrounds
- move your workspace between browser profiles with seamless export/import

Speedtab is fully local-first. Application data is safely stored in IndexedDB inside your browser profile. Feed fetching is handled entirely by the extension itself through its background service worker. Encrypted notes are protected client-side using AES-GCM and PBKDF2-SHA256. Your passphrases never leave your machine.

Get a real, powerful New Tab workspace instead of a generic start page or a privacy-invasive cloud dashboard.

----------------------------------------
COMPREHENSIVE SPEEDTAB FEATURE BREAKDOWN
----------------------------------------

APP SHELL & WORKSPACE ARCHITECTURE
• Viewport-filling App Shell providing customizable multi-page navigation for workspaces or context categories.
• Drag-and-drop reordering for pages, modules, collections, and individual items.
• Event-delegation core powered by YaiJS and YEH (Yai Event Hub), operating on a single shared runtime with O(1) scaling and zero virtual DOM overhead.
• Ultra-lightweight core with a responsive UI and no virtual DOM overhead.
• Full keyboard navigation and WCAG 2.1 AA accessibility support (Arrow keys, Home, End, Enter, Space).
• Global debounced header search with instant locate flow, absolute results layer, and in-page highlight cues.
• Appearance and layout controls:
  - Global default wallpaper and per-page background overrides.
  - Custom CSS background editor with live syntax validation and archive shelf for saved gradients/colors.
  - Per-module layout controls: Auto, multi-column span, and full-width grid layouts.
  - Module min-height controls and per-module content spacing/padding overrides.
  - Shell width boundaries and widget rail layout placement (top or bottom).

VISUAL BOOKMARKS MODULE
• Visual tile rendering with support for custom favicons or uploaded preview images.
• Built-in cropper tool (CropperJS) to crop local preview image uploads to a fixed tile ratio before saving.
• Asset browser and favicon manager:
  - Select from all favicons stored in IndexedDB asset tables.
  - Upload custom favicons directly.
  - Automatic detection and repair tool for low-contrast/transparent dark favicons (adds a clean background layer before saving).
• Navigation settings: toggle per-module open behavior between current tab and new background/foreground tabs.
• Layout & Tile Customization:
  - Default mode (106x60px visual preview tiles).
  - Quicklinks mode (ultra-dense 48x48px favicon-first grid).
  - Big Tiles mode (154x80px enlarged visual previews).
  - Optional title-below-tile layout mode for label-driven visual bookmark scanning.
  - Tile-level custom background colors with transparency support.

SPEED DIAL MODULE
• Dedicated full-width Speed Dial surface with a visually minimal, transparent module shell.
• Centered 16:9 tiles with adjustable height and top, center, or bottom content alignment.
• Optional tabs, inline add tile, and full-page-height mode for classic or categorized Speed Dial layouts.
• Dedicated local Speed Dial image assets with per-image padding.
• Favicon-derived tile colors create cohesive visuals without external screenshot or image services.

NOTES & INTERACTIVE NOTE ENGINE
• Five note content types:
  - HTML Notes:
    * Sanitized HTML rendering with asset-backed placeholder tokens and inline images.
    * Hosts live, fully interactive YaiTabs nested tab structures directly inside note content.
    * Attribute-Driven Style API (data-st-* attributes for width, height, margin, padding, flexbox, grid, borders, border-radius, shadows, typography, and colors) without inline style vulnerabilities.
    * Preset macros to inject layout skeletons and component templates into the editor.
  - Text Notes: Plain text editor for quick unformatted notes.
  - Links Notes: Converts raw line-by-line URLs into instant clickable link lists; non-URL text blocks render as styled quote blocks.
  - Code Notes: Monospaced code snippet storage with automatic syntax highlighting via Highlight.js.
  - Crypt Notes: Client-side encrypted private notes using AES-GCM and PBKDF2-SHA256 (310,000 iterations). Requires a passphrase for decryption; passphrases are never stored or cached.
• Note Editor Surface modes:
  - Default split-view editor with toggleable live preview for HTML notes.
  - Flying Config: Edit deeply nested HTML-note tab content from a dedicated, focused configuration surface. No more hunting through nested tabs to find the right content.
  - Local Quicknote Scratchpad: Header-accessible local scratchpad stored independently from workspace exports.
• Floating Window System: Notes can be popped out into draggable, resizable, focus-stacked windows that persist state, position, and dimensions across browser reloads.

FEED READER MODULE
• Integrated RSS/Atom feed reader module deployable directly inside any page module grid.
• Feed source management: add, validate, and auto-discover hidden RSS/Atom feed endpoints from standard web domain URLs.
• Reader capabilities:
  - Source filtering and customizable visible article limits.
  - Read and unread item state tracking with bulk mark-as-read/unread actions.
  - Item archive manager to save articles locally with optional user comments.
  - Expanded Reader View: Maximize feed modules into a dedicated full-width reading view with adjustable reading column width selectors.
  - In-feed local text filter input to search loaded articles in real time.
  - Optional per-module auto-refresh loop while the active tab is visible.
  - Cross-origin feed fetching executed safely by the background service worker.

WIDGET RAIL & UTILITY TOOLS
• Modular widget rail positioned above or below main workspace pages.
• Clock & Time Utilities:
  - Toggleable Digital or Analog clock display modes.
  - Localized date/time string formatting, token insertion helpers, custom font sizing, alignment, and per-part element colors.
  - Local-first Stopwatch and Multi-Timer tools running on a zero-churn real-DOM render loop.
• Weather System:
  - Compact rail temperature readout with custom location search and unit toggles (Celsius/Fahrenheit).
  - Detailed weekly weather forecast modal accessible directly from the rail readout.
• Remote sync status indicator with visual health feedback.

CONTEXT MENU CAPTURE & INBOX ENGINE
• Browser Context Menu Integration: Right-click any webpage or text selection to execute "Append to Quicknote" without switching tabs.
• Live Pending Counter: Background tab title updates dynamically to reflect unfiled queue counts (e.g., INBOX [3] - Speedtab).
• Advanced Inbox Manager: Dedicated header drawer to review, edit, filter, and file captured clips into specific bookmark or note modules.

DATA OWNERSHIP, STORAGE & REMOTE SYNC
• 100% Local-First Storage: All application state, module structures, and binary assets stored inside client-side IndexedDB via Dexie.
• Portable JSON Data Exchange:
  - Checksum-verified JSON export files (speedtab-export-<checksum>.json).
  - Identity-aware record merge engine to transfer workspaces between browser profiles without record duplication.
  - Isolated import/export utility surface (import-export.html).
• Optional Remote Cloud Synchronization:
  - WebDAV Sync: Manual push, pull, remote-content comparison, and status checks.
  - Google Drive Sync: OAuth-backed sync via chrome.identity to the user's hidden app-data folder, including auto-push timer intervals and remote workspace health verification.

SYSTEM MAINTENANCE & GRID SORTER
• Dedicated Grid Sorter (sorter.html): Isolated configuration page to reorganize workspace page hierarchies, edit tab titles inline, and perform cascading deletions.
• System Cleanup Manager: Scan local database tables to detect and clear orphaned records, unused binary assets, and stale favicons.

INTERNATIONALIZATION & NATIVE LOCALIZATION
• Extension internationalization built on native chrome.i18n.
• Complete UI translations and localized example workspaces for English, German, Netherlands, Turkish, Hindi, Russian, and Chinese (simplified).


----------------------------------------
PERFORMANCE & SIZE
----------------------------------------

• Zipped extension size: ~580 KB
• Chrome Task Manager
  - Memory: ~50 MB total memory / ~5 MB live JavaScript heap
  - CPU usage: 1-10% during active use
  - ~40 total event listeners for the entire extension
  - Responsive UI with no virtual DOM overhead
