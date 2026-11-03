# Security policy

LeadForge is a local-first proof-of-work application, not a hosted CRM. Treat imported public research as untrusted data and verify original sources. Do not commit actual customer records, credentials, personal phone numbers, private exports or browser profiles.

No service passwords or third-party API tokens are required. Only basic diagnostic logs are created under the current user's Local AppData. For a private report, open a GitHub issue with sanitized reproduction steps; never attach real personal data or secrets to public issues.

The installer and launcher are unsigned. For trust, compare release SHA-256 values with the generated manifest and build from source. No remote auto-update is included.
