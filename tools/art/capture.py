#!/usr/bin/env python3
"""Capture un modèle GLB dans la visionneuse Three.js (Chrome sans interface) sous plusieurs angles
et assemble une planche de contrôle. C'est le rendu réel du jeu, pas un rendu Blender.

Usage : python3 tools/art/capture.py assets/models/themba.glb sortie.png [--views "yaw,dist,h;..."] [--js "code"]
Un serveur statique doit servir la racine du dépôt (--base http://localhost:8000).
"""
import argparse, sys, time, json
from playwright.sync_api import sync_playwright
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('model'); ap.add_argument('out')
ap.add_argument('--views', default='25,4.4,0.95;90,4.4,0.95;180,4.4,0.95;-40,1.5,1.62')
ap.add_argument('--base', default='http://localhost:8000')
ap.add_argument('--size', default='560x720')
ap.add_argument('--js', default='')
ap.add_argument('--style', default='1')
ap.add_argument('--cols', type=int, default=4)
a = ap.parse_args()
W, H = map(int, a.size.split('x'))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('pageerror', lambda e: logs.append('ERREUR ' + str(e)))
    pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None)
    pg.goto(f"{a.base}/tools/art/viewer.html?model=../../{a.model}&style={a.style}")
    for _ in range(60):
        st = pg.evaluate("window.__viewer ? [window.__viewer.state.ready, window.__viewer.state.error] : [false, null]")
        if st[0] or st[1]: break
        time.sleep(0.5)
    print('état :', st, '| stats :', pg.evaluate("window.__viewer.state.stats"))
    if a.js: print('js :', pg.evaluate(a.js))
    shots = []
    for i, v in enumerate(a.views.split(';')):
        yaw, dist, h = map(float, v.split(','))
        pg.evaluate(f"Object.assign(window.__viewer.state, {{yaw:{yaw}, dist:{dist}, h:{h}}})"); time.sleep(1.2)
        f = f'/tmp/_cap{i}.png'; pg.screenshot(path=f); shots.append(Image.open(f))
    b.close()
cols = min(a.cols, len(shots)); rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, H * rows))
for i, im in enumerate(shots): sheet.paste(im, ((i % cols) * W, (i // cols) * H))
sheet.save(a.out)
print('\n'.join(logs[:8]) or 'aucune erreur de page')
