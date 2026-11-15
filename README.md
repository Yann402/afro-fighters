# Légendes de l'Arène — bêta

Jeu de combat en 3D, jouable directement dans le navigateur, inspiré de trois traditions guerrières africaines.

| Combattant | Inspiration | Style | Pouvoir spécial |
|---|---|---|---|
| **Modou**, le Roc de la Médina | Lutte sénégalaise (Laamb) | Lutteur : saisies, projections, super-armure | **Bàkk** : danse de défi, puis charge et projection |
| **Themba**, l'Orage du Veld | Guerrier zoulou | Équilibré : iklwa et bouclier isihlangu | **Impondo Zankomo** : charge en « cornes du buffle » |
| **Lekishon**, le Faucon de la Savane | Guerrier maasaï | Longue portée, aérien | **Adumu** : sauts rituels, puis piqué de lance |

Les personnages sont fictifs. Ils s'inspirent de ces cultures sans prétendre en représenter fidèlement les codes.

## Jouer

- En ligne : *(lien GitHub Pages)*
- En local : servir le dossier avec n'importe quel serveur statique, par exemple `python3 -m http.server`, puis ouvrir `http://localhost:8000`.

## Commandes

| Action | Clavier | Manette PS4 / PS5 |
|---|---|---|
| Se déplacer | Q / D en AZERTY (A / D en QWERTY), ou ← → | Croix directionnelle ou stick gauche |
| Sauter | Z en AZERTY (W en QWERTY), ↑ ou Espace | ✕ |
| Garder | S, ↓, Maj, ou reculer | L1 / R1, ou reculer |
| Coup léger / lourd | J / K | □ / △ |
| Projection | Avancer + K (au contact) | Avancer + △ |
| Pouvoir spécial (jauge pleine) | L | ○ ou R2 |
| Pause | Échap ou P | Options |

## Architecture

```
index.html        page, HUD et menus (HTML/CSS)
src/sim/          logique pure, sans rendu, testable dans Node
  match.js        manches, chronomètre, coups, garde, projections, événements
  fighter.js      machine à états d'un combattant
  characters.js   données des combattants (coups, frames, portées, spéciaux)
  ai.js           IA à trois niveaux de comportement
src/render/       rendu Three.js : modèles low-poly, poses, arène, caméra, effets
src/input.js      clavier + API Gamepad
src/audio.js      sons synthétisés (Web Audio)
vendor/           Three.js r187 (licence MIT)
```

- La logique tourne à 60 images/s fixes, indépendamment de l'affichage.
- Les animations sont générées par le code, avec un lissage entre les poses pour des transitions fluides.
- Il n'y a ni dépendance à installer ni étape de compilation : le site est statique.

## Limites connues (bêta)

- Une seule arène, un seul mode (contre l'ordinateur).
- L'équilibrage des personnages est encore approximatif.
- La manette est prise en charge via l'API Gamepad (Chrome, Edge, Firefox), mais pas encore testée sur une vraie manette.
- Le jeu est conçu pour ordinateur, pas pour mobile.
