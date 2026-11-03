# LeadForge v1.0 — Architecture

```text
Windows LeadForge.exe / START_APP.bat
       |
       v
PowerShell local service @ 127.0.0.1:8765 (server.ps1)
       | serves HTML/CSS/JS           | approved public ArcGIS REST requests
       v                              v
Vanilla browser UI           normalizes service responses
  | app.js, saved.js, completed.js
  | reddit-engine.js (pure normalization, validation & scoring)
  | storage-utils.js (safe writes & one-time key copy)
  v
Browser localStorage (same origin, single browser profile)
       |
       v
Saved / Completed lead stages, follow-ups and CSV exports
```

## Components
- `index.html`, `styles.css`, `brand-ui.js`, `leadforge-mark.svg`, `LeadForge.ico`: branding/UI and optional local outreach signature.
- `app.js`: state, public property searches, Lead Machine orchestration, maps and lead operations.
- `reddit-engine.js`: dependency-free subreddit geography, dates, normalization, scoring and post ID dedupe.
- `saved.js`, `completed.js`: lead lifecycle views, local persistence and export.
- `storage-utils.js`: safe browser writes, error feedback and legacy-key copy migration.
- `community-hub.js`: Reddit-only Lead Machine panel.
- `server.ps1`: loopback local server and bounded concurrent public GIS requests, with 5-minute cache.
- `launch_chrome.ps1`: separate Chrome window on the primary monitor when available, preserving the browser profile.
- `packaging/launcher/main.go`: native Windows GUI entry point that checks localhost health and starts the PowerShell service without a console.
- `packaging/installer/main.go`: per-user Windows self-extracting installer using embedded release assets; shortcuts, Installed Apps registration, uninstall.

## Tradeoffs
- Single local browser profile keeps startup simple but has limited storage and no account sync.
- Public GIS sources are cost-efficient but subject to schema/availability changes; search failures must be visible.
- Rule-based scores are traceable but cannot replace independent verification.
- The Lead Machine intentionally avoids automated access to Reddit; human review is the integrity boundary.
- The Windows launcher removes the need to leave a visible terminal open, but the PowerShell backend is still a child service and writes diagnostics to `%LOCALAPPDATA%\LeadForge\logs\server.log`.

## Security and secrets
No hosted AI integrations, cloud credentials, external account actions or hard-coded personal contact details. Installer requires no admin privilege; local browser origin remains unchanged for migration compatibility.

