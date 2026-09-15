# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **ARASAAC Search Upgrade & Multi-mode Intelligence** (`app/static/js/components/ArasaacSearch.js`):
  - Added multi-criteria search modes: "Pertinence" (Smart ranking), "Exact" (Bestsearch / "Est"), "Commence par" (Prefix matching), and "Contient" (Substring matching).
  - Added on-the-fly language selector dropdown (`FR`, `EN`, `ES`, `DE`, `IT`, `PT`) initialized automatically by default from the user's session locale (`window.CURRENT_LOCALE || 'fr'`).
  - Replaced arbitrary alphabetical sorting with relevance-aware ranking (`filterAndRankPictograms`), ensuring relevant pictograms appear at the top.
  - Implemented keyword matching (`findBestMatchingKeyword`) so the result title and Drag & Drop payload accurately display the searched concept rather than an arbitrary first synonym.
  - Added display of secondary synonyms as muted subtitle tags to clarify pictogram concepts.
  - Added comprehensive unit test suite in `tests/unit/arasaac_search.test.js` (10 passing tests), bringing the project JS unit tests total to 49 passing tests.
- **Phase 3.2 - Modularization & Hardening of `builder.js`**:
  - `BuilderNode.js` (`app/static/js/components/BuilderNode.js`): Isolated tree canvas node component handling DOM element generation, hover tooltips, visual drag feedback, image fallback, and secure image URL resolution.
  - `BinderManager.js` (`app/static/js/components/BinderManager.js`): Component handling binder/profile composition, drag-and-drop tree reordering with real-time numeric indicators (`1.`, `2.`, ...), color palette selection (6 unified hex colors), avatar modal and picker, and API persistence via `ApiClient`.
  - `TreePdfExporter.js` (`app/static/js/services/TreePdfExporter.js`): Dedicated service handling SVG cloning, styles and image inlining via canvas data URLs, and jsPDF vector export.
  - Refactored `builder.js` from 2 104 lines down to ~640 lines, focused solely on orchestrating the interactive tree canvas, Treant visualization modal, pan/zoom, and tab/accordion synchronization.
  - Cybersecurity hardening (Astra audit preparation): eliminated unescaped innerHTML injections, replaced HTML entities with safe Unicode glyphs (`\u22EE`, `\u2715`), enforced safe URL schemes (`http:`, `https:`, `/pictograms...`), and protected against malicious `javascript:` pseudo-protocols.
  - Added unit test suites `builder_node.test.js`, `binder_manager.test.js`, and `tree_pdf_exporter.test.js`, bringing JS unit test count to 39 passing tests.
- **Phase 3.1 - Modularization of `list.js`**:
  - `ListPdfExporter.js` (`app/static/js/services/ListPdfExporter.js`): Service handling print settings, responsive zoom, tab-accordion synchronization, mathematical grid/chain pagination, DOM preview rendering, and jsPDF vector export.
  - `ReadOnlyTreeViewer.js` (`app/static/js/components/ReadOnlyTreeViewer.js`): Visualizer component handling tree hierarchy rendering, branch and single-node selection, and drag-and-drop payload generation.
  - `ChainedListManager.js` (`app/static/js/components/ChainedListManager.js`): Component handling sequential list items, smooth horizontal scrolling, DnD reordering with live drop indicator, real-time text description editing, and local image file imports.
  - Refactored `list.js` from ~1 562 lines to 328 lines as a clean, focused orchestrator.
  - Added unit test suites `tests/unit/list_pdf_exporter.test.js` and `tests/unit/chained_list_manager.test.js`, bringing JS unit test count to 31 passing tests.
- **Phase 2 - Shared Transverse Modules**:
  - `ApiClient.js` (`app/static/js/services/ApiClient.js`): Centralized HTTP `fetch` client with automatic CSRF token extraction (`input[name="csrf_token"]` or `<meta name="csrf-token">`), automatic JSON serialization for mutating methods (`POST`, `PUT`, `DELETE`), and unified `ApiClientError` handling.
  - `NotificationService.js` (`app/static/js/services/NotificationService.js`): Unified notification and confirmation wrapper while preserving native browser dialog contracts (`alert`, `confirm`) required by Playwright E2E tests (`page.waitForEvent('dialog')`).
  - `DomUtils.js` (`app/static/js/utils/DomUtils.js`): Utilities for XSS mitigation (`escapeHtml`), declarative DOM element creation (`createElement`), and query helpers (`qs`, `qsa`).
  - Unit tests for `ApiClient`, `NotificationService`, and `DomUtils` (`tests/unit/api_client.test.js`, `tests/unit/notification_service.test.js`, `tests/unit/dom_utils.test.js`), bringing JS unit test count to 26 passing tests.
- Strengthened ESLint configuration (`eslint.config.mjs`) with strict `no-unused-vars` (ignoring `^_`), `no-undef`, and debug `console.log` warnings.
- Cleaned up dead code and orphaned debug logs in `builder.js`, `list.js`, and `pictogram_bank.js`.
- Integrated `ApiClient` and `NotificationService` across `builder.js` and `list.js` for tree/list/profile persistence, tree loading, and deletion.
- Added JavaScript unit test suite using Node.js native test runner (`node --test tests/unit/**/*.test.js`) testing pure tree composite logic (`TreeModel`, `TreeNode`, cycle prevention, move, remove) and list logic (`ListModel`, `ListItem`, pagination, reordering).
- Integrated JavaScript unit tests into CI workflow (`.github/workflows/flask-review.yml`) and Makefile (`make test-js`, integrated into `make test`).
- Updated `AGENTS.md` to require running and passing the full test suite (`make test`) before any commit.
- Added 11th E2E test journey (`tests/e2e/regression.spec.ts`) validating tree branch reorganization via Drag & Drop, client-side cycle rejection alert, branch deletion, and backend tree persistence/reloading with disposable seeded data.
- Added full testing and linting chain in `Makefile` (`make test`) running `ruff check .`, `npx eslint .`, unit JS tests, unit/integration `pytest -v`, and Playwright E2E tests (`bash tests/e2e/run.sh`) sequentially, as well as modular targets (`make lint`, `make lint-py`, `make lint-js`, `make test-js`, `make pytest`, `make e2e`).

### Fixed
- Fixed stray notch/mark in tree visualizer modal and PDF vector export:
  - Treant.js collapse-switch element (`.collapse-switch`) at top-right of tree nodes was disabled (`collapsable: false` in `builder.js` and hidden in `custom.css`).
  - Enhanced vector node rectangle rendering in `TreePdfExporter.js` with rounded corners (`rx="6" ry="6"`), clean `#b0b0b0` borders, and explicit connector path stroke styles.
- Fixed list saving edge cases and race conditions on `/list` (`app/static/js/list.js`, `app/templates/list.html`):
  - Initialized `userLists`, `publicLists`, `userTrees`, `publicTrees`, and `currentUserId` in `ListBuilder` constructor, preventing `TypeError: Cannot read properties of undefined (reading 'find')` if saving before list fetch finishes.
  - Added immediate user ID resolution via DOM metadata (`#current-user-meta[data-user-id]`) in `list.html` to eliminate race condition where `this.currentUserId` was unset.
  - Guarded translation lookups with fallbacks (`window.translations?.accountRequired`) and unified modal/dialog calls with `NotificationService`.
  - Rebuilt and restarted the development/production Docker container (`web`) ensuring changes are actively served.
- Fixed List save blocker on client-side: removed dependency on missing `#list-is-public` element in `ListBuilder.saveList` (`list.js`) which caused a `TypeError: Cannot read properties of null (reading 'checked')`.
- Cleaned up `is_public` handling in backend API (`app/routes/api.py`) to leverage model defaults properly.
- Updated Playwright E2E smoke test 4 (`tests/e2e/smoke.spec.ts`) and documentation (`tests/e2e/README.md`) from expecting a save failure to verifying the full nominal save, confirmation alert, and UI reload/re-render flow.

- Extended E2E coverage to ten journeys (tree drag/drop and overwrite, binder persistence, image lifecycle and List/PDF), moved the disposable stack to migrated PostgreSQL 15, and added an independent E2E job with diagnostics to the push workflow. Application refactoring remains gated on human test validation.
- Added an initial isolated Docker/Playwright smoke suite with five browser journeys, disposable SQLite/images, CSRF-enabled fake users, locked test dependencies and diagnostics. The List save defect is characterized without changing application code.
- Add github workflows
- Add Makefile for Docker container management commands (`user`, `add-img`, `bash`, `db-bash`, `up`, `build`, etc.)
- Optimized production Dockerfile using Python 3.11-slim, Gunicorn, system dependencies (libmagic1, libpq-dev), non-root user, and sealed source code.
- Unified `docker-compose.yml` with PostgreSQL memory limit (512MB RAM), healthcheck, and named volumes (`postgres_data`, `pictograms_data`).
- Configured `DEMO_USERNAME` environment variable for unauthenticated / demo mode support.
- Updated `README.md` with complete Docker deployment guide, Makefile command reference, and Demo mode documentation.

### Fixed
- Updated SMTP configuration to support Brevo by separating `MAIL_USERNAME` (auth) from `MAIL_DEFAULT_SENDER` (sender address).
- Fixed `/data` permission error (`[Errno 13] Permission denied: '/data'`) in Docker deployments by introducing configurable `DATA_DIR` environment variable defaulting to `/app/data` in Docker container and `../data` in local environments.

### Changed
- Externalized the database to a sibling `data/` directory (`../data/`) to fully separate data from application code, improving deployment and security.

### Added
- Initial project structure and documentation for agent-driven development.
- Configuration files: `README.md`, `AGENTS.md`, `GEMINI.md`, `TESTING.md`, `TODO.md`, `CHANGELOG.md`.

## [0.1.0] - YYYY-MM-DD
- Initial release.  
