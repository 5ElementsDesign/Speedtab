# Remote Sync How-To

Speedtab remote sync is manual and local-first.

- There is no background sync.
- There is no account system.
- Remote sync currently supports `WebDAV` only.
- Remote credentials are stored in `chrome.storage.local` only.
- Remote credentials are never written into IndexedDB portable tables or export files.

## What Remote Sync Is For

Remote sync lets you keep a portable workspace export on a WebDAV endpoint and pull it into another browser profile later.

Think of it as:
- local workspace in IndexedDB
- optional local file export
- optional remote export copy on WebDAV

These are related, but not the same thing.

## Important Distinction

`Local Export` and `Remote Push` are tracked separately.

- `Local Export` creates a downloadable JSON file on this machine.
- `Remote Push` uploads the current workspace export and metadata sidecar to your configured WebDAV location.

Speedtab also keeps a checksum-based remote archive copy on WebDAV.
If the current local checksum is already preserved remotely, Speedtab reduces unnecessary push reminders.

## Where To Find It

Open the `Data Exchange` modal from the app UI.

The modal currently has:
- a `Remote Configuration` section
- a `Local File Backup` section
- a `Remote Sync` section
- a `Workspace Content` summary that can compare local and WebDAV counts

## Remote Configuration Fields

Current fields:

- `Provider`: currently `WebDAV`
- `Device Label`: a human-readable label like `Desktop`, `Laptop`, or `Work Browser`
- `Endpoint URL`: base WebDAV URL, for example `https://dav.example.com/root`
- `Username`
- `Secret`
- `Remote Path`: path inside that endpoint, for example `/speedtab`

`Endpoint URL` must be a valid `http://` or `https://` URL.

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

Speedtab uses two WebDAV locations:

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

- WebDAV is the only implemented remote provider
- sync is manual only
- there is no background auto-push
- there is no scheduled sync
- there is no account-based server component

## Practical Recommendation

Use both:

- local export for a file you control directly
- remote push for a second copy on your WebDAV storage

That gives you one portable file artifact and one remote recovery point without changing Speedtab’s local-first model.
