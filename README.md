Ce projet est un site web permettant de créer des arbres composites de pictogrammes. Il est conçu pour être simple d'utilisation, notamment pour des publics spécifiques comme les personnes avec TSA. L'application est développée et maintenue principalement par des agents IA.

## Description

L'application permet aux utilisateurs de s'inscrire, de se connecter et de construire des arborescences visuelles où chaque nœud est une image. Ces arbres peuvent être sauvegardés, partagés publiquement, ou exportés au format JSON.

## Pile Technologique

*   **Backend:** Python 3.10+ avec [Flask](https://flask.palletsprojects.com/)
*   **Base de Données:** SQLite gérée via [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)
*   **Frontend:** HTML5, CSS3, et JavaScript (ES6 Modules)
*   **Tests:** [Pytest](https://docs.pytest.org/)
*   **Dépendances Python:** Voir `requirements.txt`

## Initialisation et Lancement

1.  **Cloner le dépôt :**
    ```bash
    git clone <URL_DU_DEPOT>
    cd <NOM_DU_DEPOT>
    ```

2.  **Créer un environnement virtuel et l'activer :**
    ```bash
    python -m venv venv
    source venv/bin/activate  # Sur Windows: venv\Scripts\activate
    ```

3.  **Installer les dépendances :**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Initialiser la base de données :**
    ```bash
    flask db init
    flask db migrate -m "Initial migration."
    flask db upgrade
    ```

5.  **Lancer l'application :**
    ```bash
    flask run
    ```
L'application sera accessible à l'adresse `http://127.0.0.1:5000`.

## Contribution via Agents IA

Ce projet est piloté par des agents. Veuillez vous référer aux fichiers `AGENTS.md` et `GEMINI.md` pour les instructions et le workflow de développement.