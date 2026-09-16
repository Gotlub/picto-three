---

#### **`TODO.md`**
```markdown
# TODO - Projet Pictogram-Tree Builder

Liste des jalons et tâches à réaliser par les agents IA.

## Jalon 0 : Initialisation et Structure du Projet

- [x] Créer la structure de base des répertoires : `app/`, `app/templates`, `app/static`, `tests/`, `migrations/`.
  - *Détails : Structure de dossiers standard pour une application Flask créée.*
- [x] Créer le fichier `requirements.txt` avec `Flask`, `Flask-SQLAlchemy`, `Flask-Migrate`, `pytest`.
  - *Détails : Fichier `requirements.txt` créé avec les dépendances de base. `Flask-Login` et `Flask-WTF` ont été ajoutés par la suite.*
- [x] Créer le fichier `app/__init__.py` pour initialiser l'application Flask et la base de données.
  - *Détails : Mise en place du pattern factory `create_app` pour l'initialisation de l'application, de la base de données, de la migration et de la gestion des connexions.*
- [x] Mettre en place la configuration de base (ex: `config.py`).
  - *Détails : Fichier `config.py` créé pour gérer les configurations de l'application, notamment la clé secrète et l'URI de la base de données.*

## Jalon 1 : Modèles de Données et Authentification

- [x] Définir le modèle `User` dans `app/models.py` (id, username, email, password_hash).
  - *Détails : Modèle `User` créé avec les colonnes nécessaires et les méthodes pour la gestion des mots de passe. `UserMixin` a été ajouté pour Flask-Login.*
- [x] Définir le modèle `Image` dans `app/models.py` (id, path, name, description, user_id, is_public, etc.).
  - *Détails : Modèle `Image` créé pour stocker les informations sur les images.*
- [x] Définir le modèle `Tree` dans `app/models.py` pour sauvegarder les arbres (id, user_id, name, is_public, json_data).
  - *Détails : Modèle `Tree` créé pour la persistance des arbres générés.*
- [x] Mettre en place les routes pour l'inscription (`/register`) et la création d'utilisateur (logique et template).
  - *Détails : Route `/register` et template `register.html` créés, avec un formulaire de validation (`RegistrationForm`).*
- [x] Mettre en place les routes pour la connexion (`/login`) et la déconnexion (`/logout`) (logique et templates).
  - *Détails : Routes `/login`, `/logout` et template `login.html` créés, avec un formulaire de validation (`LoginForm`).*
- [x] Gérer la session utilisateur (ex: avec Flask-Login).
  - *Détails : Flask-Login a été initialisé et configuré pour gérer les sessions utilisateur et protéger les routes.*
- [x] Le footer doit afficher le nom de l'utilisateur connecté.
  - *Note : Le menu de navigation supérieur affiche maintenant le statut de l'utilisateur (connecté/déconnecté), ce qui remplit une fonction similaire.*

## Jalon 2 : Structure des Pages et Navigation

- [x] Créer la route et le template de base pour la page d'accueil (`/`).
  - *Détails : Route `/` créée avec un template `index.html` qui sert de page de destination.*
- [x] Créer la route et le template de base pour la page de construction d'arbres (`/builder`).
  - *Détails : Route `/builder` et template `builder.html` créés.*
- [x] Implémenter le menu de navigation vertical pour basculer entre les pages.
  - *Détails : Un menu de navigation a été implémenté. Il a ensuite été modifié pour un menu horizontal avec Bootstrap pour une meilleure ergonomie.*
- [x] Sécuriser la page `/builder` pour qu'elle ne soit accessible qu'aux utilisateurs connectés (ou adapter les fonctionnalités).
  - *Détails : La route `/builder` est protégée par le décorateur `@login_required` de Flask-Login.*

## Jalon 3 : Logique de base du Constructeur d'Arbres (Frontend)

- [x] Dans la page `/builder`, créer la structure HTML/CSS pour la zone d'affichage de l'arbre et le menu latéral.
  - *Détails : La structure de la page `builder.html` a été mise en place avec une zone pour l'arbre et une barre latérale pour les images, en utilisant la grille Bootstrap.*
- [x] Implémenter en JS la logique pour afficher les images publiques et celles de l'utilisateur au niveau 0.
  - *Détails : Un script `builder.js` charge les données des images depuis le template et les affiche dans la barre latérale.*
- [x] Implémenter en JS la logique du pattern Composite : un objet `Node` qui peut contenir des enfants.
- [x] Implémenter en JS la sélection d'une image : mise en surbrillance, les autres sont grisées.
- [x] Implémenter en JS l'affichage du niveau suivant lorsqu'une image est sélectionnée.
- [x] Implémenter en JS l'ajout d'une nouvelle image à un niveau donné (visuellement d'abord).

## Jalon 4 : Persistance des Arbres (Backend & Frontend)

- [x] Créer une route API (`/api/tree/save`) qui reçoit une structure JSON de l'arbre et la sauvegarde en BDD (modèle `Tree`).
- [x] Lier le bouton "Sauvegarder" du menu latéral à cette API.
- [x] Créer une route API (`/api/trees/load`) qui renvoie les arbres de l'utilisateur et les arbres publics.
- [x] Lier le bouton "Charger un arbre existant" à cette API et afficher les arbres chargés.
- [x] Implémenter la fonctionnalité d'export en JSON.
- [x] Implémenter la fonctionnalité d'import depuis un JSON.

## Jalon 5 : Gestion des Images et Finalisation

- [x] Créer la route et le formulaire pour l'upload d'images par les utilisateurs authentifiés.
- [x] Implémenter la logique de sauvegarde des fichiers image sur le serveur dans un dossier spécifique à l'utilisateur.
- [x] Ajouter un jeu de données d'images publiques initiales.
  - *Détails : Trois images de placeholder ont été ajoutées dans `app/static/images`.*
- [x] Finaliser le style CSS de toute l'application.
  - *Détails : Le framework Bootstrap a été intégré pour un style de base cohérent et responsive.*

## Jalon 6 : Gestion des Images Utilisateur (Banque de Pictogrammes)

- [x] **Mise à jour de la base de données et des modèles**
    - [x] Créer un nouveau modèle `Folder` dans `app/models.py`.
    - [x] Ajouter une clé étrangère `folder_id` au modèle `Image`.
    - [x] Générer et appliquer une migration de base de données.
- [x] **Mise à jour du processus d'inscription**
    - [x] Modifier la route `/register` pour créer un répertoire personnel pour chaque nouvel utilisateur.
    - [x] Ajouter une entrée pour le dossier racine de l'utilisateur dans la table `folder`.
- [x] **Développement du backend pour la banque de pictogrammes**
    - [x] Créer une nouvelle route `/pictogram-bank`.
    - [x] Créer les points d'accès API (`GET /api/pictograms`, `POST /api/folder/create`, `POST /api/image/upload`, `DELETE /api/item/delete`).
- [x] **Développement du frontend : Page de la banque de pictogrammes**
    - [x] Créer un nouveau template `app/templates/pictogram_bank.html`.
    - [x] Mettre en place une mise en page à deux colonnes.
    - [x] Afficher l'arborescence des dossiers et des images.
    - [x] Ajouter les formulaires pour les actions (créer, importer, exporter).
- [x] **Logique JavaScript côté client**
    - [x] Créer un nouveau fichier `app/static/js/pictogram_bank.js`.
    - [x] Implémenter la logique de l'arborescence (pattern Composite).
    - [x] Gérer les interactions utilisateur et les appels API.
- [x] **Mise à jour de la navigation**
    - [x] Ajouter le lien "banque de pictogrammes" dans la barre de navigation.

## Maintenance
- [x] Ajouter les etapes E2E 0/1 : stack Docker isolee, seed SQLite/images jetables et cinq parcours Playwright, sans modifier `app/`.
- [x] Valider le socle E2E sur PostgreSQL 15 jetable et avec les migrations.
- [x] Ajouter cinq parcours E2E de regression et un job dedie dans `flask-review.yml`.
- [x] Resoudre le blocage de sauvegarde List (suppression de la reference a l'element inexistant `#list-is-public`, assainissement API et validation nominale de sauvegarde/relecture dans les E2E).
- [x] Integrer les linters (Ruff, ESLint), tests unitaires JS, pytest et les tests E2E Playwright dans le `Makefile` (`make test`, `make lint`, `make pytest`, `make test-js`, `make e2e`).
- [x] Créer les modèles et tests unitaires JavaScript (`TreeModel`, `ListModel`) pour valider la logique d'arborescence (anti-cycle, déplacement, suppression) et listes avant refactorisation.
- [x] Ajouter le 11ème parcours E2E Playwright pour la réorganisation d'arbres par Drag & Drop, le blocage des cycles et la suppression de branches persistée.
- [x] Intégrer les tests unitaires JS dans GitHub Actions (`.github/workflows/flask-review.yml`) et documenter l'obligation de validation systématique `make test` dans `AGENTS.md`.
- [ ] Confirmer le premier passage GitHub Actions et obtenir la validation humaine des E2E avant toute refactorisation.
- [x] Corriger la configuration SMTP pour Brevo (séparation user/sender).
- [x] Créer le Makefile pour faciliter la gestion des conteneurs Docker (admin, images, bash, psql).
- [x] Configurer la stack Docker de production (Dockerfile optimisé + docker-compose.yml unique + volumes nommés + limites BDD 512 Mo).
- [x] Mettre à jour la documentation README.md avec la gestion Docker unique, le Makefile et le mode démonstration (DEMO_USERNAME).

## Phase 2 : Chasse au code mort & Déduplication transverse
- [x] Renforcer les règles ESLint (`no-unused-vars` strict avec exclusion `^_`, `no-undef`, avertissement sur `console.log` de debug).
- [x] Nettoyer le code mort et les logs de debug orphelins dans `builder.js`, `list.js`, `pictogram_bank.js`.
- [x] Créer le service partagé `ApiClient.js` (centralisation des requêtes fetch, CSRF token automatique, sérialisation JSON, gestion unifiée des erreurs HTTP).
- [x] Créer le service partagé `NotificationService.js` (interface unifiée pour alert/confirm/error/success tout en garantissant la compatibilité des dialogues natifs pour Playwright E2E).
- [x] Créer le module utilitaire `DomUtils.js` (sécurisation XSS avec `escapeHtml`, `createElement`, sélecteurs DOM).
- [x] Écrire la suite de tests unitaires pour `ApiClient`, `NotificationService`, `DomUtils` (26 tests unitaires JS au total).
- [x] Intégrer `ApiClient` et `NotificationService` dans `builder.js` (sauvegarde/chargement d'arbres et profils, suppression) et `list.js` (sauvegarde/chargement listes et arbres).
- [x] Valider l'absence de régression via l'exécution complète de `make test` (Ruff, ESLint, 26 tests JS, 56 tests Pytest, 11 tests E2E).

## Phase 3 : Découpage modulaire et Clean Code des monolithes JS
- [x] **Étape 3.1 : Modularisation de `list.js`**
  - [x] Extraire `app/static/js/services/ListPdfExporter.js` (gestion du zoom, synchronisation onglet-accordéon, calculs de mise en page grille/chaîne, rendu DOM preview et export jsPDF).
  - [x] Extraire `app/static/js/components/ReadOnlyTreeViewer.js` (`ReadOnlyNode`, sélection de branche, reconstruction d'arbres et dragstart).
  - [x] Extraire `app/static/js/components/ChainedListManager.js` (`ChainedListItem`, drag & drop reorder, édition de description en temps réel, scroll horizontal et boutons, import d'image locale).
  - [x] Réduire `list.js` de ~1 562 lignes à 328 lignes en conservant le rôle d'orchestrateur principal.
  - [x] Ajouter les tests unitaires JS pour `ListPdfExporter` et `ChainedListManager` (portant le total à 31 tests unitaires JS validés).
  - [x] Valider l'absence de régression avec `make test` (100% de succès sur les 11 parcours E2E Playwright, 56 tests Pytest, ESLint et Ruff).
- [x] **Étape 3.2 : Modularisation de `builder.js`**
  - [x] Extraire `app/static/js/components/BuilderNode.js` (DOM, rendu visuel des nœuds, fallback et gestion des événements DnD).
  - [x] Extraire `app/static/js/components/BinderManager.js` (composition et réorganisation de classeur, palette de couleurs, avatar et persistance profil).
  - [x] Extraire `app/static/js/services/TreePdfExporter.js` (export SVG / PDF vectoriel de l'arbre Treant avec jsPDF).
  - [x] Réduire la complexité de `builder.js` de 2 104 lignes à ~640 lignes comme orchestrateur principal.
  - [x] Renforcer la sécurité en vue de l'audit Astra (éradication des XSS via innerHTML, sécurisation des URLs et caractères Unicode sécurisés).
  - [x] Ajouter 3 suites de tests unitaires JS (`builder_node.test.js`, `binder_manager.test.js`, `tree_pdf_exporter.test.js` - total 39 tests unitaires JS).
  - [x] Valider l'ensemble avec `make test` (100% de succès sur Linters Ruff & ESLint, 39 tests JS, 56 tests Pytest, 11 tests E2E Playwright).

## Phase 4 : Améliorations UX & Corrections ciblées (Visualiseur & ARASAAC)
- [x] **Correction de la patte parasite sur le visualiseur d'arbre et l'export PDF** :
  - [x] Désactivation du bouton Treant `collapsable: false` dans `builder.js`.
  - [x] Masquage strict CSS `.collapse-switch` dans `custom.css` (suppression de la patte 3x3px noire en haut à droite des boîtes de nœuds).
  - [x] Amélioration du rendu vectoriel SVG/PDF dans `TreePdfExporter.js` (bords arrondis `rx="6" ry="6"`, bordure `#b0b0b0`, préservation des connecteurs).
- [x] **Refonte intelligente du composant de recherche ARASAAC** (`ArasaacSearch.js`) :
  - [x] Interface English-first par défaut ("Relevance", 'Exact ("Is")', "Starts with", "Contains").
  - [x] Ajout du support pour les langues NL (Néerlandais) et PL (Polonais) en plus de EN, FR, ES, DE, IT, PT.
  - [x] Initialisation par défaut de la langue depuis la variable de session locale de l'application (`window.CURRENT_LOCALE || 'en'`).
  - [x] Suppression du tri alphabétique destructeur au profit d'un tri par pertinence réelle (`filterAndRankPictograms`).
  - [x] Extraction automatique du mot-clé correspondant recherché (`findBestMatchingKeyword`) pour le titre, les métadonnées de drag-and-drop et l'affichage des synonymes secondaires.
  - [x] Ajout d'une suite complète de tests unitaires JS (`tests/unit/arasaac_search.test.js`, 10 tests, portant le total à 49 tests JS).
- [x] **Recherche locale d'images (Nom et Description simultanés + Modes de recherche)** :
  - [x] Vérification et correction de la recherche locale dans `app/routes/api.py` (`search_local_images`) pour filtrer simultanément sur `Image.name` et `Image.description`.
  - [x] Intégration des modes de recherche ("Relevance", "Exact", "Starts with", "Contains") à la recherche locale dans `ImageTree.js`, `builder.html`, `list.html`, `builder.js`, `list.js` (sans sélecteur de langue).
  - [x] Test Pytest dédié `test_search_local_images_modes_and_description` validant le filtrage sur le nom, la description et les 4 modes.
- [x] **Internationalisation (i18n) et support du Portugais (`pt`)** :
  - [x] Ajout de `'pt'` dans `config.py` (`LANGUAGES`).
  - [x] Ajout de l'option Portugais dans la barre de navigation (`app/templates/base.html`).
  - [x] Extraction Babel, initialisation du catalogue `app/translations/pt`, mise à jour et traduction de tous les messages dans les langues de l'application.
  - [x] Compilation des fichiers `.mo` pour toutes les langues (`en`, `fr`, `es`, `de`, `it`, `nl`, `pl`, `pt`).
  - [x] Validation 100% sur `make test` (Ruff, ESLint, 49 tests JS, 57 Pytest, 11 E2E Playwright).

## Idées d'améliorations futures (Backlog)
- [ ] **Mode Administration** :
  - Interface et droits dédiés pour les administrateurs.
  - Possibilité pour les admins de créer et publier des images publiques directement dans la banque globale.
  - Possibilité de créer et gérer des listes et des arbres publics modèles accessibles à tous.
- [ ] **Banques d'images & Recherche avancée** :
  - Intégration de banques d'images tierces supplémentaires (en complément d'ARASAAC).
  - Optimisation des critères et algorithmes de recherche de pictogrammes (gestion des synonymes, lemmatisation, tolérance aux fautes/variantes).
- [ ] **Gestion avancée du cycle de vie et intégrité référentielle** :
  - Analyse d'impact avant suppression d'une ressource (détecter si une image est utilisée dans un arbre ou une liste, ou si une liste est utilisée dans un classeur).
  - Mécanismes automatisés pour éviter les références orphelines (ex: classeurs avec listes supprimées, arbres avec images supprimées).
  - Conception optimisée côté BDD / serveur pour préserver les performances sans surcharge de tables croisées.
```

