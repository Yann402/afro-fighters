#!/usr/bin/env python3
"""Test fonctionnel de bout en bout au clavier, dans Chrome sans interface.
Vérifie : menus, sélection, difficulté, déplacement, coups, saut, pause, recommencer, retour à la sélection,
affichage des mesures (F3), absence d'erreur JavaScript. Capture d'écran en option.

Usage : python3 tests/browser/smoke.py [--url http://localhost:8000/] [--shots dossier]
"""
import argparse, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8000/')
ap.add_argument('--shots')
ap.add_argument('--chrome', default='/usr/bin/google-chrome')
args = ap.parse_args()
fails, errors = [], []

def check(name, cond, detail=''):
    print(('OK    ' if cond else 'ÉCHEC ') + name + (f'  [{detail}]' if detail and not cond else ''))
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=args.chrome, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(args.url); time.sleep(2.5)
    S = lambda: pg.evaluate("(()=>{const g=window.__afro,S=g.S,m=S.match;return {state:S.state,diff:S.difficulty,pc:S.playerChar,phase:m&&m.phase,f:m&&{st:m.fighters[0].state,x:m.fighters[0].x,mv:m.fighters[0].move&&m.fighters[0].move.id,y:m.fighters[0].y}}})()")
    shot = lambda n: args.shots and pg.screenshot(path=f'{args.shots}/{n}.png')
    # l'IA adverse est neutralisée pour que les vérifications de commandes soient déterministes
    passive = "window.__afro.S.ai.think=()=>({held:{},pressed:{}})"

    check('écran titre au démarrage', S()['state'] == 'title'); shot('1-titre')
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); time.sleep(0.4)
    check('écran des commandes', S()['state'] == 'controls')
    pg.keyboard.press('Escape'); time.sleep(0.3)
    pg.keyboard.press('Enter'); time.sleep(0.8)
    check('sélection du combattant', S()['state'] == 'select')
    pg.keyboard.press('ArrowRight'); time.sleep(0.8); shot('2-selection')
    check('changement de combattant', S()['pc'] == 'themba', S()['pc'])
    pg.keyboard.press('Enter'); time.sleep(0.4)
    check('choix de la difficulté', S()['state'] == 'diff')
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); time.sleep(0.5)
    s = S(); check('combat lancé en difficulté normale', s['state'] == 'fight' and s['diff'] == 'normal', str(s))
    pg.evaluate(passive)
    for _ in range(40):
        if S()['phase'] == 'fight': break
        time.sleep(0.5)
    check('la manche démarre', S()['phase'] == 'fight')
    x0 = S()['f']['x']
    pg.keyboard.down('KeyD'); time.sleep(1.2); pg.keyboard.up('KeyD')
    check('déplacement vers la droite', S()['f']['x'] > x0 + 0.2, f"{x0} -> {S()['f']['x']}")
    seen = set()
    def press_and_watch(key, want):
        pg.keyboard.press(key)
        for _ in range(12):
            f = S()['f']; seen.add(f['mv']); seen.add(f['st'])
            if want in seen: return True
            time.sleep(0.05)
        return want in seen
    check('coup léger (J)', press_and_watch('KeyJ', 'light')); time.sleep(1.2)
    check('coup lourd (K)', press_and_watch('KeyK', 'heavy')); time.sleep(1.5)
    pg.keyboard.press('KeyW'); jumped = False
    for _ in range(20):
        if S()['f']['y'] > 0.1: jumped = True; break
        time.sleep(0.05)
    check('saut (Z/W)', jumped); time.sleep(1.5)
    pg.evaluate("window.__afro.S.match.fighters[0].meter=100"); time.sleep(0.2)
    check('pouvoir spécial (L) avec jauge pleine', press_and_watch('KeyL', 'special')); time.sleep(0.6); shot('3-special')
    time.sleep(2.5); shot('4-combat')
    pg.keyboard.press('F3'); time.sleep(0.8)
    txt = pg.evaluate("(document.getElementById('perf')||{}).textContent||''")
    check('mesures de performances (F3)', 'img/s' in txt and 'géométries' in txt, txt[:80]); shot('5-mesures')
    pg.keyboard.press('F3')
    pg.keyboard.press('Escape'); time.sleep(0.4)
    check('pause', S()['state'] == 'pause')
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); time.sleep(0.6)
    s = S(); check('recommencer le combat', s['state'] == 'fight' and s['phase'] == 'intro', str(s))
    pg.keyboard.press('Escape'); time.sleep(0.4)
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); time.sleep(0.6)
    check('retour à la sélection', S()['state'] == 'select')
    pg.keyboard.press('Escape'); time.sleep(0.4)
    check("retour à l'écran titre", S()['state'] == 'title')
    check('aucune erreur JavaScript', not errors, '; '.join(errors[:3]))
    b.close()
print('RÉSULTAT :', 'OK' if not fails else f'ÉCHEC ({len(fails)})')
sys.exit(1 if fails else 0)
