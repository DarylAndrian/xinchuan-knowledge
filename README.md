# Xinchuan Knowledge Center

A wiki-style knowledge base with a quiet, flat “paper and moss” aesthetic. Public reading pages, a rich-text admin editor, and Google Docs–style comments anchored to highlighted text.

Current version: **1.1.3** — see [CHANGELOG.md](./CHANGELOG.md).

## Features

- **Public reader (Catalogue)** — published pages are readable anonymously (toggleable in settings). Collection sidebar tree, breadcrumbs, generated table of contents, 68ch reading column.
- **Anchored comments** — select any text on a page to attach a comment thread to that exact passage. Comments appear as brass-underlined highlights with numbered indices; threads open in the right rail. Own comments can be deleted; admins can moderate any.
- **Admin editor (TipTap)** — headings, bold/italic/strike, bullet/numbered/to-do lists, links, image embeds (direct URLs; Google Drive/Dropbox share links auto-converted), callouts, code blocks, tables, dividers — all styled to match the published catalogue page. Debounced autosave, draft/publish switch, page reparenting, editable URL slugs, page deletion, create pages and collections.
- **Roles** — `superadmin` > `admin` > `commentator`. Editors manage content; commentators comment; anonymous visitors read published pages.
- **Superadmin panel** — reached from the profile menu (avatar, top right): user management (create, change role, suspend, delete with last-superadmin protection), collection management (rename, description, [Lucide](https://lucide.dev/icons) icon picker, delete), and site settings (site name, public viewing, open registration, comment approval). Collections can also be managed from the Editor sidebar via the `...` action menu.
- **Search** — keyword search over published page titles and content with context snippets.
- **Version badge** — the current app version (from `package.json`) is shown small at the top right of the nav bar.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
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
  api/                      auth, pages, collections (incl. [id] PATCH/DELETE), comments, users, settings
components/
  TopBar.tsx                Nav (Home / Catalogue / Editor) + profile menu + version badge
  CatalogueSidebar.tsx      Collection tree for the reader
  PageReader.tsx            Article + TOC + anchored comment threads
  EditorShell.tsx           TipTap editor, tree, inspector, autosave, collection editing
  AdminPanel.tsx            Users/roles table + collections + site settings
  Icon.tsx                  Lucide icon lookup by name + IconPicker grid
lib/
  db.ts                     node:sqlite singleton, schema, settings helpers
  seed.ts                   First-run seed (transactional)
  auth.ts                   Session cookie helpers + role guards
  pages.ts / comments.ts    Query helpers
  extensions.ts             Shared TipTap extension set
  images.ts                 Share-link → direct image URL resolver
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
