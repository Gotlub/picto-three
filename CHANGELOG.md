# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Added JavaScript unit test suite using Node.js native test runner (`node --test tests/unit/**/*.test.js`) testing pure tree composite logic (`TreeModel`, `TreeNode`, cycle prevention, move, remove) and list logic (`ListModel`, `ListItem`, pagination, reordering).
- Integrated JavaScript unit tests into CI workflow (`.github/workflows/flask-review.yml`) and Makefile (`make test-js`, integrated into `make test`).
- Updated `AGENTS.md` to require running and passing the full test suite (`make test`) before any commit.
- Added 11th E2E test journey (`tests/e2e/regression.spec.ts`) validating tree branch reorganization via Drag & Drop, client-side cycle rejection alert, branch deletion, and backend tree persistence/reloading with disposable seeded data.
- Added full testing and linting chain in `Makefile` (`make test`) running `ruff check .`, `npx eslint .`, unit JS tests, unit/integration `pytest -v`, and Playwright E2E tests (`bash tests/e2e/run.sh`) sequentially, as well as modular targets (`make lint`, `make lint-py`, `make lint-js`, `make test-js`, `make pytest`, `make e2e`).

### Fixed
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
