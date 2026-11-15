#!/usr/bin/env python3
"""Test d'endurance dans un vrai navigateur (Chrome sans interface, piloté par Playwright).

Enchaîne des matchs complets IA contre IA, des changements de combattant et des retours aux menus,
et relève après chaque cycle les ressources graphiques vivantes et la mémoire JavaScript.
Le test échoue si le nombre de géométries ou de textures augmente d'un cycle à l'autre (fuite).

Usage :  python3 tests/browser/soak.py [--cycles 6] [--url http://localhost:8000/] [--legacy] [--json sortie.json]
Prérequis : pip install playwright ; un serveur statique sur le dossier du jeu (npm start).
--legacy : mesure la version 1.0 (ancienne interface de test), pour comparaison avant/après.
"""
import argparse, json, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--cycles', type=int, default=6)
ap.add_argument('--url', default='http://localhost:8000/')
ap.add_argument('--legacy', action='store_true')
ap.add_argument('--json')
ap.add_argument('--chrome', default='/usr/bin/google-chrome')
ap.add_argument('--speed', type=int, default=4)
args = ap.parse_args()

G = 'window.__game' if args.legacy else 'window.__afro'
SNAP = f"""(() => {{
  const g = {G}; if (window.gc) window.gc();
  const i = g.renderer.info; const m = performance.memory;
  return {{ geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0,
           heapMB: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null, sceneChildren: g.scene.children.length }};
}})()"""
ROSTER = ['modou', 'themba', 'lekishon']

def main():
    errors, rows = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=args.chrome, args=[
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
            '--enable-precise-memory-info', '--js-flags=--expose-gc'])
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
        pg.goto(args.url); time.sleep(2.5)
        rows.append({'cycle': 0, 'étape': 'écran titre', **pg.evaluate(SNAP)})
        for c in range(1, args.cycles + 1):
            ch = ROSTER[(c - 1) % 3]
            diff = ['facile', 'normal', 'difficile'][(c - 1) % 3]
            if args.legacy:
                pg.evaluate(f"(() => {{ const g={G}; g.S.playerChar='{ch}'; g.S.difficulty='{diff}'; g.startMatch(); window.__p1ai=new g.AIController('difficile',{c}); window.__speed={args.speed}; }})()")
            else:
                pg.evaluate(f"(() => {{ const g={G}; g.S.playerChar='{ch}'; g.S.difficulty='{diff}'; g.startMatch(); g.debug.p1ai=new g.AIController('difficile',{c}); g.debug.speed={args.speed}; }})()")
            t0 = time.time(); peak = 0
            while time.time() - t0 < 240:
                st = pg.evaluate(f"{G}.S.state")
                s = pg.evaluate(SNAP); peak = max(peak, s['geometries'])
                if st == 'result': break
                time.sleep(1.0)
            else:
                errors.append(f'cycle {c} : match non terminé en 240 s')
            perf = None if args.legacy else pg.evaluate(f"{G}.perf.snapshot()")
            rows.append({'cycle': c, 'étape': f'fin de match ({ch}, IA {diff})', **pg.evaluate(SNAP), 'pic géométries': peak, 'durée s': round(time.time() - t0, 1),
                         **({'img/s': perf['fps'], 'image p95 ms': perf['frameMs']['p95'], 'sim ms': perf['cpuMs']['sim'], 'rendu ms': perf['cpuMs']['render'], 'abandonné s': perf['loop']['droppedSec']} if perf else {})})
            # revanche une fois sur deux, puis sélection : on fait défiler les trois combattants, puis retour au titre
            time.sleep(1.0)
            if c % 2 == 0:
                pg.keyboard.press('Enter'); time.sleep(1.5)       # Revanche
                pg.keyboard.press('Escape'); time.sleep(0.4)      # Pause
                pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter')  # Changer de combattant
            else:
                pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter')   # Changer de combattant
            time.sleep(0.6)
            for _ in range(6): pg.keyboard.press('ArrowRight'); time.sleep(0.15)
            pg.keyboard.press('Escape'); time.sleep(0.8)          # retour au titre
            st = pg.evaluate(f"{G}.S.state")
            if st != 'title': errors.append(f'cycle {c} : état « {st} » au lieu de « title »')
            rows.append({'cycle': c, 'étape': 'retour au titre', **pg.evaluate(SNAP)})
        b.close()

    cols = ['cycle', 'étape', 'geometries', 'textures', 'programs', 'sceneChildren', 'heapMB', 'pic géométries', 'durée s', 'img/s', 'image p95 ms', 'sim ms', 'rendu ms', 'abandonné s']
    print(' | '.join(cols))
    for r in rows: print(' | '.join(str(r.get(k, '')) for k in cols))
    titles = [r for r in rows if r['étape'] == 'retour au titre']
    leak_g = titles[-1]['geometries'] - titles[0]['geometries']
    leak_t = titles[-1]['textures'] - titles[0]['textures']
    heap = [r['heapMB'] for r in titles if r['heapMB'] is not None]
    print(f"\nGéométries : {titles[0]['geometries']} après le 1er cycle, {titles[-1]['geometries']} après le dernier (écart {leak_g:+d})")
    print(f"Textures   : {titles[0]['textures']} -> {titles[-1]['textures']} (écart {leak_t:+d})")
    if heap: print(f"Mémoire JS après ramasse-miettes : {heap[0]} Mo -> {heap[-1]} Mo (pic {max(r['heapMB'] or 0 for r in rows)} Mo)")
    print('Erreurs de page :', errors or 'aucune')
    if args.json: json.dump({'rows': rows, 'errors': errors}, open(args.json, 'w'), ensure_ascii=False, indent=1)
    ok = leak_g <= 0 and leak_t <= 0 and not errors
    print('RÉSULTAT :', 'OK' if ok else 'ÉCHEC')
    sys.exit(0 if ok else 1)

main()
