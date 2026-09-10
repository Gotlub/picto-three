      
# Stratégie de Test

## Tests E2E Playwright

Les dix parcours navigateur utilisent un environnement Docker PostgreSQL 15
independant et jetable, initialise par les migrations. Depuis la racine du depot dans WSL :

```bash
npm run e2e
```

Voir [tests/e2e/README.md](tests/e2e/README.md) pour l'isolation, les rapports et la
caracterisation du blocage connu de sauvegarde List. Aucun serveur existant ne
doit etre utilise par ces tests.

Le workflow `flask-review.yml` execute aussi cette commande a chaque push, dans
un job distinct des tests Python SQLite, et conserve les diagnostics en artifacts.

Tous les nouveaux développements doivent être accompagnés de tests. La qualité de l'application dépend de la robustesse de sa suite de tests.

## Outils

*   **Framework de test :** `pytest`
*   **Assertions :** Assertions natives de `pytest`
*   **Client de test Flask :** `app.test_client()` pour simuler des requêtes web.

## Organisation des Tests

Le code de test doit résider dans le répertoire `/tests`. La structure doit refléter celle de l'application.

*   `tests/test_models.py`: Tests unitaires pour les modèles SQLAlchemy (création d'objets, relations, contraintes).
*   `tests/test_routes.py`: Tests d'intégration pour les routes Flask (statut des réponses, contenu, redirection).
*   `tests/test_logic.py`: Tests unitaires pour toute logique métier complexe (ex: la logique de construction de l'arbre composite).

## Exécution des Tests

La suite de tests complète doit être exécutée avant chaque commit.

```bash
pytest -v
```
