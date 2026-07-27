# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
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
