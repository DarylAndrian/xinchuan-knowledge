# Security

## Supported version

Security fixes are applied to the latest release, currently **1.4.x**.

## Access model

The wiki is public by design: anonymous visitors may read published pages when `public_viewing` is enabled. Drafts, revision history, user data, settings, bulk content APIs, and every write operation require an authenticated role. The `/api/public/*` routes are the only intended anonymous content API and return a deliberately small, read-only representation.

WebMCP exposes only the published-content operations backed by those public routes. There are no WebMCP write tools and no PAT or session token is requested from an agent.

## Production checklist

- Serve the app through HTTPS; production session cookies use the `Secure`, `HttpOnly`, and `SameSite=Lax` attributes.
- Set strong first-run `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` values before the database is created. Do not deploy the sample credentials.
- Set a long, random `DEPLOY_WEBHOOK_SECRET` if GitHub auto-deployment is enabled.
- Restrict filesystem access to `data/xinchuan.db` and back it up regularly; revision history is stored in the same database.
- Keep Node.js, Next.js, TipTap, and npm dependencies patched. Run `npm audit` during upgrades and test major-version remediation separately before production rollout.
- Put rate limiting at the reverse proxy or edge as well as the application-level sign-in throttle when the service is internet-facing.

## Reporting a vulnerability

Report vulnerabilities privately to the repository owner. Include reproduction steps, affected routes, impact, and any suggested mitigation. Do not include live credentials, private wiki content, or exploit traffic against production in a public issue.
