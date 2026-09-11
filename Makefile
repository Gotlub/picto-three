# Options et paramètres par défaut
U ?= admin_test
E ?= admin@pictotree.local
P ?= Password123!
M ?= Migration

.PHONY: help user add-img bash db-bash build up down restart logs lint lint-py lint-js test-js pytest e2e test migrate upgrade

help:
	@echo "Commandes disponibles :"
	@echo "  make build                                           - Builder les images Docker (sans cache)"
	@echo "  make up                                              - Démarrer les conteneurs Docker (avec build si nécessaire)"
	@echo "  make down                                            - Arrêter les conteneurs Docker"
	@echo "  make restart                                         - Redémarrer les conteneurs Docker"
	@echo "  make logs                                            - Afficher les logs des conteneurs"
	@echo "  make user [U=username] [E=email] [P=password]        - Créer un compte administrateur"
	@echo "  make add-img                                         - Scanner et ajouter les pictogrammes/miniatures d'exemple"
	@echo "  make bash                                            - Ouvrir un terminal bash dans le conteneur Flask"
	@echo "  make db-bash                                         - Ouvrir psql dans le conteneur Postgres"
	@echo "  make lint-py                                         - Lancer l'analyse statique Python (ruff check .)"
	@echo "  make lint-js                                         - Lancer l'analyse statique JavaScript (npx eslint .)"
	@echo "  make lint                                            - Lancer les linters Python et JS"
	@echo "  make test-js                                         - Exécuter les tests unitaires JS (Node test runner)"
	@echo "  make pytest                                          - Exécuter la suite de tests unitaires/intégration Python (pytest)"
	@echo "  make e2e                                             - Exécuter la suite de tests E2E (Playwright Chromium/Postgres)"
	@echo "  make test                                            - Exécuter toute la chaîne : linters, tests unitaires JS/Python et E2E"
	@echo "  make migrate [M=\"message\"]                          - Générer une migration Flask-Migrate"
	@echo "  make upgrade                                         - Appliquer les migrations de base de données"

# Utilisation : make user U=toto E=toto@mail.com P=mdp
user:
	docker compose exec web python create_admin.py $(U) $(E) "$(P)"

# Scanner et générer les pictogrammes et miniatures de test
add-img:
	docker compose exec web python add_test_images.py

# Ouvrir un terminal dans le conteneur Flask (pratique pour débugger)
bash:
	docker compose exec web bash

# Ouvrir un terminal dans le conteneur Postgres (pour fouiller la BDD)
db-bash:
	docker compose exec db psql -U postgres -d pictotree

# Commandes usuelles Docker
build:
	docker compose build --no-cache

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

# Qualité de code et Linters
lint-py:
	@echo "==> Linter Python (Ruff)..."
	@command -v ruff >/dev/null 2>&1 && ruff check . || .venv/bin/ruff check .

lint-js:
	@echo "==> Linter JavaScript (ESLint)..."
	npx eslint .

lint: lint-py lint-js

# Tests
test-js:
	@echo "==> Tests unitaires JavaScript (Node test runner)..."
	npm test

pytest:
	@echo "==> Tests unitaires & intégration Python (Pytest)..."
	docker compose exec web pytest -v

e2e:
	@echo "==> Tests end-to-end (Playwright)..."
	bash tests/e2e/run.sh

test:
	@echo "=================================================="
	@echo "==> [1/5] Analyse statique Python (Ruff)..."
	@echo "=================================================="
	@command -v ruff >/dev/null 2>&1 && ruff check . || .venv/bin/ruff check .
	@echo "=================================================="
	@echo "==> [2/5] Analyse statique JavaScript (ESLint)..."
	@echo "=================================================="
	npx eslint .
	@echo "=================================================="
	@echo "==> [3/5] Tests unitaires JavaScript (Node test)..."
	@echo "=================================================="
	npm test
	@echo "=================================================="
	@echo "==> [4/5] Tests unitaires & intégration Python (Pytest)..."
	@echo "=================================================="
	docker compose exec web pytest -v
	@echo "=================================================="
	@echo "==> [5/5] Tests End-to-End (Playwright)..."
	@echo "=================================================="
	bash tests/e2e/run.sh
	@echo "=================================================="
	@echo "🎉 Succès : Tous les linters et tests sont passés !"
	@echo "=================================================="

migrate:
	docker compose exec web flask db migrate -m "$(M)"

upgrade:
	docker compose exec web flask db upgrade


# ⚠️ DANGER : Détruit les conteneurs ET supprime tous les volumes (BDD + Images)
reset:
	@echo "🧨 Destruction de l'environnement et des volumes de données..."
	docker compose down -v
	@echo "🌱 Reconstruction d'un environnement tout neuf..."
	make up