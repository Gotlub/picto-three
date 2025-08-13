      
# Instructions spécifiques pour gemini-cli

Ce fichier contient les commandes et workflows exacts à utiliser avec `gemini-cli` pour développer ce projet.

## Commandes Essentielles

*   **Installer les dépendances :**
    ```bash
    gemini -p "Installe les dépendances listées dans le fichier requirements.txt"
    # Expected execution: pip install -r requirements.txt
    ```

*   **Lancer la suite de tests :**
    ```bash
    gemini -p "Exécute la suite de tests complète avec pytest et affiche un rapport détaillé."
    # Expected execution: pytest -v
    ```

*   **Lancer l'application localement :**
    ```bash
    gemini -p "Démarre le serveur de développement Flask."
    # Expected execution: flask run
    ```

*   **Gérer la base de données (Migrations) :**
    *   Pour créer une nouvelle migration après un changement de modèle :
        ```bash
        gemini -p "Génère un nouveau fichier de migration de base de données avec Flask-Migrate."
        # Expected execution: flask db migrate -m "Description de la modification du modèle"
        ```
    *   Pour appliquer les migrations à la base de données :
        ```bash
        gemini -p "Applique les migrations en attente à la base de données."
        # Expected execution: flask db upgrade
        ```

## Workflow de Commit pour une Tâche

Voici un exemple de session `gemini-cli` pour compléter une tâche.

**Scénario :** La tâche est "Créer la route et le template pour la page d'accueil".

1.  **Lire le TODO :**
    `gemini -p "Affiche le contenu de TODO.md"`

2.  **Implémenter le code (contrôleur et vue) :**
    `gemini -p "Dans app/routes.py, ajoute une route '/' qui rend un template 'home.html'. Crée le fichier templates/home.html avec un titre H1 'Bienvenue'."`

3.  **Créer un test pour la nouvelle route :**
    `gemini -p "Dans tests/test_routes.py, ajoute un test qui vérifie que la route '/' retourne un code de statut 200 et que le contenu HTML contient 'Bienvenue'."`

4.  **Exécuter TOUS les tests :**
    `gemini -p "Exécute la suite de tests complète avec pytest."`
    > Attendre le résultat. Si ça échoue, déboguer. Si ça réussit, continuer.

5.  **Mettre à jour la documentation :**
    `gemini -p "Dans TODO.md, coche la case pour la tâche 'Créer la route et le template pour la page d'accueil'."`
    `gemini -p "Dans CHANGELOG.md, sous [Unreleased], ajoute une ligne '- Added home page route and template.'."`

6.  **Faire le commit :**
    `gemini -p "Stage tous les fichiers modifiés."`
    `gemini -p "Crée un commit avec le message 'feat: add home page route and template'."`

    