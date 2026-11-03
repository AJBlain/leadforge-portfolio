# LeadForge v1.0 — Test Plan

## Automated release gates

```text
node --test tests/reddit-engine.test.cjs
node tests/import-integration.cjs
node tests/storage-migration.test.cjs
node tests/leadforge-branding.test.cjs
python tests/release_static_check.py
python tests/privacy_scan.py
```

Run `node --check` for all JavaScript runtime files and validate HTML IDs/resource paths. Go cross-compilation must produce PE32+ Windows x64 GUI executables for the launcher and Setup. Verify ZIP CRC and inspect for secrets/PII.

## Mandatory physical Windows acceptance tests
1. Run Setup: install, desktop/start menu shortcut, Installed Apps registration, launch, uninstall.
2. Open LeadForge, confirm dedicated maximized Chrome window on the primary monitor and server startup log.
3. Existing browser profile: preserved Saved Leads, Completed Leads, pipeline, follow-ups, excluded-owner lists, Reddit results and coverage after migration.
4. All six workspaces: verify initial render, empty-state messaging and one actual GIS query per property search category; distinguish error vs no results.
5. Lead Machine: run region selection, paste JSON import, review Verified / Needs Verification / Archive, URL dedupe and title/link preservation.
6. Save pipeline stage and follow-up, reopen in Saved Leads, mark Completed and reactivate. Export CSV.
7. Settings: configure optional signature and confirm it appears in generated outreach drafts. Clear it and verify no personal data in draft.
8. Uninstall: app files removed; browser lead data remains untouched.

## Known limitations
No Windows runtime is available in the build environment; cross-compilation and static checks are not a substitute for these GUI/runtime tests. Public parcel endpoints are outside our control. Reddit discovery is manual ChatGPT-assisted and not a guaranteed source of fresh leads. Model-based autonomous agents are not part of v1.0.
