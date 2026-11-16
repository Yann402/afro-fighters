# Afro Fighters — Légendes de l'Arène

Jeu de combat en 3D jouable dans le navigateur, inspiré de trois traditions guerrières africaines.
Version 1.3.

### ▶ [Jouer en ligne](https://yann402.github.io/afro-fighters/)

Rien à installer : le jeu se lance dans le navigateur. Chrome ou Edge de préférence,
sur ordinateur, avec un clavier ou une manette. Il n'y a ni compte, ni publicité, ni
collecte de données : la progression est enregistrée dans le navigateur, sur la machine
du joueur, et nulle part ailleurs.

| Combattant | Inspiration | Style | Pouvoir spécial |
|---|---|---|---|
| **Modou**, le Roc de la Médina | Lutte sénégalaise (laamb) | Lutteur : saisies, charge armurée | **Bàkk** : danse de défi, puis projection imblocable |
| **Themba**, l'Orage du Veld | Guerrier zoulou | Équilibré : lance iklwa, bouclier isihlangu | **Impondo Zankomo** : charge en « cornes du buffle » |
| **Lekishon**, le Faucon de la Savane | Guerrier maasaï | Longue portée, aérien | **Adumu** : sauts rituels, puis piqué de lance |

Les personnages sont fictifs. Ils s'inspirent de ces cultures sans prétendre en reproduire fidèlement les codes.

## Lancer le jeu sur sa machine
Le jeu est un site statique : rien à compiler, aucune dépendance à installer.
```
git clone https://github.com/Yann402/afro-fighters.git
cd afro-fighters
python3 -m http.server 8000      # ou : npm start
```
puis ouvrir `http://localhost:8000`.

Ouvrir `index.html` par un double-clic **ne fonctionne pas** : les navigateurs refusent de charger
les modules JavaScript et les modèles 3D depuis un fichier local. Il faut passer par un serveur,
même local — c'est ce que fait la commande ci-dessus. N'importe quel serveur statique convient.

## Modes de jeu
| Mode | Contenu |
|---|---|
| Combat | Contre l'ordinateur, trois niveaux de difficulté, deux manches gagnantes |
| Deux joueurs | Sur le même clavier, ou avec deux manettes |
| Entraînement | Pas de K.O. ni de chrono ; mannequin immobile, en garde, sauteur ou actif ; dégâts et enchaînements affichés |
| Liste des coups | Chaque coup avec sa commande, ses dégâts, sa rapidité, et sa démonstration jouée en boucle |
| Profil | Niveau, statistiques, récompenses, tenues, ambiance de l'arène, export et import de la sauvegarde |
| Options | Son, qualité graphique, touches reconfigurables, mesures de performances |

## Commandes par défaut
| Action | Un joueur | Joueur 1 (à deux) | Joueur 2 (à deux) | Manette PS4/PS5 |
|---|---|---|---|---|
| Se déplacer | Q D ou ← → | Q D | ← → | Croix ou stick gauche |
| Sauter | Z, ↑ ou Espace | Z | ↑ | ✕ |
| Garder | S, ↓ ou Maj | S | ↓ | L1 |
| Coup léger / moyen / lourd | J / K / L | F / G / H | J / K / L | □ / △ / ○ |
| Pouvoir spécial | I | T | I | R1 ou R2 |
| Ruée, esquive | O, ou deux appuis sur une direction | R | O | L2 |
| Pause | Échap ou P | | | Options |

Les lettres sont celles d'un clavier AZERTY ; le jeu lit la position des touches, donc un clavier QWERTY
fonctionne aux mêmes emplacements (A D W S). Toutes les touches se modifient dans Options.

Mécaniques : **projection** (avant + coup lourd au contact, passe la garde), **enchaînements**
(léger → moyen → lourd → spécial, chaque coup annulant le précédent s'il touche), **contre** (lever la garde
juste avant l'impact), **esquive arrière** (invulnérable un court instant), **garde brisée** (trop de coups
bloqués étourdissent), **finition** (K.O. porté par un pouvoir spécial).

## Tests et mesures
| Commande | Rôle | Prérequis |
|---|---|---|
| `npm test` | 112 tests de la simulation et de la sauvegarde | Node 21 ou plus |
| `npm run balance` | Rapport d'équilibrage, 1 800 matchs IA contre IA | Node |
| `npm run smoke` | Parcours complet au clavier dans Chrome, 50 vérifications | Python, Playwright, serveur lancé |
| `python3 tests/browser/gamepad.py` | Manettes simulées, 20 vérifications | idem |
| `npm run soak` | Endurance : matchs enchaînés dans tous les modes, détection de fuites | idem |

En jeu, **F3** affiche les images par seconde, la durée des images, les ressources graphiques, la mémoire
et le moteur de rendu. Résultats détaillés : `docs/RAPPORT-DE-TESTS.md`.

## Perspectives d'évolution

Cette version est une première base jouable, pas un jeu de combat abouti. Les manques sont
connus et ordonnés par importance.

**Profondeur du combat — la priorité.** Il manque l'axe haut/bas : pas d'accroupissement, donc
pas de coups bas, pas d'overhead, pas de garde haute contre garde basse. Or tout jeu de combat
repose sur ce pierre-feuille-ciseaux. Sans lui, il n'y a pas de jeu de devinette.

| Manque | Effet |
|---|---|
| Accroupissement, coups hauts et bas | Aucun jeu de mix-up — le plus gros trou |
| 6 coups par personnage | Répertoire épuisé en quelques minutes |
| Coups directionnels (avant+coup, bas+coup, saut directionnel) | Triplerait le répertoire sans nouveau personnage |
| Lanceur et combo aérien | Pas de longs enchaînements |
| Sortie de projection | Les saisies sont actuellement inévitables |
| Jeu au relevé (roulade, relevé rapide, contre) | Être au sol n'offre aucun choix |
| Barres de pouvoir multiples, coups renforcés, ultime | Une seule jauge, un seul pouvoir par personnage |
| Finition cinématique | Absente |
| Données de frames en entraînement | Indispensable pour progresser |

**Personnages.** Trois combattants, c'est trop peu pour que le déblocage de personnages ait un
sens. Chaque ajout doit être une étude — tradition martiale, armes, archétype de jeu, histoire —
et non une variation de couleurs. Un mode histoire ou arcade suivrait naturellement.

**Visuel.** Les modèles sont générés par script : l'approche plafonne sur les visages et les
expressions. Des modèles faits à la main, et surtout un squelette standard permettant d'utiliser
des animations issues de capture de mouvement, changeraient le rendu bien plus que n'importe
quelle retouche du générateur.

**Le reste.** Plein écran, plusieurs arènes, musique composée plutôt que synthétisée, commandes
tactiles, et le multijoueur en ligne — dont l'architecture est étudiée dans `docs/MULTIJOUEUR.md`
mais dont rien n'est construit.

Ce qui est solide et mérite d'être gardé : le moteur. La simulation est séparée du rendu,
déterministe, à pas fixe, testée, et son état se copie — ce sont les fondations coûteuses à
ajouter après coup, et elles conditionnent le jeu en ligne. La profondeur se greffe dessus.

## Architecture
```
index.html, css/        page, HUD et styles
src/sim/                simulation pure et déterministe (aucun rendu) : match, combattant, personnages, IA
src/core/fixedStep.js   boucle à pas fixe (60 pas par seconde)
src/render/             Three.js : modèles GLB, poses et animation, arène, caméra, effets, rendu stylisé
src/main.js             écrans, modes de jeu, orchestration
src/input.js            clavier et manettes, par joueur, reconfigurables
src/progress.js         progression et réglages : sauvegarde locale versionnée
src/quality.js          qualité graphique adaptative
src/audio.js, perf.js   sons synthétisés, mesures de performances
assets/models/          modèles 3D des combattants (GLB)
tools/art/              scripts Blender qui génèrent les modèles (inutiles pour jouer)
tools/                  équilibrage ; tests/ : tests unitaires et tests navigateur
vendor/                 Three.js r187 et son chargeur glTF (licence MIT)
```

## Documentation
`CHANGELOG.md` · `docs/RAPPORT-DE-TESTS.md` · `docs/EQUILIBRAGE.md` · `docs/FEUILLE-DE-ROUTE.md` ·
`docs/MULTIJOUEUR.md` · `docs/DIRECTION-ARTISTIQUE.md` · `tools/art/README.md`

## Licence

Deux ensembles distincts, détaillés dans `LICENSE` :

- **Le code** (moteur, interface, outils, tests) est sous licence **MIT** : libre de réutilisation,
  de modification et d'intégration dans d'autres projets, y compris commerciaux, à condition de
  conserver la mention de copyright.
- **Les personnages et les ressources** (`assets/`, les noms et apparences de Modou, Themba et
  Lekishon, le nom « Afro Fighters ») sont **réservés**. Cloner le dépôt et lancer le jeu pour
  l'essayer ou l'étudier est permis ; en republier une version modifiée ne l'est pas.

Three.js est sous licence MIT (`vendor/THREE_LICENSE`).

## Signaler un problème

Les retours sont bienvenus par les *issues* du dépôt : bug, confusion dans les commandes,
déséquilibre entre combattants, problème de performances (donner alors les chiffres affichés
par **F3** et le modèle de la machine).
