# Speedtab Privacy Policy

Last updated: 2026-05-22

Speedtab is a local-first browser extension. Its purpose is to provide a structured new-tab dashboard for bookmarks, notes, RSS/Atom feeds, and workspace organization.

## Summary

Speedtab stores user-created workspace data locally in the browser.

Speedtab does not:
- require an account
- operate a backend for user workspaces
- sell user data
- use user data for advertising

Network access is used only for user-facing features such as fetching user-configured feeds and loading favicon images for links and feed sources.

## Data Speedtab Stores

Speedtab may store the following data locally inside the browser profile:

- pages
- modules
- collections
- bookmarks
- notes
- feed source definitions
- archived feed items
- local image assets such as bookmark previews, favicons, and backgrounds
- appearance settings such as themes, presets, and background preferences
- import/export metadata needed for portable local workspaces

This data is stored locally using IndexedDB.

## Encrypted Notes

If a user creates encrypted notes, those notes are encrypted client-side before storage.

Speedtab uses browser cryptography APIs for encrypted note content.
Passphrases are not stored by Speedtab.

## Network Requests

Speedtab may make external requests for these user-facing features:

- fetching RSS/Atom feeds from URLs the user configures
- requesting favicon images for feed sources or links

These requests are made directly by the extension. They are not proxied through a Speedtab-controlled backend.

## Data Sharing

Speedtab does not sell user data.
Speedtab does not rent user data.
Speedtab does not use user data for personalized advertising.
Speedtab does not transfer user workspace data to a Speedtab-controlled third-party server.

The only third-party network interactions are those needed for the user-facing features listed above, such as feed fetching and favicon loading.

## Export and Import

Speedtab allows users to export their workspace data to a local JSON file and import that data again later.

Exported files are created locally on the user’s device.
Imported files are processed locally inside the browser.

Transient feed cache data is not treated as portable workspace data.

## Retention

Workspace data remains in the browser profile until the user deletes it, clears browser storage, removes the extension data, or uninstalls the extension.

Some transient feed cache data may be pruned automatically as part of normal local maintenance behavior.

## Security

Speedtab is designed to minimize unnecessary data exposure by keeping application data local-first and by avoiding a cloud backend for workspace storage.

No software can guarantee absolute security, but Speedtab is built to reduce exposure by storing workspace data locally and by encrypting encrypted-note content before storage.

## Changes to This Policy

This privacy policy may be updated if Speedtab’s data handling changes.

The Chrome Web Store listing, privacy disclosures, and this policy should remain consistent with the current extension behavior.

## Contact

If you publish Speedtab under a public repository or project site, add your preferred contact method here:

- project repository
- issue tracker
- email address
