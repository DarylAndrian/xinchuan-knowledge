# Security

## Supported version

Security fixes are applied to the latest release, currently **1.6.x**.

## Access model

The wiki requires a signed-in account. Visitors without a session cookie are redirected to `/login` (HTML) or receive `401` (APIs). `/login`, `/api/auth/login`, `/api/auth/logout`, and `/api/deploy/*` are the only unauthenticated routes.

Roles, from most to least privileged:

- **superadmin** — users, collections, settings, editor
- **admin** — editor; cannot open the superadmin panel
- **commentator** — read published pages and leave comments
- **guest** — read published pages only; cannot comment, open `/editor`, or open `/admin`

Drafts, revision history, user data, settings, bulk content APIs, and every write operation still require the matching role. `/api/public/*` returns a small read-only representation of published content and also requires a session.

WebMCP exposes only those published-content operations for signed-in browser sessions. For external agents, personal access tokens (PATs) authenticate `POST /api/mcp`. Tokens store only a SHA-256 hash, are shown once at creation, can expire, and can be revoked from the admin panel. Effective MCP permissions are the intersection of the token’s scopes and the owner’s live role (so demotion or suspension immediately narrows or kills access). Guests cannot mint tokens. `/api/mcp` does not accept cookie sessions; the reverse-proxy allowlist treats it as public because the `Authorization` header is the only credential.

## Production checklist

- Serve the app through HTTPS; production session cookies use the `Secure`, `HttpOnly`, and `SameSite=Lax` attributes.
- Treat PATs like passwords: never commit or log them, revoke leaked tokens immediately, and prefer scoped tokens with expiry for integrations.
- Set strong first-run `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` values before the database is created. Do not deploy the sample credentials.
- Set a long, random `DEPLOY_WEBHOOK_SECRET` if GitHub auto-deployment is enabled.
- Restrict filesystem access to `data/xinchuan.db` and back it up regularly; revision history is stored in the same database.
- Keep Node.js, Next.js, TipTap, and npm dependencies patched. Run `npm audit` during upgrades and test major-version remediation separately before production rollout.
- Put rate limiting at the reverse proxy or edge as well as the application-level sign-in throttle when the service is internet-facing.

## Reporting a vulnerability

Report vulnerabilities privately to the repository owner. Include reproduction steps, affected routes, impact, and any suggested mitigation. Do not include live credentials, private wiki content, or exploit traffic against production in a public issue.
