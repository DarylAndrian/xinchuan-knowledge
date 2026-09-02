# Xinchuan Knowledge Center

A wiki-style knowledge base with a quiet, flat “paper and moss” aesthetic. Public reading pages, a rich-text admin editor, and Google Docs–style comments anchored to highlighted text.

## Features

- **Public reader (Catalogue)** — published pages are readable anonymously (toggleable in settings). Collection sidebar tree, breadcrumbs, generated table of contents, 68ch reading column.
- **Anchored comments** — select any text on a page to attach a comment thread to that exact passage. Comments appear as brass-underlined highlights with numbered indices; threads open in the right rail. Own comments can be deleted; admins can moderate any.
- **Admin editor (TipTap)** — headings, bold/italic/strike, bullet/numbered/to-do lists, callouts, code blocks, tables, dividers. Debounced autosave, draft/publish switch, page reparenting, page deletion, create pages and collections.
- **Roles** — `superadmin` > `admin` > `commentator`. Editors manage content; commentators comment; anonymous visitors read published pages.
- **Superadmin panel** — reached from the profile menu (avatar, top right): user management (create, change role, suspend, delete with last-superadmin protection) and site settings (site name, public viewing, open registration, comment approval).
- **Search** — keyword search over published page titles and content with context snippets.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + custom flat design system (CSS variables) |
| Icons | [Lucide](https://lucide.dev/) via `lucide-react` |
| Editor | [TipTap](https://tiptap.dev/) (StarterKit, tables, task lists) |
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

| Role | Email | Password |
| --- | --- | --- |
| Superadmin | `admin@xinchuan.local` | `xinchuan-admin` |
| Admin | `dana@xinchuan.local` | `xinchuan-admin` |
| Commentator | `mika@xinchuan.local` | `xinchuan-comment` |

Override the superadmin credentials on first seed via `.env.local`:

```env
SUPERADMIN_EMAIL=you@example.com
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
  admin/                    Superadmin panel (users + settings)
  api/                      auth, pages, collections, comments, users, settings
components/
  TopBar.tsx                Nav (Home / Catalogue / Editor) + profile menu
  CatalogueSidebar.tsx      Collection tree for the reader
  PageReader.tsx            Article + TOC + anchored comment threads
  EditorShell.tsx           TipTap editor, tree, inspector, autosave
  AdminPanel.tsx            Users/roles table + site settings
  Icon.tsx                  Lucide icon lookup by name
lib/
  db.ts                     node:sqlite singleton, schema, settings helpers
  seed.ts                   First-run seed (transactional)
  auth.ts                   Session cookie helpers + role guards
  pages.ts / comments.ts    Query helpers
  extensions.ts             Shared TipTap extension set
scripts/
  changelog.js              Changelog/release management (see below)
```

## Design system

Flat paper-and-moss palette, one sans-serif typeface (Inter), no shadows or pill badges, 1px hairlines. Brass is used for underline-style markers (highlights, “edited” stamps) — saturated color only on active nav items and callouts. Full token list lives in `app/globals.css` (`:root`) and `tailwind.config.ts`.

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
