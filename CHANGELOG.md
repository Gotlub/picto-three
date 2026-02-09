# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Add github workflows

### Fixed
- Updated SMTP configuration to support Brevo by separating `MAIL_USERNAME` (auth) from `MAIL_DEFAULT_SENDER` (sender address).

### Changed
- Externalized the database to a sibling `data/` directory (`../data/`) to fully separate data from application code, improving deployment and security.

### Added
- Initial project structure and documentation for agent-driven development.
- Configuration files: `README.md`, `AGENTS.md`, `GEMINI.md`, `TESTING.md`, `TODO.md`, `CHANGELOG.md`.

## [0.1.0] - YYYY-MM-DD
- Initial release.  
