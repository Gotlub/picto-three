# OpenCode Agent Instructions

This repository is a Flask application (Web Backend & Dashboard) with a Vanilla JS frontend, functioning as an Augmentative and Alternative Communication (AAC) platform.
Environnement Windows : use Powershell. 

## Architecture & Data Storage Quirks
- **External Data Directory (CRITICAL):** The SQLite database (`app.db`) and uploaded images (`pictograms/`, `pictogramsmin/`) are NOT stored in the repository. They are stored in a **sibling directory** to the project root: `../data/`. (Configured in `config.py`). Do not attempt to read or write the database or uploads in the project root.
- **Frontend Stack:** Vanilla JS, Bootstrap 5, Treant.js, and jQuery. There is **no frontend build step** (no Webpack, Vite, etc.).
- **Backend Stack:** Python 3.10+, Flask, SQLAlchemy.

## Developer Commands
- **Full Test Suite:** `make test` (Executes Ruff, ESLint, JS unit tests, Pytest, and Playwright E2E - MUST pass completely before committing)
- **Unit & Integration Tests (Python):** `pytest -v`
- **Unit Tests (JavaScript):** `npm test` (or `make test-js`)
- **Python Linting:** `ruff check .` (or `make lint-py`)
- **JavaScript Linting:** `npx eslint .` (or `make lint-js`, ignores `app/static/js/lib/**/*.js`)
- **E2E Tests:** `make e2e` (or `npm run e2e`)
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
- **Tests:** Chaque modification doit passer l'ensemble de la suite de validation (`make test`). Ne jamais commiter de code qui échoue aux tests. Mettre à jour les tests dans `tests/` pour couvrir tout nouveau code.
