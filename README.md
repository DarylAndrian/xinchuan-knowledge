# Xinchuan Knowledge Center

A wiki-style knowledge base with a quiet, flat “paper and moss” aesthetic. Sign-in required to read, a rich-text admin editor, and Google Docs–style comments anchored to highlighted text.

Current version: **1.7.1** — see [CHANGELOG.md](./CHANGELOG.md).

## Features

- **Sign-in required** — visiting the site without a session redirects to `/login`. After sign-in, users return to the page they asked for.
- **Catalogue reader** — signed-in members can read published pages. Collection sidebar tree, breadcrumbs, a Google Docs–style heading outline (H1–H3, hideable, with scroll highlighting), 68ch reading column, and a touch-friendly mobile page drawer.
- **Anchored comments** — commentators and editors can select any text on a page to attach a comment thread. Comments appear as brass-underlined highlights with numbered indices; threads open in the right rail. Own comments can be deleted; admins can moderate any. Guests can read comments but cannot add them.
- **Admin editor (TipTap)** — headings, bold/italic/strike, **font color** (palette + custom), bullet/numbered/to-do lists, links, image embeds (direct URLs; Google Drive/Dropbox share links auto-converted), callouts, code blocks, tables, dividers — all styled to match the published catalogue page. Tables support add/delete row/column, delete table, and cell/row/column background fills (presets + custom color). Debounced autosave, draft/publish switch, page reparenting, editable URL slugs, page deletion, and responsive page/collection management. Guests and commentators cannot open `/editor`.
- **Revision history** — content, title, icon, and status snapshots are recorded automatically. Editors can inspect the latest 50 revisions and restore an earlier version; the restore itself creates a new revision so history remains recoverable.
- **Light and dark themes** — follows the system preference on first visit, supports a persistent manual toggle in the top bar, and themes native controls and editor content consistently.
- **Roles** — `superadmin` > `admin` > `commentator` > `guest`. Editors manage content; commentators comment; guests may only view published pages; visitors without an account are sent to sign-in.
- **Superadmin panel** — reached from the profile menu (avatar, top right): sticky section navigation; user management with compact action menus (create, change role including Guest, suspend, delete with last-superadmin protection); collection management (rename, description, searchable [Lucide](https://lucide.dev/icons) icon picker including Food and Taxi, delete); access tokens (create named PATs with scopes and optional expiry, copy once, revoke); and site settings (site name, open registration, comment approval). Collections can also be managed from the Editor sidebar via the `...` action menu. Guests cannot open `/admin`.
- **Full-text search** — SQLite FTS5 search over published titles and article text, with relevance ranking, prefix matching, and context snippets.
- **Read-only WebMCP** — compatible agents in a signed-in browser session can search, read a published page, list collections, and inspect recent updates. There are no write tools and no PAT.
- **Personal access tokens + full MCP** — superadmins mint named GitHub-style PATs with selectable scopes from `/admin` → Access Tokens. External agents authenticate to `POST /api/mcp` with `Authorization: Bearer xk_pat_…` and get the full tool surface (read/write content, comments, revisions, collections, users, settings) capped by the token’s scopes and the owner’s role.
- **Hardened API boundary** — pages and `/api/public/*` require a session cookie; authoring APIs require editor roles. Rich text is allowlist-sanitized, browser mutations are same-origin checked, sign-in attempts are throttled, session cookies are secure in production, and baseline security headers are enabled. See [SECURITY.md](./SECURITY.md).
- **Version badge** — the current app version (from `package.json`) is shown small at the top right of the nav bar.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS + custom flat design system (CSS variables) |
| Icons | [Lucide](https://lucide.dev/) via `lucide-react` (searchable categorized picker, ~190 icons including Food and Taxi) |
| Editor | [TipTap](https://tiptap.dev/) (StarterKit, links, images, tables, task lists) |
| Database | SQLite via Node's built-in `node:sqlite` (no native deps), stored at `data/xinchuan.db` |
| Auth | Hand-rolled cookie sessions + `bcryptjs` |

## Getting started

Requires **Node.js 22.5+** (uses `node:sqlite`).

```bash
npm install
npm run dev
# open http://localhost:3000 — you will be redirected to /login
```

The database is created and seeded automatically on first run (users, two collections, sample pages, seeded comment threads).

Production:

```bash
npm run build
npm start
```

## Seeded accounts

| Role | Username | Password |
| --- | --- | --- |
| Superadmin | `admin` | `xinchuan-admin` |
| Admin | `editor` | `xinchuan-admin` |
| Commentator | `mika` | `xinchuan-comment` |
| Guest | `guest` | `xinchuan-guest` |

Override the superadmin credentials on first seed via `.env.local`:

```env
SUPERADMIN_USERNAME=your-username
SUPERADMIN_PASSWORD=your-password
```

## Project structure

```
app/
  page.tsx                  Home (signed-in)
  login/                    Sign-in form
  search/                   Search results
  catalogue/                Reader index + [...path] page renderer
  editor/                   Admin editor workspace
  admin/                    Superadmin panel (users + collections + tokens + settings)
  api/                      session-guarded APIs (read tools + authoring + tokens + MCP)
components/
  TopBar.tsx                Nav + theme toggle + profile menu + version badge
  BrandMark.tsx             Open book + inkwell + quill logo (theme-aware)
  LoginForm.tsx             Sign-in form
  WebMCPTools.tsx           Read-only site-tool registrations (signed-in session)
  ThemeToggle.tsx           Persistent light/dark theme control
  CatalogueSidebar.tsx      Collection tree for the reader
  PageReader.tsx            Article + hideable heading outline + anchored comment threads
  EditorShell.tsx           TipTap editor, tree, inspector, autosave, collection editing
  AdminPanel.tsx            Sticky admin nav + users/roles + collections + access tokens + settings
  Icon.tsx                  Lucide icon lookup + searchable categorized IconPicker (Food, Taxi, …)
lib/
  db.ts                     node:sqlite schema, revisions, FTS index, settings helpers
  content.ts                Rich-text sanitization + plain-text extraction
  security.ts               Same-origin guard + login rate limiting
  seed.ts                   First-run seed (transactional)
  auth.ts                   Session cookie helpers + role guards
  tokens.ts                 PAT create/verify/revoke + scope/role caps
  mcp.ts                    MCP tool registry and handlers
  pages.ts / comments.ts    Query helpers
  extensions.ts             Shared TipTap extension set
  images.ts                 Share-link → direct image URL resolver
proxy.ts                    Login redirect for visitors without a session cookie
scripts/
  changelog.js              Changelog/release management (see below)
AGENTS.md                    Version-matched Next.js guidance for coding agents
SECURITY.md                  Sign-in boundary and production checklist
```

## Public API and WebMCP

These read endpoints require a signed-in session (the same cookie as the website). Anonymous callers receive `401`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/public/search?q=...` | FTS5 search over published pages |
| `GET /api/public/pages/:id` | Read one published page as plain text |
| `GET /api/public/collections` | List collections and published page counts |
| `GET /api/public/recent?limit=10` | List recent published updates (maximum 20) |

The same endpoints power the four JavaScript-registered WebMCP tools. They work only when the site is open in a compatible browser with an active session. `/api/pages`, `/api/collections`, `/api/settings`, revisions, and all mutation routes remain session- and role-protected. Guests may use the read tools but cannot comment, edit, or open the admin panel.

## Personal access tokens and MCP

Create a token in **Admin → Access Tokens** (superadmin). Choose a name, expiry, and scopes, then copy the `xk_pat_…` secret once.

| Scope | Allows |
| --- | --- |
| `read:content` | search, read pages, list collections/pages, recent updates |
| `write:content` | create/update/delete pages; create collections |
| `read:comments` / `write:comments` | list comments; add or delete comments |
| `read:revisions` | list and restore revisions |
| `read:drafts` | include drafts in list/read |
| `admin:collections` | rename/update and delete collections |
| `admin:users` | manage users |
| `admin:settings` | get and update site settings |

Effective scopes are the intersection of the token’s scopes and the owner’s live role. Guests cannot mint tokens. Revoke a token anytime from the admin panel.

Connect an MCP client (Claude Code, Cursor, Claude Desktop remote MCP) to the Streamable HTTP endpoint:

```json
{
  "mcpServers": {
    "xinchuan": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer xk_pat_YOUR_TOKEN"
      }
    }
  }
}
```

Claude Code CLI:

```bash
claude mcp add --transport http xinchuan http://localhost:3000/api/mcp \
  --header "Authorization: Bearer xk_pat_YOUR_TOKEN"
```

The endpoint speaks MCP JSON-RPC (`initialize`, `tools/list`, `tools/call`). Replace `localhost:3000` with your HTTPS production origin.

## Design system

Light and dark paper-and-moss palettes, one sans-serif typeface (Inter), 1px hairlines, and restrained elevation shadows limited to floating menus. Brass is used for focus rings and underline-style markers (highlights, “edited” stamps); saturated color is reserved for active navigation, primary actions, and status feedback. Full token lists live in `app/globals.css` (`:root` and `[data-theme="dark"]`) and are shared with Tailwind through `tailwind.config.ts`.

## Changelog management

This project follows [Keep a Changelog](https://keepachangelog.com/) with [Semantic Versioning](https://semver.org/). All unreleased work accumulates under `## [Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md).

Handy npm scripts (wrappers around `scripts/changelog.js`, zero dependencies):

```bash
# append an entry to the Unreleased section
npm run changelog:add -- Added "Full-text search across collections"
# types: Added | Changed | Fixed | Removed (default: Changed)

# cut a release: bumps package.json version, stamps today's date,
# moves Unreleased items into the new version section
npm run changelog:release -- patch   # or: minor, major (default: patch)
```

**Workflow:** add a changelog line with every meaningful change; run `changelog:release` when cutting a deploy.
