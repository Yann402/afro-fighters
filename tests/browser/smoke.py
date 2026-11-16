#!/usr/bin/env python3
"""Test fonctionnel de bout en bout au clavier, dans Chrome sans interface.

Parcourt tous les modes : menus, options et reconfiguration des touches, profil, liste des coups et sa
démonstration, combat contre l'ordinateur (toutes les commandes), entraînement, deux joueurs, fin de match,
puis vérifie que la progression est restaurée après rechargement de la page.

Usage : python3 tests/browser/smoke.py [--url http://localhost:8000/] [--shots dossier]
"""
import argparse, json, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8000/')
ap.add_argument('--shots')
ap.add_argument('--chrome', default='/usr/bin/google-chrome')
args = ap.parse_args()
fails, errors, n = [], [], [0]

def check(name, cond, detail=''):
    n[0] += 1
    print(('OK    ' if cond else 'ÉCHEC ') + name + (f'  [{detail}]' if detail and not cond else ''))
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=args.chrome, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    def boot():
        pg.goto(args.url)
        for _ in range(40):
            if pg.evaluate("!!(window.__afro && window.__afro.S.screen)"): break
            time.sleep(0.5)
        time.sleep(1.0)
    boot()
    ev = pg.evaluate
    S = lambda: ev("""(()=>{const g=window.__afro,S=g.S,m=S.match;const F=(f)=>f&&{st:f.state,x:f.x,y:f.y,mv:f.move&&f.move.id,hp:f.hp,serial:f.moveSerial};
      return {screen:S.screen,mode:S.mode,i:S.menuIndex,p1:S.p1,p2:S.p2,diff:S.difficulty,phase:m&&m.phase,a:m&&F(m.fighters[0]),b:m&&F(m.fighters[1]),items:S.items.map(x=>x.label)}})()""")
    def key(k, wait=0.45): pg.keyboard.press(k); time.sleep(wait)
    def keys(seq, wait=0.45):
        for k in seq: key(k, wait)
    shot = lambda name: args.shots and pg.screenshot(path=f'{args.shots}/{name}.png')
    passive = "window.__afro.S.ctrl[1]=()=>({held:{},pressed:{}})"
    def wait_fight():
        for _ in range(60):
            if S()['phase'] == 'fight': return True
            time.sleep(0.5)
        return False
    def saw(key_code, want, tries=14, who='a'):
        """Appuie sur une touche et surveille l'apparition d'un coup ou d'un état."""
        pg.keyboard.press(key_code); seen = set()
        for _ in range(tries):
            f = S()[who]; seen.add(f['mv']); seen.add(f['st'])
            if want in seen: return True
            time.sleep(0.05)
        return False
    def settle(): time.sleep(2.2)

    # ── menus
    s = S(); check('écran titre, six entrées', s['screen'] == 'title' and len(s['items']) == 6, str(s['items'])); shot('01-titre')
    keys(['ArrowUp', 'Enter'])
    check('options', S()['screen'] == 'options')
    keys(['ArrowDown', 'ArrowRight'])
    check('qualité graphique modifiable et sauvegardée', ev("window.__afro.quality.mode") == 'high' and ev("window.__afro.progress.data.settings.quality") == 'high')
    key('ArrowLeft')
    keys(['ArrowDown', 'ArrowDown', 'Enter'])
    check('écran de reconfiguration des touches', S()['screen'] == 'bind')
    keys(['ArrowDown'] * 4 + ['Enter']); key('KeyU')
    check('touche du coup léger remplacée par U', ev("window.__afro.input.bindings.solo.light") == ['KeyU'], str(ev("window.__afro.input.bindings.solo.light")))
    check('commandes personnalisées sauvegardées', ev("JSON.parse(localStorage.getItem('afrofighters.save')).settings.bindings.solo.light") == ['KeyU'])
    shot('02-touches')
    key('Escape'); keys(['ArrowDown'] * 6 + ['Enter'])
    check('commandes par défaut rétablies', ev("window.__afro.input.bindings.solo.light") == ['KeyJ'])
    key('Escape'); check('retour au titre', S()['screen'] == 'title')
    keys(['ArrowDown'] * 4 + ['Enter'])
    check('profil', S()['screen'] == 'profile'); time.sleep(1); shot('03-profil')
    key('Escape')

    # ── liste des coups et démonstration
    keys(['ArrowDown'] * 3 + ['Enter']); time.sleep(1.5)
    s = S(); check('liste des coups : démonstration lancée', s['screen'] == 'moves' and s['mode'] == 'demo' and s['phase'] == 'fight', str(s))
    hp_max = ev("window.__afro.S.match.fighters[1].maxHp"); hit = False
    for _ in range(120):
        if S()['b']['hp'] < hp_max: hit = True; break
        time.sleep(0.3)
    check('la démonstration porte le coup sur l\'adversaire', hit); shot('04-liste-des-coups')
    for _ in range(8):
        if ev("window.__afro.S.demo.move.key") == 'special': break
        key('ArrowDown')
    spec = False
    for _ in range(300):
        if S()['a']['mv'] == 'special': spec = True; break
        time.sleep(0.15)
    check('la démonstration joue le pouvoir spécial sélectionné', spec)
    c0 = ev("window.__afro.S.match.fighters[0].char.id"); key('ArrowRight', 1.2)
    check('changement de combattant dans la liste des coups', ev("window.__afro.S.match.fighters[0].char.id") != c0)
    key('Escape'); s = S(); check('retour au titre, démonstration arrêtée', s['screen'] == 'title' and s['phase'] is None)

    # ── combat contre l'ordinateur
    keys(['Enter']); time.sleep(0.8)
    check('sélection du combattant', S()['screen'] == 'select')
    key('ArrowRight', 0.9); shot('05-selection')
    key('Enter'); check('choix de la difficulté', S()['screen'] == 'diff')
    key('Enter', 0.8)
    s = S(); check('combat lancé (Themba, difficulté retenue)', s['screen'] is None and s['mode'] == 'solo' and s['p1'] == 'themba', str(s))
    ev(passive); check('la manche démarre', wait_fight())
    x0 = S()['a']['x']
    pg.keyboard.down('KeyD'); time.sleep(1.2); pg.keyboard.up('KeyD')
    check('déplacement', S()['a']['x'] > x0 + 0.2)
    check('coup léger (J)', saw('KeyJ', 'light')); settle()
    check('coup moyen (K)', saw('KeyK', 'medium')); settle()
    check('coup lourd (L)', saw('KeyL', 'heavy')); settle()
    check('ruée (O)', saw('KeyO', 'dash')); settle()
    x1 = S()['a']['x']; pg.keyboard.press('KeyA'); time.sleep(0.06); pg.keyboard.press('KeyA'); time.sleep(1.5)
    check('esquive arrière par double appui', S()['a']['x'] < x1 - 0.3, f"{x1} -> {S()['a']['x']}")
    pg.keyboard.press('KeyW'); up = False
    for _ in range(20):
        if S()['a']['y'] > 0.1: up = True; break
        time.sleep(0.05)
    check('saut', up); settle()
    pg.keyboard.down('KeyS'); time.sleep(0.9); g = S()['a']['st']; pg.keyboard.up('KeyS')
    check('garde', g == 'guard', g); time.sleep(0.6)
    ev("window.__afro.S.match.fighters[0].meter=100"); time.sleep(0.3)
    check('pouvoir spécial (I)', saw('KeyI', 'special')); time.sleep(0.8); shot('06-special'); time.sleep(3.5); shot('07-combat')
    key('F3', 0.9); txt = ev("(document.getElementById('perf')||{}).textContent||''")
    check('mesures de performances (F3)', 'img/s' in txt and 'moteur' in txt); key('F3')
    key('Escape'); check('pause', S()['screen'] == 'pause')
    keys(['ArrowDown', 'ArrowDown', 'Enter']); check('aide des commandes depuis la pause', S()['screen'] == 'help')
    key('Escape'); key('Escape'); check('reprise du combat', S()['screen'] is None)
    # fin de match : l'adversaire n'a plus qu'un point de vie, deux manches de suite
    won = False
    for _ in range(2):
        if not wait_fight(): break
        ev(passive); ev("(()=>{const m=window.__afro.S.match; m.fighters[1].hp=1; m.fighters[1].x=m.fighters[0].x+0.9;})()")
        for _ in range(12):
            pg.keyboard.press('KeyJ'); time.sleep(0.35)
            if S()['phase'] != 'fight': break
        time.sleep(1.0)
    for _ in range(60):
        if S()['screen'] == 'result': won = True; break
        time.sleep(0.5)
    check('écran de résultat après deux manches gagnées', won, str(S())); time.sleep(1.2); shot('08-victoire')
    st = ev("window.__afro.progress.data.stats")
    check('victoire enregistrée dans la progression', st['wins'] == 1 and st['matches'] == 1 and st['byChar']['themba']['wins'] == 1, json.dumps(st)[:200])
    xp = ev("window.__afro.progress.data.profile.xp"); check('expérience gagnée', xp >= 100, str(xp))
    keys(['ArrowDown', 'ArrowDown', 'Enter']); check('retour au menu principal', S()['screen'] == 'title')

    # ── entraînement
    keys(['ArrowDown', 'ArrowDown', 'Enter'], 0.6); key('Enter', 0.8); keys(['ArrowLeft', 'Enter'], 0.8)
    s = S(); check('entraînement lancé', s['mode'] == 'training' and s['screen'] is None, str(s)); wait_fight()
    ev("(()=>{const m=window.__afro.S.match; m.fighters[1].hp=5; m.fighters[1].x=m.fighters[0].x+0.9;})()")
    for _ in range(5): pg.keyboard.press('KeyJ'); time.sleep(0.4)
    s = S(); check('entraînement : pas de K.O.', s['phase'] == 'fight' and s['b']['hp'] >= 1, str(s['b']))
    check('entraînement : panneau d\'informations', 'Dernier coup' in ev("document.getElementById('training').textContent"))
    time.sleep(1.0); shot('09-entrainement')
    key('Escape'); keys(['ArrowDown', 'ArrowDown', 'ArrowRight'])
    check('entraînement : comportement du mannequin réglable', ev("window.__afro.S.dummy") == 'garde', ev("window.__afro.S.dummy"))
    keys(['ArrowDown'] * 5 + ['Enter']); check('retour au titre depuis l\'entraînement', S()['screen'] == 'title', str(S()['screen']))

    # ── deux joueurs
    keys(['ArrowDown', 'Enter'], 0.6); key('Enter', 0.8)
    check('deux joueurs : le joueur 2 choisit à son tour', S()['screen'] == 'select' and ev("window.__afro.S.arg.who") == 1)
    key('Enter', 0.8)
    s = S(); check('deux joueurs : combat lancé', s['mode'] == 'versus' and s['screen'] is None, str(s)); wait_fight()
    check('joueur 1 : coup léger sur sa touche (F)', saw('KeyF', 'light', who='a')); settle()
    check('joueur 2 : coup léger sur sa touche (J)', saw('KeyJ', 'light', who='b')); settle()
    a0 = S()['a']['serial']; pg.keyboard.press('KeyJ'); time.sleep(1.0)
    check('les touches du joueur 2 n\'agissent pas sur le joueur 1', S()['a']['serial'] == a0)
    xb = S()['b']['x']; pg.keyboard.down('ArrowLeft'); time.sleep(1.0); pg.keyboard.up('ArrowLeft')
    check('joueur 2 : déplacement aux flèches', S()['b']['x'] < xb - 0.15); shot('10-deux-joueurs')
    key('Escape'); keys(['ArrowDown'] * 5 + ['Enter']); check('retour au titre depuis le mode deux joueurs', S()['screen'] == 'title', str(S()['items']))

    # ── restauration après rechargement
    boot()
    st = ev("window.__afro.progress.data"); status = ev("window.__afro.progress.status")
    check('progression restaurée après rechargement de la page', status == 'loaded' and st['stats']['wins'] == 1 and st['profile']['xp'] == xp and st['selected']['char'] == 'themba', f"{status} {json.dumps(st['stats'])[:120]}")
    check('compteurs des autres modes restaurés', st['stats']['versusMatches'] == 0 and st['stats']['trainingSessions'] == 1, json.dumps(st['stats'])[:200])
    check('aucune erreur JavaScript', not errors, '; '.join(errors[:3]))
    b.close()
print(f"RÉSULTAT : {'OK' if not fails else 'ÉCHEC'} — {n[0] - len(fails)} vérifications réussies sur {n[0]}")
sys.exit(1 if fails else 0)
