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
