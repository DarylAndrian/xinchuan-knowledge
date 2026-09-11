---
feature: pat-mcp
status: delivered
updated: 2026-09-11
branch: main
commits: pending
---

# PAT + Full HTTP MCP

## Report

**What was built** — Superadmins can mint GitHub-style personal access tokens from Admin → Access Tokens: named, optional 30/90/365-day expiry, nine selectable scopes, shown once with copy, listed by prefix, and revocable. Tokens store only SHA-256 hashes. `POST /api/mcp` is a Streamable-HTTP MCP endpoint authenticated solely by `Authorization: Bearer xk_pat_…`. It exposes 22 tools covering search/read/list content, page and collection writes, comments, revisions (list/restore), users, and site settings. Effective permissions are the intersection of token scopes and the owner’s live role. In-browser WebMCP tools are unchanged.

**Verification** — `npx tsc --noEmit` PASS; `npm run build` PASS (`/api/mcp` and `/api/tokens` registered). Live smoke against `next start`: initialize 200, tools/list 22 tools, `list_xinchuan_collections` 200, `create_xinchuan_page` success, `list_xinchuan_users` success, missing Bearer 401. Independent review: spec T1–T5 PASS, no critical correctness/security findings.

**Journey log**
- `proxy.ts` initially 401’d `/api/mcp` before the route ran; MCP is now on the public allowlist because PAT is the only credential.
- PowerShell’s `Invoke-WebRequest` mishandled `Secure` session cookies over HTTP; Node `fetch` confirmed session + token APIs work.
- `lib/mcp.ts` intentionally mirrors browser API mutations (zero-dep MCP); future page/user fixes must land in both places.
- Review polish: revoke only clears the matching minted secret, invalid `expires_in_days` is rejected, MCP version reads `package.json`.

## [S1] Problem

The wiki only exposes four browser-bound WebMCP tools (search, read page, list collections, recent updates). External agents (Claude Code, Cursor, Claude Desktop remote MCP) cannot authenticate. There is no Personal Access Token (PAT), no scope control, and no write/admin tools for agents. Superadmins need GitHub-style named tokens with adjustable permissions, plus an HTTP MCP endpoint covering the full product surface.

## [S2] Design

### Access tokens

- Token plaintext format: `xk_pat_` + 40 hex chars (`crypto.randomBytes(20).toString("hex")`).
- Store only `sha256(token)` in SQLite; show the full token once at creation.
- Display `token_prefix` = first 12 characters (`xk_pat_` + 5) for the list UI.
- Fields: name, user_id (creator), scopes JSON array, optional expires_at (epoch ms), last_used_at, created_at.
- Lifetime: default no expiry; optional 30/90/365 days at create time. Revoke = DELETE.
- Management is on the superadmin panel (`/admin` → Access Tokens). Tokens are owned by the creating user. Superadmins can mint any scope; effective scopes are still capped by the owner’s role at use time (role demotion narrows live access).

### Scopes (GitHub-style)

| Scope | Allows |
| --- | --- |
| `read:content` | search, read page, list collections, recent updates, list pages |
| `write:content` | create/update/delete pages; create collections |
| `read:comments` | list comments on a page |
| `write:comments` | add or delete comments |
| `read:revisions` | list revisions; restore a revision |
| `read:drafts` | include draft pages in list/read |
| `admin:collections` | rename/update and delete collections |
| `admin:users` | list/create/update/delete users |
| `admin:settings` | get and update site settings |

Role cap at authentication time:

| Role | Max scopes |
| --- | --- |
| guest | `read:content` |
| commentator | guest + `read:comments` `write:comments` |
| admin | commentator + `write:content` `read:revisions` `read:drafts` |
| superadmin | admin + `admin:collections` `admin:users` `admin:settings` |

A token’s effective scopes = stored scopes ∩ role cap. Missing scope on a tool call → MCP tool error (`-32000`) with a clear message.

### Session APIs (same-origin)

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /api/tokens` | session | list own tokens (no secrets) |
| `POST /api/tokens` | session | `{ name, scopes[], expires_in_days? }` → token once |
| `DELETE /api/tokens/:id` | session | revoke own token |

Any signed-in non-guest can manage their own tokens. Superadmin panel surfaces creation for the signed-in superadmin (agent integrations).

### MCP transport

- Streamable HTTP MCP at `POST /api/mcp`.
- Auth: `Authorization: Bearer xk_pat_…` (no cookie fallback on this route).
- Stateless JSON-RPC 2.0: `initialize`, `notifications/initialized` (202), `ping`, `tools/list`, `tools/call`.
- Protocol version `2025-03-26` (also accept `2024-11-05`).
- No third-party MCP SDK; hand-rolled JSON-RPC in `lib/mcp.ts` to keep deps zero.
- Existing in-browser `WebMCPTools` stay as-is for signed-in browsers.

### Tools

Read content (`read:content`): `search_xinchuan_wiki`, `read_xinchuan_page`, `list_xinchuan_collections`, `recent_xinchuan_updates`, `list_xinchuan_pages`.

Write content (`write:content`): `create_xinchuan_page`, `update_xinchuan_page`, `delete_xinchuan_page`, `create_xinchuan_collection`.

Collections admin (`admin:collections`): `update_xinchuan_collection`, `delete_xinchuan_collection`.

Comments: `list_xinchuan_comments` (`read:comments`), `add_xinchuan_comment` / `delete_xinchuan_comment` (`write:comments`).

Revisions: `list_xinchuan_revisions`, `restore_xinchuan_revision` (`read:revisions`).

Users (`admin:users`): `list_xinchuan_users`, `create_xinchuan_user`, `update_xinchuan_user`, `delete_xinchuan_user`.

Settings (`admin:settings`): `get_xinchuan_settings`, `update_xinchuan_settings`.

Draft inclusion in list/read requires `read:drafts`. Page writes reuse the same sanitization, revision, and FTS sync as the browser APIs. User writes keep last-superadmin protections. MCP mutations skip `enforceSameOrigin` (no browser Origin); PAT auth is the boundary.

### Docs

Update README (features, public API/MCP table, connect snippet) and SECURITY.md (PAT model, revoked tokens, HTTPS). Changelog entry under Unreleased.

## [S3] Out of Scope

- OAuth / fine-grained org tokens
- Per-collection scope ACLs
- SSE long-lived stream (`GET /api/mcp`) — POST-only is enough for current clients
- Replacing or removing in-browser WebMCP tools
- Token usage analytics beyond `last_used_at`

## Tasks

- [x] T1: Schema + token helpers — acceptance: `access_tokens` table exists; create stores hash only; verify authenticates and respects expiry/suspension/role cap (covers: S2 Access tokens, Scopes)
- [x] T2: Token session APIs — acceptance: GET/POST/DELETE `/api/tokens` work for signed-in users; plaintext returned only on create (covers: S2 Session APIs)
- [x] T3: Admin panel Access Tokens UI — acceptance: superadmin can create a named scoped token, copy it once, see list, revoke (covers: S2 Access tokens)
- [x] T4: MCP HTTP endpoint + tools — acceptance: Bearer PAT on `/api/mcp` completes initialize/list/call; unauthorized and under-scoped calls fail cleanly; write/admin tools match role caps (covers: S2 MCP transport, Tools)
- [x] T5: Docs + changelog + typecheck/build — acceptance: README/SECURITY/CHANGELOG updated; `npx tsc --noEmit` and `npm run build` pass (covers: S2 Docs)
