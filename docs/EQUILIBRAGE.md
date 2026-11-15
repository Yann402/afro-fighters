# Équilibrage — méthode et résultats (v1.1)

## Méthode
`node tools/balance.mjs 100` fait jouer les IA entre elles : 100 matchs par confrontation et par côté,
soit 600 matchs par niveau, avec des graines fixes (résultat reproductible). Le rapport complet est dans
`docs/mesures/equilibrage-v1.1.txt`.

Limite à garder en tête : ce sont des IA, pas des joueurs. Un écart entre IA peut venir de la façon dont
l'IA joue un personnage, pas du personnage lui-même. La marge d'erreur est d'environ ±5 points par confrontation.

## Taux de victoire par confrontation

| Confrontation | v1.0 normal | v1.1 normal | v1.0 difficile | v1.1 difficile |
|---|---|---|---|---|
| Modou – Themba | 47 – 53 | 48 – 52 | 72 – 28 | **74 – 26** |
| Modou – Lekishon | 19 – 81 | 51 – 49 | 39 – 61 | 46 – 54 |
| Themba – Lekishon | 34 – 66 | 47 – 53 | 98 – 2 | 50 – 50 |

Reste à corriger : Modou contre Themba en IA difficile. La saisie de Modou (rapide, imblocable, avec élan)
domine un adversaire dont le plan de jeu repose sur la garde. Ralentir la saisie a été testé et aggrave
d'autres confrontations ; le sujet est reporté à la v1.3, où l'esquive et les coups moyens changeront la donne.

En IA facile, Modou gagne 77 % des matchs entre IA : une IA qui ne garde pas et ne gère pas la distance
subit les projections. Cela ne concerne que les matchs IA contre IA de ce niveau.

## Pouvoirs spéciaux

Constat de l'audit : Adumu avait 62 frames d'invulnérabilité pour 195 dégâts.

| Spécial | v1.0 | Constat mesuré | v1.1 |
|---|---|---|---|
| Adumu | invulnérable 62 frames, 195 dégâts, suit l'adversaire | Aucun contre possible hors la garde : avec 62 frames, Lekishon monte à 77 % de victoires en IA difficile | Invulnérable 40 frames : le troisième bond peut être interrompu. Plus punissable en garde |
| Bàkk | 245 dégâts, imblocable, armure | C'était le vrai cas extrême : touche 66 à 80 % du temps, 162 à 195 dégâts par utilisation | 195 dégâts. Se contre en sautant ou en frappant pendant la charge |
| Impondo Zankomo | 234 dégâts en 3 coups, blocable | Bloqué 69 % du temps en IA difficile, presque sans effet | Dégâts d'usure 15 % → 25 % |

Le problème de l'Adumu n'était pas ses dégâts (inférieurs au Bàkk) mais son absence de risque.
Trois durées d'invulnérabilité ont été comparées (20, 40 et 62 frames) ; 40 donne les confrontations les plus proches de 50 – 50.

## Autres changements
- Bouclier de Themba : annulait tous les dégâts d'usure, donc garder était sans risque. Il les divise par deux.
- Saisie de Modou : élan de 0,45 m vers l'avant. Sans outil d'approche, Modou tombait à 7 % de victoires
  contre des IA qui tiennent la distance.
- Combo maximal observé : 20 à 21 % des points de vie. Aucun enchaînement infini trouvé.
