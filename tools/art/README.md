# Production des modèles 3D

Les combattants sont générés par des scripts Blender, sans intervention manuelle, puis exportés en GLB
dans `assets/models/`. **Le jeu n'a pas besoin de Blender** : il charge les fichiers GLB déjà présents
dans le dépôt. Blender ne sert qu'à les régénérer.

| Fichier | Rôle |
|---|---|
| `lib/forge.py` | Outils de modélisation : volumes, fusion en une peau, creusement, peinture par sommet, squelette, export |
| `lib/human.py` | Corps stylisé commun : squelette, corps, tête, yeux, mains |
| `themba.py` | Themba : proportions, visage, tenue, bouclier, lance → `assets/models/themba.glb` |
| `viewer.html` | Visionneuse Three.js avec l'éclairage et les matériaux du jeu |
| `capture.py` | Planche de contrôle : captures de la visionneuse sous plusieurs angles |
| `requirements.txt` | Blender (`bpy` 5.3.0), avec empreintes SHA-256 |

## Régénérer un modèle
```
python3.13 -m venv .venv-art
.venv-art/bin/pip install --require-hashes --no-deps -r tools/art/requirements.txt
.venv-art/bin/pip install cattrs cython "numpy>=2.2,<3" requests zstandard
.venv-art/bin/python tools/art/themba.py          # environ 10 secondes
npm start                                          # puis http://localhost:8000/tools/art/viewer.html
python3 tools/art/capture.py assets/models/themba.glb planche.png
```

## Méthode
1. **Ébauche** : des volumes simples (ellipsoïdes, capsules, enveloppes convexes) posés aux emplacements des masses du corps.
2. **Fusion** : remaillage volumique en une seule peau, lissage, allègement au nombre de triangles voulu.
3. **Détails** : orbites, bouche et narines creusées ; tête et mains en pièces rigides plus fines.
4. **Couleur** : peinte par sommet (teintes, creux assombris, taches de pelage) ; texture image pour le bouclier.
5. **Squelette** : 17 os, mêmes noms pour tous les combattants ; poids de peau automatiques.
6. **Accessoires** : pièces rigides fixées aux os, posées sur la peau par projection.

## Conventions à respecter (le jeu en dépend)
- Le personnage regarde vers -Y dans Blender, Z vers le haut, sa gauche en +X.
- Pose de repos : jambes droites, bras écartés de 35° (`ARM_ANGLE`). Le jeu compense cet angle (`src/render/glbFighter.js`).
- Noms des os : `hips spine chest neck head upperArmL/R forearmL/R handL/R thighL/R shinL/R footL/R`.
- Un objet nommé `shield` fixé à `forearmL` est maintenu face à l'adversaire par le jeu ; son pivot doit être à la prise en main.
- Budget indicatif : 45 000 triangles et 1,5 Mo par combattant.

## Licence
Blender (`bpy`) est sous licence GPL-3.0. Les scripts de ce dossier s'appuient sur son interface de
programmation ; les fichiers GLB produits et le code du jeu ne contiennent aucun code de Blender.
