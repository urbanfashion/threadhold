# Hermes Mnem adapter

Shared local-first brain via stdio MCP.

## Setup

1. build the project

2. launch dist/server.js via node

3. share MNEM_DB and MNEM_VAULT env

## Notes

- WAL for concurrent writers
- Regenerate vault from DB
- idempotency_key on retries
- namespace project for filters
