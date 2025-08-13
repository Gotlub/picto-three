 Directive pour les Agents IA (Jules & gemini-cli)

Votre objectif principal est de construire et de maintenir l'application "Pictogram-Tree Builder" en suivant les tâches définies dans `TODO.md`. Vous devez travailler de manière collaborative et systématique.

## Votre Mission

Implémenter les fonctionnalités décrites dans le `TODO.md`, jalon par jalon, tâche par tâche. Votre travail doit être de haute qualité, testé et documenté.

## Le Workflow de Développement Fondamental

Pour **chaque tâche** que vous entreprenez, vous devez suivre ce cycle **impérativement** :

1.  **LIRE & COMPRENDRE** :
    *   Lisez la tâche actuelle dans `TODO.md`.
    *   Lisez ce fichier `AGENTS.md` pour vous rappeler des règles.
    *   Lisez `GEMINI.md` pour les commandes spécifiques.
    *   Analysez les fichiers de code source pertinents pour comprendre le contexte actuel.

2.  **CODER** :
    *   Implémentez la fonctionnalité ou corrigez le bug.
    *   Respectez le pattern MVC et la pile technologique définie dans `README.md`.
    *   Le code doit être clair, commenté si nécessaire, et sécurisé.

3.  **TESTER** :
    *   Écrivez ou mettez à jour les tests unitaires et d'intégration dans le répertoire `tests/` pour couvrir le code que vous venez d'écrire. La stratégie de test est définie dans `TESTING.md`.
    *   **Exécutez la suite de tests COMPLÈTE.** Utilisez la commande spécifiée dans `GEMINI.md`.

4.  **DOCUMENTER & FINALISER** :
    *   **Si et seulement si tous les tests passent :**
        *   Mettez à jour le fichier `TODO.md` en cochant la case de la tâche terminée (`- [x]`).
        *   Ajoutez une entrée concise dans `CHANGELOG.md` sous la section `[Unreleased]`.
        *   Assurez-vous que tous les fichiers que vous avez modifiés sont prêts à être commités.

5.  **COMMIT** :
    *   Utilisez `git add .` pour stager vos changements.
    *   Commitez en utilisant un message clair et respectant le format "Conventional Commits". Le message doit référencer la tâche accomplie. Exemple : `feat: add user registration endpoint` ou `fix: correct image path resolution`.

**Règle d'or :** **NE JAMAIS COMMIT DU CODE QUI NE PASSE PAS LA SUITE DE TESTS COMPLÈTE.** Si vous êtes bloqué, décrivez le problème dans un fichier `BLOCKER.md` et arrêtez-vous.

## Maintenance des Fichiers de Projet

Vous êtes responsables de la mise à jour de ces fichiers :
*   **`TODO.md`**: En cochant les tâches.
*   **`CHANGELOG.md`**: En ajoutant les changements.
*   **`TESTING.md`**: Si une nouvelle stratégie de test est introduite.
*   Les fichiers de code source et de test.