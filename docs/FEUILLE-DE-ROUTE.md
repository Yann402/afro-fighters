# Feuille de route

## État par version
| Version | Contenu | État |
|---|---|---|
| 1.0 | Bêta d'origine | Référence : branche `main`, commit `0ce78dc` |
| 1.1 | Stabilisation, tests, mesures, équilibrage | Fait |
| 1.2 | Refonte artistique | Fait, livré avec la 1.3 |
| 1.3 | Combat enrichi, modes, progression, deux joueurs | Fait |
| 2.0 | Comptes, sauvegarde en ligne, multijoueur, classements | Étudié (`MULTIJOUEUR.md`), rien de construit |

## Terminé et vérifié
- Trois combattants modélisés, animés, avec tenues et armes ; arène enrichie, trois ambiances.
- Coups léger, moyen, lourd ; projections ; attaques sautées ; pouvoirs spéciaux ; ruée ; esquive ; contre ; garde brisée ; finition.
- Modes : contre l'ordinateur (trois niveaux), deux joueurs, entraînement, liste des coups.
- Progression, récompenses, tenues, sauvegarde locale versionnée, export et import.
- Touches reconfigurables, qualité graphique adaptative, mesures de performances.
- État du match copiable et simulation déterministe (bases du jeu en ligne).

## Fait, mais à vérifier sur une vraie machine
- Images par seconde réelles : aucune mesure sur du vrai matériel (voir `mesures/README.md`). Touche F3.
- Manettes PS4 et PS5 réelles : la logique est testée avec des manettes simulées seulement.
- Firefox et Edge : non testés. Seul Chrome (sans interface) l'a été.
- Jouabilité ressentie : rythme, lisibilité, difficulté. Aucun humain n'a encore joué cette version.

## Reste à développer
| Sujet | Détail |
|---|---|
| Qualité des modèles | Visages encore simples, perles anguleuses, pas d'expressions. Les mains ne s'ouvrent ni ne se ferment |
| Animation | Pas de pieds ancrés au sol (cinématique inverse), tissus et tresses sans balancement propre |
| Coups ultimes | Un seul niveau de pouvoir spécial ; pas d'ultime distinct |
| Équilibrage | Modou trop fort contre les IA facile et normale (voir `EQUILIBRAGE.md`) ; aucun retour de joueurs |
| Contenu | Une seule arène (trois ambiances), trois combattants, pas de mode histoire ni arcade |
| Personnalisation | Tenues par reteinte seulement : pas de pièces de costume alternatives |
| Son | Entièrement synthétisé ; pas de musique composée ni de voix |
| Mobile | Pas de commandes tactiles |
| En ligne | Tout : comptes, sauvegarde distante, parties privées, matchmaking, classements |
