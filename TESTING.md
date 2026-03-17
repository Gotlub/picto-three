      
# Stratégie de Test

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

    