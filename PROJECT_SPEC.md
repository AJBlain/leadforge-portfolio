# LeadForge v1.0 — Product Specification

## Purpose
Windows-local real-estate intelligence workbench. Users search approved public parcel/GIS sources, assess property opportunities, save leads, and manage follow-ups without a paid property data API.

## Main workspaces
1. Vacant Lot Search — location, parcel/buildability heuristics and exclusions.
2. Commercial Search — preserved filters and reported property/owner evidence.
3. Vacant Commercial Properties — improved commercial property gate, estimated vacancy signal with reason/source, *not* verified vacancy.
4. Property Search — address and parcel details, market/appraisal indications, ownership and public source links.
5. Long-Term Owner Search — record deed dates, ownership age, probable owner-occupancy indicators; not guaranteed ownership or occupancy.
6. Lead Machine — six geographic batches of **ChatGPT-assisted** DFW Reddit discovery; manual JSON import; Verified, Needs Verification and Archive views; score/temperature, source URL, manual contact draft.

## Lead data
Saved Leads remain in browser localStorage under the prior shared key `lotLeaditLeadDataV2`, preserving compatibility. Pipeline: Unworked → Contacted → Appointment → Closed → Completed. Completed leads are archived separately and may be reactivated. Follow-up dates, notes, contact status and CSV exports persist locally. No automatic message is sent.

Source-specific browser keys use a LeadForge prefix; a one-time *copy-only* migration preserves earlier data and never removes old keys. No third-party passwords, private contact names, tokens or API keys ship in public source.

## Scoring & evidence
Scoring is **rule-based** and explainable, not a learned model; it is a prioritization aid. Public records may have unknown or outdated values. Unknown listing status stays Unknown, not No. Missing acreage stays unknown rather than numeric zero. No claims of confirmed vacancy, listing status or personal identity without evidence.

## AI boundaries
Reddit research uses ChatGPT through the user's own account. Its search coverage is self-reported, not independently confirmed by LeadForge. Results with missing date evidence remain in Needs Verification for human review. No direct AI API integration, autonomous web crawler, Facebook account automation, or hosted SaaS backend is included in this release.

## Security and distribution
Local HTTP listener binds to 127.0.0.1:8765. The Windows installer writes under LOCALAPPDATA (per-user), adds links and uninstaller. No real customer records or personal identity details are included. No external services are called in the installer. User settings/signatures remain in browser storage.
