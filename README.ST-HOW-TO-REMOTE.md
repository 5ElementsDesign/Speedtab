# Remote Sync How-To

Speedtab remote sync is local-first and manual by default. Optional automatic sync is available for Google Drive.

- No background sync runs unless Google Drive Auto Sync is explicitly enabled.
- There is no account system.
- Remote sync supports `WebDAV` and `Google Drive`.
- Automatic status checks and push are available for `Google Drive` only.
- Remote credentials are stored in `chrome.storage.local` only.
- Remote credentials are never written into IndexedDB portable tables or export files.

## What Remote Sync Is For

Remote sync lets you keep a portable workspace export on a WebDAV endpoint or in your Google Drive app-data folder and pull it into another browser profile later.

Think of it as:
- local workspace in IndexedDB
- optional local file export
- optional remote export copy on WebDAV or Google Drive

These are related, but not the same thing.

## Important Distinction

`Local Export` and `Remote Push` are tracked separately.

- `Local Export` creates a downloadable JSON file on this machine.
- `Remote Push` uploads the current workspace export and metadata sidecar to your configured remote location.

Speedtab also keeps checksum-based remote archive copies on the configured remote provider.
If the current local checksum is already preserved remotely, Speedtab reduces unnecessary push reminders.

## Where To Find It

Open the `Data Exchange` modal from the app UI.

The modal currently has:
- a `Remote Configuration` section
- a `Local File Backup` section
- a `Remote Sync` section
- a Google Drive-only `Auto Sync` section when Google Drive is selected
- a `Workspace Content` summary that can compare local and remote counts

## Remote Configuration Fields

Current fields:

- `Provider`: `WebDAV` or `Google Drive`
- `Device Label`: a human-readable label like `Desktop`, `Laptop`, or `Work Browser`
- `Endpoint URL`: base WebDAV URL, for example `https://dav.example.com/root`
- `Username`
- `Secret`
- `Remote Path`: path inside that endpoint, for example `/speedtab`

`Endpoint URL` must be a valid `http://` or `https://` URL.

For Google Drive, Speedtab uses Chrome's OAuth flow and stores the workspace in the user's hidden Drive `appDataFolder`. WebDAV endpoint, username, secret, and remote-path fields are not used for Google Drive.

## Google Drive Setup

Google Drive is an optional remote provider and does not require a Speedtab account or Speedtab-operated backend.

Recommended first-time flow:

1. Open `Data Exchange`.
2. Select `Google Drive` as the provider.
3. Click `Test Connection` and complete Google's authorization flow.
4. Click `Save Remote`.
5. Click `Check Status`.
6. If the remote is empty, click `Push To Remote`.

Google Drive stores Speedtab's live export, metadata, and checksum archive files in its hidden app-data area. These files do not appear in the normal Drive file list, and Speedtab does not request access to the user's regular Drive files.

### Google Drive Auto Sync

Auto Sync is shown only when `Google Drive` is selected. It is disabled by default.

- Enable `Auto Push` in the `Data Exchange` remote settings.
- Set the interval in minutes; the default is `10` minutes, with supported values from `1` to `1,440` minutes.
- Speedtab runs the checks through the extension's background service worker.
- It checks whether the local workspace is dirty and whether the remote state can safely be updated.
- When the local workspace is newer or the remote is missing, Speedtab pushes automatically.
- It does not automatically pull or overwrite local data.
- If the remote is newer, divergent, incompatible, or otherwise ambiguous, auto-push is blocked until the state is reviewed manually.
- Offline periods, incomplete configuration, and the last check/push result are shown in the sync status.

Auto Sync is not available for WebDAV; WebDAV remains manual-only.

## WebDAV Compatibility

Speedtab follows normal WebDAV behavior.

That means the same remote-sync flow should work with:

- hosted WebDAV providers
- NAS/WebDAV appliances
- self-hosted WebDAV servers
- Nextcloud/ownCloud-style WebDAV endpoints

As long as the endpoint supports standard authenticated WebDAV file access for the configured path, Speedtab does not depend on a Speedtab-specific server.

## Quick Koofr Setup

Koofr works as a straightforward WebDAV target.

Example values:

- `Provider`: `WebDAV`
- `Endpoint URL`: `https://app.koofr.net/dav/Koofr`
- `Username`: your Koofr login
- `Secret`: your Koofr app password / WebDAV password
- `Remote Path`: `/speedtab`
- `Device Label`: anything descriptive, for example `Desktop`

Recommended first-time Koofr flow:

1. Create a folder named `speedtab` in your Koofr storage first.
2. Open `Data Exchange`.
3. Enter the Koofr WebDAV values.
4. Click `Save Remote`.
5. Click `Test Connection`.
6. Click `Check Status`.
7. Click `Push To Remote`.

Why the folder matters:

- Speedtab uploads files into the configured remote path.
- If `/speedtab` does not exist yet, many WebDAV servers, including Koofr, will reject the upload with `404`.
- In that case, create the folder first, then push again.

## Recommended Setup Flow

1. Open `Data Exchange`.
2. Fill in the remote configuration fields.
3. Click `Save Remote`.
4. Click `Test Connection`.
5. Click `Check Status`.
6. If the remote is empty, use `Push To Remote`.

After that, use `Check Status` whenever you want a fresh compare/health check.

## What `Test Connection` Does

`Test Connection` validates the current draft configuration without saving changes automatically.

It is meant to confirm:
- the endpoint is reachable
- authentication works
- the provider can talk to the target using the expected remote behavior

It does not:
- modify remote files
- upload exports
- pull data

## Normal Push Flow

Use this when the current browser profile has the workspace state you want to publish.

1. Open `Data Exchange`.
2. Click `Check Status`.
3. Review the compare state.
4. Click `Push To Remote`.
5. Confirm overwrite if Speedtab tells you the remote differs.

Possible outcomes:
- remote missing
- already up to date
- push complete
- archive already present
- partial success if the live export uploaded but a repair is still needed

## Normal Pull Flow

Use this when the remote copy is the one you want to merge into the current browser profile.

1. Open `Data Exchange`.
2. Click `Check Remote Contents`.
4. Review the remote state.
5. Click `Pull From Remote`.
6. Confirm the import.

Current pull behavior uses the same merge/import rules as local v2 import.
It does not silently replace the whole local workspace.

## Compare States

Speedtab can classify remote/local state as:

- `identical`
- `remote_missing`
- `remote_newer`
- `local_newer`
- `divergent`
- `version_mismatch`
- `unknown_endpoint_context`

The modal only shows the actions that make sense for the current state, such as:
- `Push To Remote`
- `Pull From Remote`
- `Download Remote Export`
- `Download Both`

## Remote Health

`Check Status` also feeds the health panel.

Common health results:
- `healthy`
- `sidecar_missing`
- `export_missing`
- `metadata_mismatch`
- `corrupt_metadata`
- `auth_failure`
- `network_error`
- `not_configured`

When possible, Speedtab shows repair guidance instead of trying to fix things silently.

## Remote Archive

For WebDAV, Speedtab uses two locations:

- live files in `/speedtab`
- checksum archive files in `/st-archive`

Live files:
- `speedtab-export.json`
- `speedtab-meta.json`

Archive files:
- `speedtab-export.<checksum>.json`

Archive behavior:
- new checksums are archived once
- already archived checksums are not uploaded again
- archive presence is used as a signal that the current local state is already preserved remotely

Google Drive stores the equivalent live and archived files inside its hidden `appDataFolder` instead of using WebDAV paths.

## When Speedtab Reminds You To Export

The local export reminder is driven by a dirty journal.

Typical reasons include changes to:
- pages
- modules
- collections
- tabs
- notes
- feed sources
- archived feed items
- assets

The reminder is not driven by transient UI state or live feed cache responses.

## Current Limits

- WebDAV sync is manual only
- Google Drive Auto Sync does not pull automatically
- automatic sync is blocked when a remote conflict or version mismatch needs manual review
- there is no account-based server component

## Practical Recommendation

Use whichever combination fits your workflow:

- local export for a file you control directly
- manual remote push for a second copy on WebDAV or Google Drive
- optional Google Drive Auto Sync for scheduled background checks and safe automatic pushes

That gives you one portable file artifact and one remote recovery point without changing Speedtab’s local-first model.
