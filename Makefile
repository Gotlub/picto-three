# Options et paramètres par défaut
U ?= admin_test
E ?= admin@pictotree.local
P ?= Password123!
M ?= Migration

.PHONY: help user add-img bash db-bash build up down restart logs test migrate upgrade

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
	@echo "  make test                                            - Exécuter la suite de tests (pytest)"
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

# Tests et Migrations
test:
	docker compose exec web pytest -v

migrate:
	docker compose exec web flask db migrate -m "$(M)"

upgrade:
	docker compose exec web flask db upgrade


# ⚠️ DANGER : Détruit les conteneurs ET supprime tous les volumes (BDD + Images)
reset:
	@echo "🧨 Destruction de l'environnement et des volumes de données..."
	docker compose down -v
	@echo "🌱 Reconstruction d'un environnement tout neuf..."
	make init