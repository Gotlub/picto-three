# OpenCode Agent Instructions

This repository is a Flask application (Web Backend & Dashboard) with a Vanilla JS frontend, functioning as an Augmentative and Alternative Communication (AAC) platform.
Environnement Windows : use Powershell. 

## Architecture & Data Storage Quirks
- **External Data Directory (CRITICAL):** The SQLite database (`app.db`) and uploaded images (`pictograms/`, `pictogramsmin/`) are NOT stored in the repository. They are stored in a **sibling directory** to the project root: `../data/`. (Configured in `config.py`). Do not attempt to read or write the database or uploads in the project root.
- **Frontend Stack:** Vanilla JS, Bootstrap 5, Treant.js, and jQuery. There is **no frontend build step** (no Webpack, Vite, etc.).
- **Backend Stack:** Python 3.10+, Flask, SQLAlchemy.

## Developer Commands
- **Testing:** `pytest -v` (Must pass completely before committing)
- **Python Linting:** `ruff check .`
- **JavaScript Linting:** `npx eslint .` (Ignores `app/static/js/lib/**/*.js`)
- **Run Dev Server:** `flask run`

## Database Migrations (Flask-Migrate)
- Generate a migration: `flask db migrate -m "Description"`
- Apply a migration: `flask db upgrade`

## Internationalization (i18n)
The project uses Flask-Babel. If you add or modify translatable strings, update the translations:
1. `pybabel extract -F babel.cfg -k _l -o messages.pot .`
2. `pybabel update -i messages.pot -d app/translations`
3. `pybabel compile -d app/translations`

## Workflow & Conventions (Preserved from original instructions)
- **Task Tracking:** Always update `TODO.md` by checking off completed tasks (`- [x]`).
- **Changelog:** Add an entry to `CHANGELOG.md` under `[Unreleased]` for every completed feature or fix.
- **Commit Format:** Use Conventional Commits (e.g., `feat: add user registration`, `fix: correct image path`).
- **Blockers:** If hopelessly blocked, document the issue in a `BLOCKER.md` file rather than guessing.
- **Tests:** Never commit code that fails the test suite. Update tests in `tests/` to cover new code.
