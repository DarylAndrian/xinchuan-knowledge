# Changelog

All notable changes to **Xinchuan Knowledge Center** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Manage entries with the npm scripts (see README → Changelog management):

```bash
npm run changelog:add -- Added "Description of the change"
npm run changelog:release -- patch
```

## [Unreleased]

## [1.4.0] - 2026-09-07

### Added

- Automatic page revision history with editor attribution, five-minute autosave coalescing, a 50-entry history viewer, and recoverable revision restores
- SQLite FTS5 index for relevance-ranked, prefix-aware search over published page titles and content
- Anonymous read-only WebMCP tools for published-page search, page reading, collection listing, and recent updates, backed by narrow public JSON endpoints and requiring no PAT
- Production security headers, same-origin mutation enforcement, login attempt throttling, secure production cookies, and allowlist HTML sanitization
- Security-supported Next.js 16 and TipTap 3 dependency lines, replacing advisory-affected framework versions

### Changed

- Internal page, collection, comment, and settings APIs now enforce explicit reader/editor boundaries while the published website remains publicly accessible
- Responsive top navigation now collapses into an accessible mobile menu; the Catalogue gains a mobile page drawer and the editor exposes navigation and settings on small screens
- Article table-of-contents and comment rails move below the article at narrower widths instead of disappearing
- Public search now uses normalized article text rather than matching raw HTML

### Fixed

- Page moves now validate collection ownership and prevent recursive parent cycles
- Deleting a page tree or collection now also clears its FTS rows
- Catalogue index no longer redirects anonymous readers to a draft when a collection has no published root page

## [1.3.0] - 2026-09-06

### Added

- Accessible light/dark theme toggle with system-preference detection, persisted preference, native control theming, and WCAG AA contrast

### Changed

- Users & Roles row actions now use a compact icon dropdown with action icons, outside-click dismissal, Escape support, and arrow-key navigation
- Theme colors now share the same CSS design tokens across custom styles and Tailwind utilities

### Fixed

- Superadmin sidebar now remains sticky while scrolling, highlights the visible section, and becomes a sticky horizontal navigation bar on smaller screens

## [1.2.0] - 2026-09-05

### Changed

- User accounts keyed by username instead of email (schema migration renames the column; login/create-user/APIs updated)

### Fixed

- 500 error when deleting a user who had edited pages (FK violation on pages.updated_by - now cleared in a transaction)

## [1.1.3] - 2026-09-05

### Fixed

- Auto-deploy runs next build with NODE_ENV=production so Next.js no longer exits 1 on the non-standard NODE_ENV warning

## [1.1.2] - 2026-09-05

### Fixed

- Auto-deploy installs devDependencies (NODE_ENV scrub + --include=dev) so production builds no longer fail on missing tailwindcss
- Editor headings, lists, tables, quotes, code blocks and dividers now display correctly (styles were only applied on published pages)
- Catalogue lists show bullets and numbers again (Tailwind preflight had stripped list styles)

## [1.1.1] - 2026-09-05

### Changed

- Collection sidebar actions collapsed into a ... menu with dropdown (New page, Edit/Delete for superadmins)

### Fixed

- Harden auto-deploy: fetch+reset --hard (lock-file drift no longer jams deploys), fresh .next cache each build, null-guard usePathname type error
- Title autosave no longer saves the one-keystroke-behind state; pending saves flush before switching pages

## [1.1.0] - 2026-09-05

### Added

- Editable page URL slugs in the Editor inspector (Page settings), with collision detection
- Hyperlinks and image embeds in the editor (new toolbar buttons, auto-converted Drive/Dropbox links, links open in a new tab)

### Fixed

- Page slug auto-regeneration is now deduplicated and no longer overwrites customized slugs on title autosave

## [1.0.1] - 2026-09-04

### Added

- Superadmin collection management: rename, description, Lucide icon picker, and delete (Editor sidebar + Admin panel), with PATCH/DELETE /api/collections/[id]
- App version badge (v1.0.1) in the top bar, sourced from package.json

### Changed

- Expanded Lucide icon set (49 icons) with shared IconPicker used for collections

## [0.1.1] - 2026-09-03

### Added

- README, CHANGELOG, and changelog npm scripts (changelog:add / changelog:release)

## [0.1.0] - 2026-09-03

### Added

- Initial release of the Xinchuan Knowledge Center wiki.
- Public Catalogue reader: collection sidebar tree, breadcrumbs, 68ch reading column, auto-generated table of contents.
- Google Docs–style anchored comments: select text to comment, brass-underlined highlights with numbered indices, threaded replies in the right rail, soft-delete moderation.
- Admin Editor: TipTap rich-text editing (headings, lists, to-dos, callouts, code blocks, tables, dividers), debounced autosave, draft/publish workflow, page reparenting, page and collection creation, page deletion.
- Role model: superadmin > admin > commentator, with per-page and per-API guards.
- Superadmin panel (via profile menu): user creation, role assignment, suspend/delete with last-superadmin protection, site settings (site name, public viewing, open registration, comment approval).
- Email/password authentication with 30-day cookie sessions (bcrypt-hashed passwords).
- Keyword search over published pages with context snippets.
- Flat “paper and moss” design system: canvas/surface/ink/moss/brass/brick tokens, Inter typeface, hairline dividers, Lucide icons, no shadows or pill badges.
- SQLite storage via Node's built-in `node:sqlite`; transactional first-run seed with sample collections, pages (incl. Deployment Checklist and Payment Options), users, and comment threads.
- README and Keep a Changelog-based changelog management (`scripts/changelog.js`).
