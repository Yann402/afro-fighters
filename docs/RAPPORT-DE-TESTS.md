# Rapport de tests — version 1.3

Tous les tests ci-dessous ont été exécutés sur le code final de la branche. Ils sont rejouables
(commandes dans `README.md`).

## Résultats
| Suite | Portée | Résultat |
|---|---|---|
| `npm test` | Simulation, IA, équilibrage, boucle, sauvegarde | **112 tests réussis sur 112** |
| `tests/browser/smoke.py` | Parcours complet au clavier dans Chrome | **50 vérifications sur 50**, aucune erreur JavaScript |
| `tests/browser/gamepad.py` | Manettes simulées (une puis deux) | **20 vérifications sur 20** |
| `tests/browser/soak.py` | 6 cycles enchaînés, tous modes | **Aucune fuite, aucune erreur** |
| `tools/balance.mjs` | 1 800 matchs IA contre IA | Voir `EQUILIBRAGE.md` : niveau difficile équilibré, niveaux facile et normal non |

## Détail des tests unitaires (112)
| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `fuzz.test.mjs` | 4 | 324 matchs d'entrées aléatoires, 216 contre les IA, 216 entre IA : positions, points de vie, jauges, états orphelins ou figés vérifiés à chaque image ; déterminisme |
| `moves.test.mjs` | 67 | Pour chaque paire de combattants : coup léger, portée exacte du coup lourd, garde contre coups et projections, projection contre adversaire en l'air, enchaînement, attaque sautée, pouvoir spécial |
| `mechanics.test.mjs` | 23 | Coup moyen, ruée, esquive invulnérable, contre et sa punition, martèlement de la garde, garde brisée et régénération, finition, entraînement, jongle limitée, copie et restauration de l'état du match |
| `progress.test.mjs` | 10 | Sauvegarde et restauration, niveaux et récompenses, série de victoires, fichier tronqué et copie de secours, mise à niveau depuis la version 1, valeurs invalides, déblocages falsifiés, export et import, stockage indisponible |
| `fixedStep.test.mjs` | 5 | Aucun pas perdu de 30 à 240 images par seconde, surcharge bornée, retour d'un onglet en arrière-plan |
| `balance.test.mjs` | 3 | Garde-fous larges d'équilibrage, hiérarchie des trois niveaux d'IA |

## Parcours dans le navigateur (50 vérifications)
Menus et options ; modification, sauvegarde et rétablissement d'une touche ; profil ; liste des coups et
sa démonstration ; combat contre l'ordinateur avec toutes les commandes (déplacement, trois coups, ruée,
esquive par double appui, saut, garde, pouvoir spécial) ; mesures F3 ; pause et aide ; match gagné jusqu'à
l'écran de victoire ; expérience enregistrée ; entraînement (pas de K.O., panneau, mannequin réglable) ;
deux joueurs (chacun ses touches, sans interférence) ; **progression restaurée après rechargement de la page**.

## Endurance (6 cycles)
Chaque cycle : un match complet (contre l'ordinateur, à deux, ou 60 s d'entraînement), revanche ou pause,
défilement des trois combattants, liste des coups avec changement de combattant, profil, retour au titre.

| Mesure | Après le 1er cycle | Après le 6e |
|---|---|---|
| Géométries en mémoire graphique | 275 | 275 |
| Textures | 13 | 13 |
| Mémoire JavaScript (après ramasse-miettes) | 16,8 Mo | 17,5 Mo |
| Erreurs de page | 0 | 0 |

Détail : `mesures/endurance-v1.3.txt`.

## Charge de rendu (relevée en combat, Themba contre Lekishon)
| Qualité | Appels de dessin | Triangles par image | Ombres | Liseré |
|---|---|---|---|---|
| Haute | 304 | 242 000 | 2 048 px | Oui |
| Basse | 204 | 118 000 | Non | Non |

Temps processeur par image : simulation 0,4 ms, préparation du rendu 4 à 7 ms. Poids du jeu : 7 Mo
(modèles 3,2 Mo, Three.js 2,3 Mo). Le mode automatique a été vérifié : des images lentes le font descendre
de haute à moyenne puis à basse ; des images rapides ne le font pas bouger.

## Ce que ces tests ne prouvent pas
| Sujet | Pourquoi | Comment vérifier |
|---|---|---|
| Images par seconde réelles | Tests exécutés en rendu **logiciel** (Mesa llvmpipe, sans carte graphique) : 2 à 4 images par seconde ici, sans rapport avec une vraie machine | Touche F3 en combat sur ta machine |
| Manettes PS4 et PS5 | Seule la logique est testée, avec des manettes simulées | Brancher une manette : un message s'affiche, puis jouer |
| Firefox, Edge | Seul Chrome sans interface a été utilisé | Ouvrir le jeu dans ces navigateurs |
| Disposition AZERTY affichée | Le navigateur de test n'expose pas la disposition du clavier ; les touches sont lues par position, ce qui est testé | Vérifier les lettres affichées dans l'aide |
| Plaisir de jeu, lisibilité, difficulté | Aucun humain n'a joué cette version | Jouer |
| Son | Le navigateur de test n'a pas de sortie audio | Écouter |
| Équilibrage entre joueurs | Mesuré entre IA uniquement | Parties réelles |
