# Tests E2E : socle et regressions

Cette suite execute dix parcours Chromium contre le vrai backend Flask et
PostgreSQL 15, sans modifier l'application. Chaque execution applique toutes les
migrations sur une base vide avant de creer les fixtures. Le premier socle
SQLite a ete remplace par cette stack, plus proche de la cible Docker du produit.
Les tests Python existants restent sur SQLite dans leur job CI distinct.

## Execution depuis WSL

Prerequis : Bash, Git, Docker et Docker Compose v2 ou ulterieur accessibles dans
WSL (integration Docker Desktop active). Aucun serveur applicatif existant ne
doit etre utilise. Node, Python et les navigateurs sont installes dans les images
de test ; aucune installation locale n'est necessaire pour cette commande :

```bash
bash /home/gotlub/picto-three/tests/e2e/run.sh
```

Depuis la racine du depot, avec npm disponible, la commande equivalente est :

```bash
npm run e2e
```

Le premier build telecharge les images Docker et les dependances Python/Node.
Prevoir de l'espace disque pour l'image Playwright et le cache Docker. Les builds
suivants utilisent le cache. Internet est necessaire au build, pas pendant les
tests.

Le script cree un projet `pictotree-e2e-<timestamp>-<pid>` neuf, attend le healthcheck
PostgreSQL puis Flask, execute les dix tests, collecte les logs et supprime ses conteneurs,
reseaux et tags d'images. Il conserve le code de sortie des tests ; un echec du
nettoyage rend aussi la commande non reussie. Les caches de build ne sont pas
purges. Le nettoyage est tente aussi apres un echec ou Ctrl+C, mais ne peut pas
etre garanti apres un SIGKILL ou un arret du moteur Docker.

Ne pas utiliser `make up`, `make test`, `make reset` ou le Compose habituel pour
cette suite. Ne pas fusionner `compose.e2e.yml` avec `docker-compose.yml`.

## Isolation

- Compose utilise explicitement `--env-file /dev/null`, un fichier autonome et un
  nom de projet unique. Il n'importe pas les variables de l'application depuis
  `.env` et n'herite d'aucun volume de developpement/production.
- Le contexte de build est filtre par `Dockerfile.dockerignore` : pas de `.env`,
  base SQLite, environnement local, `node_modules` ou rapports.
- L'application est non-root, son code est en lecture seule et n'est jamais
  monte depuis l'hote. Ses originaux et miniatures sont dans le `tmpfs`
  `/e2e-data`, perdu a l'arret du conteneur. PostgreSQL utilise un autre `tmpfs`
  limite a 512 Mo, sans volume persistant ni port publie.
- `support/settings.py` refuse une execution hors Docker, une racine de donnees
  non montee, une image contenant `/app/.env` ou des cibles de donnees heritees
  incompatibles. La configuration est fournie avant `create_app()`.
- Le seed valide la cible PostgreSQL exacte `db-e2e:5432/pictotree_e2e` avant
  toute ecriture et refuse un schema ou des ressources deja initialises. Il
  applique `flask_migrate.upgrade(..., revision='head')`, pas `create_all()` ou
  `stamp()`. Les images recoivent des IDs generes par PostgreSQL pour conserver
  la coherence de ses sequences lors des uploads suivants.
- Les trois services partagent uniquement un reseau Docker interne, sans port
  publie ni socket Docker. Le navigateur utilise `http://app-e2e:5000` ; il n'y a
  pas de `BASE_URL` configurable vers un serveur existant.
- Le seul bind mount est le repertoire de rapports propre a l'execution. Le
  runner utilise l'UID/GID WSL pour ne pas produire de fichiers appartenant a root.
- CSRF reste actif. Les sessions, cles et comptes sont exclusivement fictifs.
  Les emails sont supprimes et aucun service SMTP/reCAPTCHA reel n'est utilise.

Le healthcheck consulte `/api/trees/load` et verifie la presence de l'arbre du
compte demo E2E : un simple HTTP 200 sur l'accueil ne suffit pas.

## Donnees reproductibles

Le seed cree dix utilisateurs confirmes, chacun avec son dossier personnel :
`e2e_demo`, `e2e_auth`, `e2e_builder`, `e2e_list_local`, `e2e_list_saved`,
`e2e_tree_dnd`, `e2e_tree_overwrite`, `e2e_binder`, `e2e_resources`, `e2e_list_edit`.
Le mot de passe commun, uniquement pour ce jeu jetable, est
`E2eOnlyPassword123!`. Les adresses sont dans `example.test` et la langue est `en`.

Trois PNG de 96 x 96 pixels sont generes par Pillow : carres rouge, bleu et vert.
Chaque image publique a un vrai fichier, une miniature et un enregistrement DB.
Des arbres racine/enfant sont prepares pour la demo, l'edition, l'ecrasement et
la composition de classeur ; une liste de deux images appartient au compte de
lecture List. Les scenarios de creation commencent avec leur espace prive vide.

Chaque test a un nouveau contexte navigateur. Les tests mutables ont des comptes
distincts ; aucune donnee privee n'est preparee par un autre test. Les images
publiques sont partagees en lecture seule. Un worker, aucun retry.

## Les dix parcours

1. Navigation anonyme : accueil, consentement, Builder, onglets arbre/classeur,
   miniature publique, puis List.
2. Authentification : mauvais mot de passe, connexion reelle avec CSRF, acces au
   dossier personnel, deconnexion et disparition des ressources personnelles.
3. Persistance Builder : chargement d'un arbre, modification de la description
   d'un enfant, sauvegarde sous un nouveau nom, rechargement complet et relecture
   depuis l'interface. Les images et la structure sont verifiees.
4. List local preview : selection d'un PNG via l'input fichier, modification de
   description, preview paysage ; puis caracterisation du blocage Save actuel.
5. List existante : chargement d'une liste seedee, ordre et descriptions des deux
   maillons, selection et preview portrait avec images decodees.
6. Construction d'arbre : vrais gestes de glisser-deposer depuis la banque
   publique, trois niveaux, descriptions, sauvegarde et relecture persistante.
7. Ecrasement d'arbre : annulation sans requete d'ecriture ni perte de la version
   sauvegardee, puis confirmation avec conservation de l'identite de l'arbre.
8. Classeur : assemblage et reorganisation de deux arbres, couleur et avatar
   local, sauvegarde et restitution de l'ordre et des options apres rechargement.
9. Ressources : creation d'un sous-dossier, upload PNG, edition de description,
   original et miniature, annulation puis confirmation d'une suppression.
10. List/PDF : reorganisation de trois maillons importes, suppression, annulation
    de New Chain, preview et telechargement d'un PDF avec les textes conserves.

Les cinq premiers sont dans `smoke.spec.ts`, les suivants dans
`regression.spec.ts`. L'ordre d'execution peut differer de cette presentation ;
les scenarios ne dependent pas des donnees creees par un autre test. Le PDF est
controle par sa signature, ses marqueurs page/image et ses textes : ce controle
nominal ne remplace pas une comparaison visuelle de son rendu ni de sa pagination.

### Blocage connu de sauvegarde List

Le quatrieme parcours de `smoke.spec.ts` porte une annotation `known-issue`. Apres avoir valide le
preview, il tente de sauvegarder une liste non vide avec un compte connecte et
un nom renseigne. Il attend exactement le `TypeError` lie a `.checked` sur le
champ absent `#list-is-public`, avec une pile issue de `ListBuilder.saveList`,
et verifie qu'aucun POST n'a ete emis.

Le backend force deja `is_public=False`. Le blocage est cote navigateur, avant
l'appel au backend : il ne constitue pas une validation de cette valeur par
defaut, ni une fonctionnalite d'administration. Le futur parametrage admin reste
hors perimetre de cette suite.

**Un resultat vert ne signifie pas que la sauvegarde List fonctionne.** Ce test
acte le defaut demande, sans case injectee, appel d'une methode interne, mock de
l'API ou correction de `list.js`. Aucune autre erreur JS n'est toleree. Quand la
correction sera autorisee, ce bloc devra devenir un vrai parcours sauvegarde et
relecture ; si le defaut disparait entre-temps, le test echouera pour le signaler.

## Reseau et dependances

Les API Flask et les fichiers de l'application ne sont pas mockes. Le decodage,
les dimensions et les URL des images sont controles ; pour les images locales,
`X-Image-Id` permet de distinguer une vraie ressource d'un placeholder HTTP 200.

Les requetes CDN exactes des templates sont interceptees avec les vraies
bibliotheques presentes dans `node_modules`, aux memes versions : Bootstrap,
Bootstrap Icons, jsPDF, html2pdf et DOMPurify. Le lockfile npm fixe leurs versions
et integrites. Les iframes YouTube sont remplacees par un document vide explicite.
Tout autre appel externe fait echouer le test. ARASAAC est donc bloque dans cette
suite, et non simule comme une fonctionnalite deja couverte.

Les erreurs HTTP de l'application, les echecs de transport autres que les
annulations de navigation et les exceptions JS inattendues font echouer les
tests. Les attentes reposent sur l'interface ou une reponse ciblee, pas sur des
temporisations fixes.

Playwright et son image sont en version `1.58.2`. `requirements.lock` contient les
contraintes Python directes/transitives validees pour ce socle, sans changer le
`requirements.txt` du produit. Si celui-ci change, revoir aussi les contraintes.
Les images de base et les paquets systeme ne sont pas verrouilles par digest.
Les anciennes versions JS ici sont volontaires : elles correspondent au code
servi actuellement, pas a une recommandation de versions pour la production.

## Rapports et developpement

Les resultats sont conserves hors Git dans :

```text
tests/e2e/artifacts/pictotree-e2e-<timestamp>-<pid>/
  compose.log
  results.json
  report/index.html
  test-results/          # captures, contexte et trace.zip si echec
```

Le PDF du parcours List est egalement joint au rapport, meme si le test reussit.
Pour la validation humaine, conserver les traces de tous les tests :

```bash
E2E_TRACE=1 npm run e2e
```

Ouvrir ensuite le rapport HTML pour consulter les actions, snapshots DOM,
requetes et pieces jointes de chaque parcours. Une reussite automatique ne vaut
pas validation humaine et n'autorise aucune refactorisation a elle seule.

Le chemin exact est affiche en fin d'execution. `report/index.html` s'ouvre dans
un navigateur. Pour servir le rapport interactif, installer les outils locaux
optionnels puis utiliser le chemin du rapport de l'execution voulue :

```bash
npm --prefix tests/e2e ci
tests/e2e/node_modules/.bin/playwright show-report tests/e2e/artifacts/<execution>/report --host 127.0.0.1
```

Verification TypeScript sans demarrer l'application :

```bash
npm --prefix tests/e2e run typecheck
```

Ne pas lancer pytest dans cette stack : ses fixtures existantes n'isolent pas
completement les miniatures et un test modifie un asset statique. Cette suite
E2E ne modifie ni n'execute ces tests Python.

## GitHub Actions

`.github/workflows/flask-review.yml` lance le job
`E2E Chromium / PostgreSQL 15` a chaque push. Il utilise exactement
`bash tests/e2e/run.sh`, sans secrets, environnement preexistant ni service externe.
Le job SQLite/Pytest reste independant, avec son propre checkout : le fichier
statique modifie par ses tests ne peut pas contaminer la stack E2E.
Le build du runner execute aussi le controle TypeScript avant les tests.

Les rapports, captures, traces et logs sont publies via `actions/upload-artifact`
meme si les tests echouent et conserves sept jours. Le job a une limite de vingt
minutes. La configuration CI doit encore etre confirmee par un premier push ;
une execution locale ne prouve pas le succes du workflow heberge.

GitHub Actions peut parfaitement executer PostgreSQL : SQLite n'est pas une
obligation de la plateforme. Conserver pytest sur SQLite maintient des tests
rapides, mais ne valide pas les memes contraintes, sequences et comportements
transactionnels. Les E2E PostgreSQL completent cette couverture ; une matrice
pytest SQLite/PostgreSQL demandera d'abord de renforcer ses fixtures d'isolation.

## Avant la refactorisation

Attendre la validation humaine des parcours et un premier workflow CI reussi.
Cette suite ne couvre pas tout : sauvegarde nominale List, droits entre deux
utilisateurs, drag de branches et annulations complexes, ARASAAC, visualisation
Treant et cas d'impression multipages restent a completer. Les defauts connus
doivent etre distingues des comportements a preserver avant tout nettoyage du code.
