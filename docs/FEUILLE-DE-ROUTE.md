# Feuille de route

| Version | Contenu | État |
|---|---|---|
| 1.0 | Bêta d'origine | Référence (`main`, commit `0ce78dc`) |
| 1.1 | Stabilisation, tests, mesures, équilibrage | Fait, en attente de relecture (Pull Request) |
| 1.2 | Refonte artistique : 3 combattants, animations, arène, effets, interface, qualité graphique adaptative | À faire — voir `DIRECTION-ARTISTIQUE.md` |
| 1.3 | Coups moyens, esquive, contre ; entraînement ; liste des coups ; progression et sauvegarde locale ; 2 joueurs en local ; commandes personnalisables | À faire |
| 2.0 | Comptes, sauvegarde en ligne, multijoueur, classements | Étude d'architecture avant tout développement |

Le séquencement proposé est conservé, avec un ajustement : la qualité graphique adaptative passe en 1.2,
car c'est la refonte visuelle qui alourdira le rendu.

## Préparation du multijoueur (rien n'est construit)
La simulation est déjà séparée du rendu, à pas fixe et **déterministe** (vérifié par un test). Ce sont les
trois prérequis du *rollback netcode*, la technique de référence des jeux de combat en ligne. Il manque :
la sauvegarde et la restauration de l'état complet d'un match, et l'absence de toute lecture d'horloge ou
de hasard non contrôlé dans `src/sim/` (c'est le cas aujourd'hui). L'étude comparée (rollback, délai d'entrée,
serveur autoritaire, coûts, triche, déconnexions) sera présentée avant la v2.
