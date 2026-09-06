# Xinchuan Knowledge Center

A wiki-style knowledge base with a quiet, flat “paper and moss” aesthetic. Public reading pages, a rich-text admin editor, and Google Docs–style comments anchored to highlighted text.

Current version: **1.4.0** — see [CHANGELOG.md](./CHANGELOG.md).

## Features

- **Public reader (Catalogue)** — published pages are readable anonymously (toggleable in settings). Collection sidebar tree, breadcrumbs, generated table of contents, 68ch reading column, and a touch-friendly mobile page drawer.
- **Anchored comments** — select any text on a page to attach a comment thread to that exact passage. Comments appear as brass-underlined highlights with numbered indices; threads open in the right rail. Own comments can be deleted; admins can moderate any.
- **Admin editor (TipTap)** — headings, bold/italic/strike, bullet/numbered/to-do lists, links, image embeds (direct URLs; Google Drive/Dropbox share links auto-converted), callouts, code blocks, tables, dividers — all styled to match the published catalogue page. Debounced autosave, draft/publish switch, page reparenting, editable URL slugs, page deletion, and responsive page/collection management.
- **Revision history** — content, title, icon, and status snapshots are recorded automatically. Editors can inspect the latest 50 revisions and restore an earlier version; the restore itself creates a new revision so history remains recoverable.
- **Light and dark themes** — follows the system preference on first visit, supports a persistent manual toggle in the top bar, and themes native controls and editor content consistently.
- **Roles** — `superadmin` > `admin` > `commentator`. Editors manage content; commentators comment; anonymous visitors read published pages.
- **Superadmin panel** — reached from the profile menu (avatar, top right): sticky section navigation; user management with compact action menus (create, change role, suspend, delete with last-superadmin protection); collection management (rename, description, [Lucide](https://lucide.dev/icons) icon picker, delete); and site settings (site name, public viewing, open registration, comment approval). Collections can also be managed from the Editor sidebar via the `...` action menu.
- **Full-text search** — SQLite FTS5 search over published titles and article text, with relevance ranking, prefix matching, and context snippets.
- **Read-only WebMCP** — compatible agents visiting the public site can search, read a published page, list collections, and inspect recent updates. The tools use the same anonymous published-content boundary as the website and never require a PAT or expose write operations.
- **Hardened API boundary** — internal bulk/draft APIs require editor roles; dedicated anonymous APIs expose only published content. Rich text is allowlist-sanitized, browser mutations are same-origin checked, sign-in attempts are throttled, session cookies are secure in production, and baseline security headers are enabled. See [SECURITY.md](./SECURITY.md).
- **Version badge** — the current app version (from `package.json`) is shown small at the top right of the nav bar.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS + custom flat design system (CSS variables) |
| Icons | [Lucide](https://lucide.dev/) via `lucide-react` |
| Editor | [TipTap](https://tiptap.dev/) (StarterKit, links, images, tables, task lists) |
| Database | SQLite via Node's built-in `node:sqlite` (no native deps), stored at `data/xinchuan.db` |
| Auth | Hand-rolled cookie sessions + `bcryptjs` |

## Getting started

Requires **Node.js 22.5+** (uses `node:sqlite`).

```bash
npm install
npm run dev
# open http://localhost:3000
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

Override the superadmin credentials on first seed via `.env.local`:

```env
SUPERADMIN_USERNAME=your-username
SUPERADMIN_PASSWORD=your-password
```

## Project structure

```
app/
  page.tsx                  Home
  login/                    Sign-in form
  search/                   Search results
  catalogue/                Reader index + [...path] page renderer
  editor/                   Admin editor workspace
  admin/                    Superadmin panel (users + collections + settings)
  api/                      guarded authoring APIs + narrow public read APIs
components/
  TopBar.tsx                Nav + theme toggle + profile menu + version badge
  WebMCPTools.tsx           Anonymous, read-only site-tool registrations
  ThemeToggle.tsx           Persistent light/dark theme control
  CatalogueSidebar.tsx      Collection tree for the reader
  PageReader.tsx            Article + TOC + anchored comment threads
  EditorShell.tsx           TipTap editor, tree, inspector, autosave, collection editing
  AdminPanel.tsx            Sticky admin nav + users/roles actions + collections + settings
  Icon.tsx                  Lucide icon lookup by name + IconPicker grid
lib/
  db.ts                     node:sqlite schema, revisions, FTS index, settings helpers
  content.ts                Rich-text sanitization + plain-text extraction
  security.ts               Same-origin guard + login rate limiting
  seed.ts                   First-run seed (transactional)
  auth.ts                   Session cookie helpers + role guards
  pages.ts / comments.ts    Query helpers
  extensions.ts             Shared TipTap extension set
  images.ts                 Share-link → direct image URL resolver
scripts/
  changelog.js              Changelog/release management (see below)
AGENTS.md                    Version-matched Next.js guidance for coding agents
SECURITY.md                  Public/private boundary and production checklist
```

## Public API and WebMCP

Anonymous access is intentionally limited to published content:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/public/search?q=...` | FTS5 search over published pages |
| `GET /api/public/pages/:id` | Read one published page as plain text |
| `GET /api/public/collections` | List collections and published page counts |
| `GET /api/public/recent?limit=10` | List recent published updates (maximum 20) |

The same endpoints power the four JavaScript-registered WebMCP tools. They work only when the site is open in a compatible browser and `public_viewing` is enabled. `/api/pages`, `/api/collections`, `/api/settings`, revisions, and all mutation routes remain session- and role-protected.

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
