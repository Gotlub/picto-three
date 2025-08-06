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

- [ ] Créer la route et le formulaire pour l'upload d'images par les utilisateurs authentifiés.
- [ ] Implémenter la logique de sauvegarde des fichiers image sur le serveur dans un dossier spécifique à l'utilisateur.
- [x] Ajouter un jeu de données d'images publiques initiales.
  - *Détails : Trois images de placeholder ont été ajoutées dans `app/static/images`.*
- [x] Finaliser le style CSS de toute l'application.
  - *Détails : Le framework Bootstrap a été intégré pour un style de base cohérent et responsive.*
- [ ] Ajouter la vidéo de présentation et les liens sur la page d'accueil.

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

## Jalon 7 : Traduction Multilingue (Futur)

- **Étape 1 : Préparation des chaînes de texte**
  - Lister toutes les chaînes de texte (strings) utilisées dans le frontend (templates).
  - Convertir chaque chaîne en une variable identifiable pour la traduction (par exemple, en utilisant `_('key')`).

- **Étape 2 : Gestion de la langue de l'utilisateur**
  - Créer une variable globale `language` associée à l'utilisateur (attribut en session).
  - Les valeurs possibles seront `"EN"`, `"FR"`, `"ES"`.
  - La langue sera modifiable via un sélecteur dans le menu.
  - La langue par défaut sera `"EN"`.

- **Étape 3 : Implémentation de la logique de traduction**
  - Créer des fichiers de traduction séparés pour chaque langue (`EN`, `FR`, `ES`).
  - Implémenter la logique pour que les templates affichent la traduction correspondante en fonction de la variable `language` de la session.