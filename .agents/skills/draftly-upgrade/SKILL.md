---
name: draftly-upgrade
description: Upgrade the Draftly email drafting app in this repository while preserving its existing behavior, configuration, and user data.
---

# Draftly Upgrade

Use this skill for feature work, bug fixes, and dependency or architecture updates in this Draftly repository.

## Project map

- `api/` contains the FastAPI backend, LangChain writer, SQLAlchemy models and repositories, and SQLite persistence.
- `web/` contains the Next.js App Router UI, draft workflow, REST client, and server-sent event (SSE) handling.
- `README.md` documents setup, API contracts, and architecture.

## Upgrade guidance

- Inspect the current implementation and the relevant API and UI contracts before changing code. Preserve unrelated local work.
- Keep backend request and response schemas, route paths, and SSE event shapes aligned with the frontend client.
- Preserve the human review and approval flow; draft generation must not send email automatically.
- Keep safety checks on ideas and edited drafts, and preserve time-zone-aware date handling.
- Treat `.env` and database files as user data. Never replace them with example files or expose their values.
- When a schema change is necessary, provide a migration that preserves existing drafts and versions. Back up local SQLite data before an in-place migration.
- Keep setup instructions in `README.md` consistent with the commands and settings the project actually supports.
