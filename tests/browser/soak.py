#!/usr/bin/env python3
"""Test d'endurance dans un vrai navigateur (Chrome sans interface, piloté par Playwright).

Enchaîne des matchs complets dans tous les modes (contre l'ordinateur, deux joueurs, entraînement),
des changements de combattant, la liste des coups, le profil et des retours aux menus,
et relève après chaque cycle les ressources graphiques vivantes et la mémoire JavaScript.
Le test échoue si le nombre de géométries ou de textures augmente d'un cycle à l'autre (fuite).

C'est un test de STABILITÉ, pas de performances. Chrome sans interface utilise ici un rendu logiciel
(SwiftShader, sans carte graphique) : les colonnes « img/s » et « image p95 ms » décrivent cet
environnement et ne sont pas une référence de performances matérielles. Le moteur de rendu détecté
est écrit en tête du rapport. Pour des performances réelles : touche F3 dans le jeu, sur une vraie machine.

Usage :  python3 tests/browser/soak.py [--cycles 6] [--url http://localhost:8000/] [--json sortie.json]
Prérequis : pip install playwright ; un serveur statique sur le dossier du jeu (npm start).
"""
import argparse, json, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--cycles', type=int, default=6)
ap.add_argument('--url', default='http://localhost:8000/')
ap.add_argument('--json')
ap.add_argument('--chrome', default='/usr/bin/google-chrome')
ap.add_argument('--speed', type=int, default=4)
args = ap.parse_args()

G = 'window.__afro'
SNAP = f"""(() => {{
  const g = {G}; if (window.gc) window.gc();
  const i = g.renderer.info; const m = performance.memory;
  return {{ geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0,
           heapMB: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null, sceneChildren: g.scene.children.length }};
}})()"""
ROSTER = ['modou', 'themba', 'lekishon']
MODES = ['solo', 'solo', 'versus', 'solo', 'training']   # le cycle enchaîne les modes de jeu

def main():
    errors, rows = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=args.chrome, args=[
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
            '--enable-precise-memory-info', '--js-flags=--expose-gc'])
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
        pg.goto(args.url)
        for _ in range(40):
            if pg.evaluate("!!(window.__afro && window.__afro.S.screen)"): break
            time.sleep(0.5)
        time.sleep(1.5)
        env = pg.evaluate(f"{G}.perf.snapshot().renderer")
        pg.evaluate(f"{G}.quality.setMode('high')")       # qualité fixe : la mesure ne dépend pas du mode automatique
        rows.append({'cycle': 0, 'étape': 'écran titre', **pg.evaluate(SNAP)})
        for c in range(1, args.cycles + 1):
            ch, opp = ROSTER[(c - 1) % 3], ROSTER[c % 3]
            diff = ['facile', 'normal', 'difficile'][(c - 1) % 3]
            mode = MODES[(c - 1) % len(MODES)]
            pg.evaluate(f"(() => {{ const g={G}; g.S.p1='{ch}'; g.S.p2='{opp}'; g.S.difficulty='{diff}'; g.startFight('{mode}'); g.debug.p1ai=new g.AIController('difficile',{c}); g.debug.p2ai={'new g.AIController(\'normal\',' + str(c + 50) + ')' if mode != 'solo' else 'null'}; g.debug.speed={args.speed}; }})()")
            t0 = time.time(); peak = 0; limit = 60 if mode == 'training' else 240
            while time.time() - t0 < limit:
                s = pg.evaluate(SNAP); peak = max(peak, s['geometries'])
                if pg.evaluate(f"{G}.S.screen") == 'result': break
                time.sleep(1.0)
            else:
                if mode != 'training': errors.append(f'cycle {c} : match non terminé en {limit} s')
            perf = pg.evaluate(f"{G}.perf.snapshot()")
            label = {'solo': f'IA {diff}', 'versus': 'deux joueurs', 'training': 'entraînement, 60 s'}[mode]
            rows.append({'cycle': c, 'étape': f'fin de match ({ch} contre {opp}, {label})', **pg.evaluate(SNAP), 'pic géométries': peak, 'durée s': round(time.time() - t0, 1),
                         'img/s': perf['fps'], 'image p95 ms': perf['frameMs']['p95'], 'sim ms': perf['cpuMs']['sim'], 'rendu ms': perf['cpuMs']['render'], 'abandonné s': perf['loop']['droppedSec']})
            pg.evaluate(f"(() => {{ const g={G}; g.debug.p1ai=null; g.debug.p2ai=null; g.debug.speed=1; }})()")
            time.sleep(1.0)
            if mode == 'training':
                pg.keyboard.press('Escape'); time.sleep(0.5)
                for _ in range(5): pg.keyboard.press('ArrowDown')
                pg.keyboard.press('Enter')                    # Changer de combattant
            elif c % 2 == 0:
                pg.keyboard.press('Enter'); time.sleep(1.5)       # Revanche
                pg.keyboard.press('Escape'); time.sleep(0.5)      # Pause
                for _ in range(3): pg.keyboard.press('ArrowDown')
                pg.keyboard.press('Enter')                        # Changer de combattant
            else:
                pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter')   # Changer de combattant
            time.sleep(0.8)
            for _ in range(6): pg.keyboard.press('ArrowRight'); time.sleep(0.2)   # fait défiler les trois combattants
            pg.keyboard.press('Escape'); time.sleep(0.6)
            # liste des coups (démonstration) puis profil, puis retour au titre
            for _ in range(3): pg.keyboard.press('ArrowDown')
            pg.keyboard.press('Enter'); time.sleep(2.0)
            pg.keyboard.press('ArrowRight'); time.sleep(1.5); pg.keyboard.press('Escape'); time.sleep(0.6)
            for _ in range(4): pg.keyboard.press('ArrowDown')
            pg.keyboard.press('Enter'); time.sleep(0.8); pg.keyboard.press('Escape'); time.sleep(0.8)
            st = pg.evaluate(f"{G}.S.screen")
            if st != 'title': errors.append(f'cycle {c} : écran « {st} » au lieu de « title »')
            rows.append({'cycle': c, 'étape': 'retour au titre', **pg.evaluate(SNAP)})
        b.close()

    cols = ['cycle', 'étape', 'geometries', 'textures', 'programs', 'sceneChildren', 'heapMB', 'pic géométries', 'durée s', 'img/s', 'image p95 ms', 'sim ms', 'rendu ms', 'abandonné s']
    print(f"Moteur de rendu : {env['name']}")
    print('Nature des mesures : ' + ('STABILITÉ en rendu logiciel — img/s et durées d\'image non représentatives du matériel' if env['software'] else 'rendu matériel'))
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
    if args.json: json.dump({'renderer': env, 'rows': rows, 'errors': errors}, open(args.json, 'w'), ensure_ascii=False, indent=1)
    ok = leak_g <= 0 and leak_t <= 0 and not errors
    print('RÉSULTAT :', 'OK' if ok else 'ÉCHEC')
    sys.exit(0 if ok else 1)

main()
