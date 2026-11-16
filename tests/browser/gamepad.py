#!/usr/bin/env python3
"""Vérifie la prise en charge des manettes avec des manettes SIMULÉES (API Gamepad remplacée dans la page).

Ce test valide la logique du jeu : correspondance des boutons, navigation dans les menus, deux manettes
en mode deux joueurs, pause. Il ne remplace pas un essai avec une vraie manette PS4/PS5, qui seul
confirme que le navigateur et le système exposent bien la disposition « standard ».

Usage : python3 tests/browser/gamepad.py [--url http://localhost:8000/]
"""
import argparse, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8000/')
ap.add_argument('--chrome', default='/usr/bin/google-chrome')
args = ap.parse_args()
fails, errors, n = [], [], [0]
def check(name, cond, detail=''):
    n[0] += 1; print(('OK    ' if cond else 'ÉCHEC ') + name + (f'  [{detail}]' if detail and not cond else ''))
    if not cond: fails.append(name)

FAKE = """
window.__pads = [0, 1].map((i) => ({ index: i, id: 'Manette simulée ' + (i + 1) + ' (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }));
window.__padCount = 1;
navigator.getGamepads = () => window.__pads.slice(0, window.__padCount);
window.__hold = (pad, btn, on) => { const b = window.__pads[pad].buttons[btn]; b.pressed = on; b.value = on ? 1 : 0; };
window.__axis = (pad, x) => { window.__pads[pad].axes[0] = x; };
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=args.chrome, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script(FAKE)
    pg.goto(args.url)
    for _ in range(40):
        if pg.evaluate("!!(window.__afro && window.__afro.S.screen)"): break
        time.sleep(0.5)
    time.sleep(1)
    ev = pg.evaluate
    def tap(pad, btn, hold=0.7, after=0.5): ev(f"window.__hold({pad},{btn},true)"); time.sleep(hold); ev(f"window.__hold({pad},{btn},false)"); time.sleep(after)
    S = lambda: ev("(()=>{const S=window.__afro.S,m=S.match;const F=(f)=>f&&{st:f.state,mv:f.move&&f.move.id,x:f.x,y:f.y};return {screen:S.screen,i:S.menuIndex,mode:S.mode,phase:m&&m.phase,a:m&&F(m.fighters[0]),b:m&&F(m.fighters[1])}})()")
    def saw(pad, btn, want, who='a'):
        ev(f"window.__hold({pad},{btn},true)"); ok = False
        for _ in range(30):
            f = S()[who]
            if want in (f['mv'], f['st']): ok = True; break
            time.sleep(0.05)
        ev(f"window.__hold({pad},{btn},false)"); time.sleep(2.2)
        return ok
    def wait_fight():
        for _ in range(60):
            if S()['phase'] == 'fight': return True
            time.sleep(0.5)
        return False

    tap(0, 13); check('menus : croix bas déplace la sélection', S()['i'] == 1, str(S()))
    tap(0, 12); check('menus : croix haut', S()['i'] == 0)
    tap(0, 0); check('menus : ✕ valide', S()['screen'] == 'select')
    tap(0, 15); check('menus : croix droite', S()['i'] == 1)
    tap(0, 1); check('menus : ○ revient en arrière', S()['screen'] == 'title')
    tap(0, 0); tap(0, 0); tap(0, 0, after=1.0)
    check('combat lancé à la manette', S()['screen'] is None and S()['mode'] == 'solo', str(S()))
    ev("window.__afro.S.ctrl[1]=()=>({held:{},pressed:{}})"); wait_fight()
    x0 = S()['a']['x']; ev("window.__axis(0, 1)"); time.sleep(1.2); ev("window.__axis(0, 0)"); time.sleep(0.5)
    check('stick gauche : déplacement', S()['a']['x'] > x0 + 0.2)
    check('□ : coup léger', saw(0, 2, 'light'))
    check('△ : coup moyen', saw(0, 3, 'medium'))
    check('○ : coup lourd', saw(0, 1, 'heavy'))
    check('L2 : ruée', saw(0, 6, 'dash'))
    check('L1 : garde', saw(0, 4, 'guard'))
    ev("window.__afro.S.match.fighters[0].meter=100"); time.sleep(0.3)
    check('R1 : pouvoir spécial', saw(0, 5, 'special')); time.sleep(3)
    ev("window.__hold(0,0,true)"); up = False
    for _ in range(30):
        if S()['a']['y'] > 0.1: up = True; break
        time.sleep(0.05)
    ev("window.__hold(0,0,false)"); check('✕ : saut', up); time.sleep(2)
    check('aide à l\'écran adaptée à la manette', '□' in ev("document.getElementById('fightHint').textContent"))
    tap(0, 9); check('Options : pause', S()['screen'] == 'pause')
    ev("window.__afro.open('title')"); time.sleep(0.5)
    # deux manettes
    ev("window.__padCount = 2"); ev("window.__afro.startFight('versus')"); time.sleep(0.5); wait_fight()
    check('deux joueurs : manette 1 pilote le joueur 1', saw(0, 2, 'light', 'a'))
    check('deux joueurs : manette 2 pilote le joueur 2', saw(1, 2, 'light', 'b'))
    ev("window.__hold(1,3,true)"); time.sleep(0.6); a = S()['a']; ev("window.__hold(1,3,false)")
    check('deux joueurs : la manette 2 n\'agit pas sur le joueur 1', a['mv'] is None, str(a))
    check('aucune erreur JavaScript', not errors, '; '.join(errors[:3]))
    b.close()
print(f"RÉSULTAT : {'OK' if not fails else 'ÉCHEC'} — {n[0] - len(fails)} vérifications réussies sur {n[0]} (manettes simulées)")
sys.exit(1 if fails else 0)
