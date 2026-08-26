# Security Policy

Last updated: 2026-08-25

## Overview

Speedtab is a local-first browser extension. Its security model is based on keeping workspace data inside the browser profile instead of sending it to a remote backend.

Speedtab includes an encrypted note type (`crypt`) for users who want to store selected note content in encrypted form.

This document explains:
- what Speedtab protects
- what encrypted notes do and do not protect
- how the current note-encryption model works
- how to report security issues

## Supported Versions

Security fixes are expected to target the latest actively maintained version of Speedtab.

At the time of writing:

- `1.x` is the active line

## What Speedtab Protects

Speedtab is designed to reduce exposure by:

- storing application data locally in the browser profile
- avoiding a cloud backend for user workspace storage
- encrypting `crypt` note content client-side before local storage
- not storing encrypted-note passphrases

## What Is Encrypted

Only notes created with the `crypt` note type are encrypted.

Encrypted note content is stored as structured encrypted payload data rather than plaintext note content.

Other Speedtab data is not globally encrypted by default, including:

- normal text notes
- code notes
- HTML notes
- link notes
- tasks and to-do items
- bookmarks
- feed source definitions
- feed cache
- archived feed items
- appearance settings

## Encryption Model for `crypt` Notes

Speedtab’s encrypted-note implementation currently uses:

- AES-GCM for authenticated encryption
- PBKDF2-SHA256 for key derivation
- 310,000 PBKDF2 iterations
- a random salt per encrypted note
- a random IV per encrypted note

Speedtab stores only the encrypted payload data needed to decrypt the note later.
Passphrases are not stored by the application.

## What This Protects Against

The encrypted note feature is intended to protect selected note content at rest inside the local browser storage.

This helps reduce exposure in scenarios such as:

- someone reading IndexedDB contents directly
- plaintext note content being visible in stored local data
- exporting encrypted-note records without exposing their plaintext contents

## What This Does Not Protect Against

Speedtab is not a full disk-encryption or full profile-encryption system.

The encrypted-note feature does **not** guarantee protection against:

- malware or malicious browser extensions running with equivalent local access
- a compromised operating system account
- a compromised browser process
- a device that is already unlocked and being actively used by an attacker
- keylogging or passphrase theft at input time
- screenshots, shoulder surfing, or clipboard leakage outside the encrypted-note model

Also note:

- once a `crypt` note is decrypted in the UI, its plaintext is visible to the active browser session
- non-`crypt` data in Speedtab remains unencrypted by design

## Threat Model Summary

Speedtab’s security posture is best understood as:

- **local-first privacy by default**
- **selective client-side encryption for encrypted notes**
- **no remote workspace backend**

It is **not** a substitute for:

- device security
- browser profile security
- operating system hardening
- password manager workflows
- endpoint malware protection

## Responsible Disclosure

If you discover a security issue in Speedtab, please report it responsibly and avoid public disclosure until the issue has been reviewed.

When reporting a vulnerability, include:

- affected version
- clear reproduction steps
- expected behavior
- actual behavior
- proof of concept if relevant
- severity assessment if you have one

Security reports can be submitted privately via GitHub Security Advisories or opened as an issue on the public repository:
[https://github.com/5ElementsDesign/Speedtab/security/advisories](https://github.com/5ElementsDesign/Speedtab/security/advisories)

## Disclosure Expectations

Please do not publish exploit details before the issue has had a reasonable chance to be reviewed and fixed.

If a report is valid, the goal is to:

- confirm the issue
- assess impact
- prepare a fix
- publish the fix and any needed user guidance

## No Security Guarantees

Speedtab is built with care, but no software can guarantee perfect security.

Use encrypted notes as a practical local protection feature, not as a claim of absolute secrecy under all attack conditions.
