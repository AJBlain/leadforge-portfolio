# LeadForge Roadmap

## v1.0 — Portfolio release
- [x] Independent product branding and icon; multi-page visual consistency
- [x] Removed experimental cloud research integration and embedded token
- [x] Windows native launcher / per-user installer / uninstall
- [x] GitHub documentation, privacy defaults, browser key migration
- [x] Retained Reddit six-region workflows and current property/pipeline functions
- [ ] Windows 10/11 GUI smoke test on a physical user machine (release gate before wide distribution)

## Planned reliability improvements
1. Add deterministic fixtures and contract tests for public ArcGIS schemas and fallback sources.
2. Improve Long-Term Owner diagnostics; distinguish unavailable sources vs. zero matching results, and reproduce previous reported failure.
3. Add repeatable browser-level UI tests and regression snapshots.
4. Introduce opt-in encrypted export/backup; browser localStorage is not a full database.

## Research experiments (not implemented)
- Evaluate authorized AI API providers for bounded tool-driven research, with cost limits, evidence requirements and approval checkpoints.
- Evaluate permissioned commercial decision-maker enrichment after defining data fields, governance and usage terms.
- Avoid introducing a hosted database or licensing server until a real multi-user requirement exists.
