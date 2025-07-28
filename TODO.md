---

#### **`TODO.md`**
```markdown
# TODO - Projet Pictogram-Tree Builder

Liste des jalons et tâches à réaliser par les agents IA.

## Jalon 0 : Initialisation et Structure du Projet

- [ ] Créer la structure de base des répertoires : `app/`, `app/templates`, `app/static`, `tests/`, `migrations/`.
- [ ] Créer le fichier `requirements.txt` avec `Flask`, `Flask-SQLAlchemy`, `Flask-Migrate`, `pytest`.
- [ ] Créer le fichier `app/__init__.py` pour initialiser l'application Flask et la base de données.
- [ ] Mettre en place la configuration de base (ex: `config.py`).

## Jalon 1 : Modèles de Données et Authentification

- [ ] Définir le modèle `User` dans `app/models.py` (id, username, email, password_hash).
- [ ] Définir le modèle `Image` dans `app/models.py` (id, path, name, description, user_id, is_public, etc.).
- [ ] Définir le modèle `Tree` dans `app/models.py` pour sauvegarder les arbres (id, user_id, name, is_public, json_data).
- [ ] Mettre en place les routes pour l'inscription (`/register`) et la création d'utilisateur (logique et template).
- [ ] Mettre en place les routes pour la connexion (`/login`) et la déconnexion (`/logout`) (logique et templates).
- [ ] Gérer la session utilisateur (ex: avec Flask-Login).
- [ ] Le footer doit afficher le nom de l'utilisateur connecté.

## Jalon 2 : Structure des Pages et Navigation

- [ ] Créer la route et le template de base pour la page d'accueil (`/`).
- [ ] Créer la route et le template de base pour la page de construction d'arbres (`/builder`).
- [ ] Implémenter le menu de navigation vertical pour basculer entre les pages.
- [ ] Sécuriser la page `/builder` pour qu'elle ne soit accessible qu'aux utilisateurs connectés (ou adapter les fonctionnalités).

## Jalon 3 : Logique de base du Constructeur d'Arbres (Frontend)

- [ ] Dans la page `/builder`, créer la structure HTML/CSS pour la zone d'affichage de l'arbre et le menu latéral.
- [ ] Implémenter en JS la logique pour afficher les images publiques et celles de l'utilisateur au niveau 0.
- [ ] Implémenter en JS la logique du pattern Composite : un objet `Node` qui peut contenir des enfants.
- [ ] Implémenter en JS la sélection d'une image : mise en surbrillance, les autres sont grisées.
- [ ] Implémenter en JS l'affichage du niveau suivant lorsqu'une image est sélectionnée.
- [ ] Implémenter en JS l'ajout d'une nouvelle image à un niveau donné (visuellement d'abord).

## Jalon 4 : Persistance des Arbres (Backend & Frontend)

- [ ] Créer une route API (`/api/tree/save`) qui reçoit une structure JSON de l'arbre et la sauvegarde en BDD (modèle `Tree`).
- [ ] Lier le bouton "Sauvegarder" du menu latéral à cette API.
- [ ] Créer une route API (`/api/trees/load`) qui renvoie les arbres de l'utilisateur et les arbres publics.
- [ ] Lier le bouton "Charger un arbre existant" à cette API et afficher les arbres chargés.
- [ ] Implémenter la fonctionnalité d'export en JSON.
- [ ] Implémenter la fonctionnalité d'import depuis un JSON.

## Jalon 5 : Gestion des Images et Finalisation

- [ ] Créer la route et le formulaire pour l'upload d'images par les utilisateurs authentifiés.
- [ ] Implémenter la logique de sauvegarde des fichiers image sur le serveur dans un dossier spécifique à l'utilisateur.
- [ ] Ajouter un jeu de données d'images publiques initiales.
- [ ] Finaliser le style CSS de toute l'application.
- [ ] Ajouter la vidéo de présentation et les liens sur la page d'accueil.