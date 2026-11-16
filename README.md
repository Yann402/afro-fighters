# Afro Fighters — Légendes de l'Arène

Jeu de combat en 3D jouable dans le navigateur, inspiré de trois traditions guerrières africaines.
Version 1.3.

| Combattant | Inspiration | Style | Pouvoir spécial |
|---|---|---|---|
| **Modou**, le Roc de la Médina | Lutte sénégalaise (laamb) | Lutteur : saisies, charge armurée | **Bàkk** : danse de défi, puis projection imblocable |
| **Themba**, l'Orage du Veld | Guerrier zoulou | Équilibré : lance iklwa, bouclier isihlangu | **Impondo Zankomo** : charge en « cornes du buffle » |
| **Lekishon**, le Faucon de la Savane | Guerrier maasaï | Longue portée, aérien | **Adumu** : sauts rituels, puis piqué de lance |

Les personnages sont fictifs. Ils s'inspirent de ces cultures sans prétendre en reproduire fidèlement les codes.

## Lancer le jeu
Le jeu est un site statique : il n'y a rien à compiler ni à installer.
```
npm start            # ou : python3 -m http.server 8000
```
puis ouvrir `http://localhost:8000`. Ouvrir `index.html` directement depuis le disque ne fonctionne pas
(les navigateurs bloquent le chargement des modules et des modèles 3D hors d'un serveur).

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
