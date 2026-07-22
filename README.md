# [👉 Visit PictoTree.eu](https://pictotree.eu)

## 🌟 Overview
**PictoTree** is a comprehensive and flexible platform designed for **Augmentative and Alternative Communication (AAC)**. Aiming to foster connection, it empowers communication partners to build personalized pictogram trees, supporting individuals with diverse communication and accessibility needs.

More information here 👉 [PictoTree.eu](https://pictotree.eu) 

This repository contains the **Web Backend & Dashboard** (built with Flask). It works in tandem with our **Native Android App**, which provides a unique spatial navigation interface for the end-user:

### 📱 [Get the Android App here (PictoTreeApp)](https://github.com/Gotlub/pictotreeApp)

---

### ⚠️ Project Status: Alpha
This project is currently in the **Alpha stage** and under active development. Features are subject to change. Contributions and feedback are highly welcome!

**License:** GNU AGPL v3 (See [LICENSE](LICENSE) file for details).

---

## 🛠 Technical Stack
- **Backend:** Python 3.11+ / [Flask](https://flask.palletsprojects.com/) / Gunicorn
- **Database:** PostgreSQL 15 (Alpine)
- **Frontend:** HTML5 / Bootstrap 5 / Treant.js / Vanilla JS
- **Containerization:** Docker & Docker Compose
- **Internationalization (i18n):** [Flask-Babel](https://python-babel.github.io/flask-babel/)
- **Testing:** [Pytest](https://docs.pytest.org/)

---

## 🐳 Docker Deployment & Makefile Commands

A single production-ready Docker setup is used across environments (`docker-compose.yml`), featuring an optimized `python:3.11-slim` image, Gunicorn server, PostgreSQL 15 (capped at 512MB RAM), and persistent named volumes.

### Quick Start with Docker

```bash
# 1. Build and launch containers in background
make up

# 2. Apply database migrations
make upgrade

# 3. Create the demo account (for unauthenticated mode)
make user U=DEMO_USERNAME E=demo@demo.demo P="yourpassword"

# 4. (Optional) Create an admin account
make user U=admin E=admin@pictotree.eu P="Password123!"

# 5. Import initial public pictograms & thumbnails
make add-img
```

*Direct Docker Compose command equivalent:*
```bash
docker compose up -d --build
```

### Summary of Makefile Commands

| Command | Description |
| :--- | :--- |
| `make up` | Build and start Docker containers in background (`docker compose up -d --build`) |
| `make build` | Rebuild Docker images without cache (`docker compose build --no-cache`) |
| `make down` | Stop and remove Docker containers (`docker compose down`) |
| `make restart` | Restart Docker containers |
| `make logs` | View live container logs (`docker compose logs -f`) |
| `make user [U=.. E=.. P=..]` | Manually create a user (bypassing SMTP email confirmation) |
| `make add-img` | Scan and import public pictograms & generate thumbnails |
| `make upgrade` | Apply Flask database migrations (`flask db upgrade`) |
| `make migrate [M="..."]` | Generate a new Flask database migration (`flask db migrate`) |
| `make bash` | Open a `bash` shell inside the `web` container |
| `make db-bash` | Open a `psql` shell inside the `db` PostgreSQL container |
| `make test` | Run the Pytest suite inside the `web` container |

---

## 👤 Unauthenticated / Demo Mode (`DEMO_USERNAME`)

PictoTree supports an **Unauthenticated / Demo Mode** allowing offline users or visitors without an active login session to browse public profiles and pictogram trees.

- When a user accesses the builder or profiles without logging in, the application automatically loads profiles and trees belonging to the user specified by `DEMO_USERNAME`.

To set up the demo account:
```bash
make user U=DEMO_USERNAME E=demo@demo.demo P="DemoPassword123!"
```

---

## 💻 Local Setup (Without Docker - Optional)

### 1. Create Virtual Environment
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Database Setup & Run
```bash
flask db upgrade
flask run
```
The dashboard will be available at `http://127.0.0.1:5000`.

---

## 🛠 Development Workflow & Quality Control

To maintain code quality, please run linting and tests before committing:

```bash
# Run tests inside Docker
make test

# Or run locally
pytest -v

# Python linting
ruff check .

# JavaScript linting
npx eslint .
```

---

## 🌐 Internationalization (i18n)

The project supports multiple languages (`de`, `es`, `fr`, `it`, `nl`, `pl`). To update translations:

```bash
# Extract strings
pybabel extract -F babel.cfg -k _l -o messages.pot .

# Update existing catalogs
pybabel update -i messages.pot -d app/translations

# Compile binary catalogs
pybabel compile -d app/translations
```
