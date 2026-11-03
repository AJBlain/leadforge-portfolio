# LeadForge: building an explainable, local-first real estate prospecting tool

## Problem
Property research involves inconsistent public records, slow geographic queries, unclear ownership signals and ad-hoc tracking of follow-ups. Spreadsheet workflows are difficult to evaluate or reproduce.

## Approach
LeadForge combines a browser workbench with a local PowerShell HTTP service for public ArcGIS REST queries. Search inputs are validated, larger result sets are batched, source records are normalized, and users can inspect owner and parcel evidence before saving a prospect.

## AI & data-science relevance
- **AI-assisted research workflow:** six narrow Reddit search prompts, structured JSON normalization, freshness evidence and a human verification queue.
- **Explainable ranking:** deterministic lead scores based on observable intent/timeline and property signals; rationale and uncertainty are shown rather than a black-box claim.
- **Evaluation mindset:** regression cases for URL normalization, date ambiguity, area detection, duplicate posts, persistence failures and old-data migration.
- **Human-in-the-loop:** proposals and outreach remain editable; nothing is sent automatically.

No trained ML model or autonomous agent is included in v1.0. The architecture is intentionally prepared for future permissioned integrations, but adding a model is not the measure of quality.

## Engineering lessons
1. Unknown data must remain unknown; converting blank fields to zero or Unknown listings to No creates false confidence.
2. Public search engines can fail silently, so distinguish source errors from no matches.
3. The app must preserve user records even as branding and schemas evolve; the migration copies values before switching keys.
4. Public source code must contain neither real contact identity nor an API credential.
5. Packaging, documentation, reproducible tests and failure reporting matter as much as demos.

## Evaluation guidance
Start LeadForge from source using the README, visit Product Overview, run a public parcel search (source coverage varies), review an imported Reddit lead, save to pipeline and create a follow-up. Review the source tests for evidence of data-integrity decisions. See `ROADMAP.md` for known gaps and further work.

