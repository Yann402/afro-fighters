"""Themba — guerrier zoulou. Génère assets/models/themba.glb.
Lancement (depuis la racine du dépôt) :  <python de l'environnement bpy> tools/art/themba.py [sortie.glb]"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.kit import *
from lib import textures

F = Fighter('themba', Proportions(bulk=1.14, torso_w=1.06, shoulder_w=0.245), skin=(134, 84, 56), skin_dark=(92, 54, 36), lip=(112, 56, 48),
            hair='short', head=dict(jaw=1.05, nose=1.1, lips=1.05, brow=1.1))
p, arm, H, z0 = F.p, F.arm, F.H, F.z0
FUR = srgb(188, 146, 88); FUR_SPOT = srgb(34, 22, 14); FUR_LIGHT = srgb(232, 208, 160)
WHITE = srgb(240, 232, 214); CREAM = srgb(206, 190, 160); HIDE_BROWN = srgb(96, 52, 28)
LEATHER = srgb(84, 48, 26); WOOD = srgb(92, 58, 32); WOOD_DARK = srgb(52, 32, 18)
RED = srgb(176, 38, 30); BLUE = srgb(28, 78, 150); BLACK = srgb(18, 16, 16); STEEL = srgb(196, 200, 206)

# umqhele : bandeau en fourrure de léopard
c = Clay()
ring = F.head_surface.snap_all([H(*a[:3]) for a in ellipse(26, 0.094, 0.111, z0 + 0.058, cy=0.018)], 0.006)
for a, b in zip(ring, ring[1:] + ring[:1]): c.hull([(a, (0.012, 0.012, 0.021)), (b, (0.012, 0.012, 0.021))])
F.piece(c, 'umqhele', 0.004, 2200, FUR, rules=[(spots(30, 0.021, seed=3, ring=0.25), FUR_SPOT)], bone='head', cavity=0.3)

# plumes dressées à l'arrière de la tête, séparées et effilées
c = Clay()
for i, (dx, lean, ln) in enumerate([(-0.06, -30, 0.19), (-0.03, -14, 0.25), (0.0, 0, 0.29), (0.03, 14, 0.25), (0.06, 30, 0.19)]):
    base = Vector(H(dx, 0.08, z0 + 0.07)); a = math.radians(lean)
    up = Vector((math.sin(a) * 0.9, 0.42, math.cos(a))).normalized(); side = Vector((math.cos(a), 0, -math.sin(a)))
    pts = [base + up * ln * t + Vector((0, 0.06 * t * t, 0)) for t in (0, 0.3, 0.65, 1.0)]
    wid = [0.005, 0.019, 0.021, 0.004]
    for (q0, w0), (q1, w1) in zip(zip(pts, wid), list(zip(pts, wid))[1:]):
        c.hull([(q0 + side * w0, 0.0035), (q0 - side * w0, 0.0035), (q1 + side * w1, 0.0035), (q1 - side * w1, 0.0035)], sub=1)
tipz = H(0, 0, z0 + 0.25)[2]
F.piece(c, 'plumes', 0.003, 1600, BLACK, rules=[(lambda co: np.clip((co[:, 2] - tipz) / 0.035, 0, 1), WHITE)], bone='head', smooth=1, cavity=0.2)

# colliers de perles
F.beads(F.ring_on_skin(24, 0.1, 0.09, p.neck_z + 0.02, cy=0.012, drop=0.04), 0.0115, [WHITE, RED, WHITE, BLACK, WHITE, BLUE], 'collier', 'chest')
long = F.skin_surface.snap_all([(x, y - 0.03, z - 0.15 * max(0.0, math.cos(a)) ** 1.5) for x, y, z, a in ellipse(34, 0.125, 0.11, p.neck_z + 0.02, cy=0.012)], 0.008)
F.beads(long, 0.0095, [RED, WHITE, BLUE, WHITE], 'collier_long', 'chest')

# amashoba : touffes de queue de vache aux bras et sous les genoux
def tuft(center, axis, radius, length, n, seed):
    r = np.random.default_rng(seed); axis = axis.normalized()
    u = axis.cross(Vector((0, 1, 0))).normalized(); v = axis.cross(u)
    c = Clay()
    for i in range(n):
        a = 2 * math.pi * i / n + r.random() * 0.2
        out = u * math.cos(a) + v * math.sin(a); ln = length * (0.8 + 0.35 * r.random())
        c.chain([(center + out * radius, 0.017), (center + out * (radius + 0.022) + axis * ln * 0.5, 0.014), (center + out * (radius + 0.03 + 0.02 * r.random()) + axis * ln, 0.005)])
    c.chain([(center + (u * math.cos(2 * math.pi * i / 16) + v * math.sin(2 * math.pi * i / 16)) * (radius + 0.004), 0.013) for i in range(17)])
    return c

for s, S in ((1, 'L'), (-1, 'R')):
    d = p.arm_dir(s); ctr = p.shoulder(s) + d * 0.125
    F.piece(tuft(ctr, d, 0.058, 0.15, 13, 5 + s), 'amashoba_bras' + S, 0.005, 1200, WHITE, rules=[(near(tuple(ctr), 0.085, soft=0.5), LEATHER)], bone='upperArm' + S, cavity=0.55, cs=50)
    kc = p.knee(s) + Vector((0, 0.008, -0.075))
    F.piece(tuft(kc, Vector((0, 0, -1)), 0.06, 0.2, 14, 9 + s), 'amashoba_jambe' + S, 0.005, 1300, WHITE, rules=[(near(tuple(kc), 0.085, soft=0.5), LEATHER)], bone='shin' + S, cavity=0.55, cs=50)
    F.beads(F.limb_ring(p.hand_frame(s)(-0.012, 0, 0), d, 0.036, 12), 0.0115, [WHITE, RED, WHITE, BLUE], 'bracelet' + S, 'forearm' + S)
    an = p.ankle(s)
    F.beads(F.limb_ring((an.x, an.y, an.z + 0.035), (0, 0, 1), 0.05, 12), 0.0115, [WHITE, BLACK, WHITE, RED], 'cheville' + S, 'shin' + S)

# ceinture, isinene (lanières de fourrure devant) et ibheshu (tablier de peau derrière) : suivent les jambes
bz = p.hip_z + 0.045
belt = ellipse(30, 0.168, 0.128, bz, cy=0.006)
c = Clay()
for a, b in zip(belt, belt[1:] + belt[:1]): c.capsule(a[:3], b[:3], 0.02)
F.piece(c, 'ceinture', 0.005, 800, LEATHER, bone='hips', cavity=0.3)
F.beads([(x * 1.07, (y - 0.006) * 1.09 + 0.006, z) for x, y, z, a in belt], 0.011, [WHITE, RED, WHITE, WHITE, BLACK, WHITE], 'ceinture_perles', 'hips')
c = Clay(); rng = np.random.default_rng(4)
for x, y, z, a in ellipse(26, 0.172, 0.132, bz - 0.01, cy=0.006):
    ca = math.cos(a)
    if ca < -0.45: continue
    ln = (0.2 + 0.15 * max(0.0, ca) ** 2) * (0.9 + 0.2 * rng.random())
    out = Vector((math.sin(a), -math.cos(a), 0)); top = Vector((x, y, z))
    c.chain([(top, 0.021), (top + out * 0.028 + Vector((0, 0, -ln * 0.5)), 0.02), (top + out * 0.04 + Vector((0, 0, -ln)), 0.009)])
F.piece(c, 'isinene', 0.005, 2400, FUR, rules=[(spots(60, 0.022, seed=8, ring=0.3), FUR_SPOT), (lambda co: np.clip((0.76 - co[:, 2]) / 0.08, 0, 1) * 0.7, FUR_LIGHT)], soft=True, cavity=0.6, cs=50)
c = Clay()
c.hull([((0.15, 0.1, bz - 0.01), 0.018), ((-0.15, 0.1, bz - 0.01), 0.018), ((0.19, 0.165, 0.78), 0.016), ((-0.19, 0.165, 0.78), 0.016), ((0.11, 0.17, 0.56), 0.016), ((-0.11, 0.17, 0.56), 0.016), ((0, 0.175, 0.52), 0.016)])
F.piece(c, 'ibheshu', 0.006, 800, CREAM, rules=[(patches(5, 0.3, seed=2.0), HIDE_BROWN)], soft=True, cavity=0.3)

# isihlangu : grand bouclier en peau de vache, bâton central et touffe au sommet
gl = p.grip(1); sc = Vector((gl.x - 0.02, gl.y - 0.075, gl.z + 0.05))
def shield_pt(u, v):
    half = 0.26 * (1 - abs(u) ** 2.4) ** 0.62 + 0.004; x = v * half
    return (sc.x + x, sc.y - 0.05 * (1 - (x / 0.26) ** 2) * (1 - u * u * 0.6) + 0.03, sc.z + u * 0.52)
shield = grid_shell('shield', shield_pt, 36, 18, 0.014)
assign(shield, material('peau_de_vache', rough=0.85, double=True, image=image_from_array('robe', textures.cowhide()), vertex_color=False)); F.objects.append(shield)
c = Clay()
c.capsule(sc + Vector((0, 0.03, -0.58)), sc + Vector((0, 0.03, 0.66)), 0.012); c.ball(sc + Vector((0, 0.03, 0.72)), (0.035, 0.035, 0.075))
stick = F.piece(c, 'shield_baton', 0.005, 500, WOOD_DARK, rules=[(lambda co: np.clip((co[:, 2] - (sc.z + 0.64)) / 0.02, 0, 1), FUR), (lambda co: spots(14, 0.012, seed=6, ring=0.3)(co) * (co[:, 2] > sc.z + 0.64), FUR_SPOT)], cavity=0.3)
set_origin(shield, gl); set_origin(stick, gl)
stick.parent = shield; stick.matrix_parent_inverse = shield.matrix_world.inverted()
attach(shield, arm, 'forearmL')

# iklwa : lance courte à large lame
gr = p.grip(-1)
c = Clay()
c.capsule(gr + Vector((0, 0.42, 0)), gr + Vector((0, -0.4, 0)), 0.0125, 0.0115); c.ball(gr + Vector((0, 0.43, 0)), 0.019)
for k in range(5): c.ball(gr + Vector((0, -0.34 - k * 0.016, 0)), (0.0165, 0.007, 0.0165))
shaft = F.piece(c, 'spear', 0.004, 700, WOOD, rules=[(lambda co: ((co[:, 1] < gr.y - 0.325) & (co[:, 1] > gr.y - 0.415)).astype(np.float32), LEATHER)], mat='bois', rough=0.7, cavity=0.4)
by = gr.y - 0.4
c = Clay()
c.hull([(Vector((gr.x, by, gr.z)), 0.008), (Vector((gr.x, by - 0.1, gr.z + 0.046)), 0.003), (Vector((gr.x, by - 0.1, gr.z - 0.046)), 0.003), (Vector((gr.x, by - 0.12, gr.z)), 0.0075), (Vector((gr.x, by - 0.34, gr.z)), 0.0025)])
blade = F.piece(c, 'spear_lame', 0.003, 600, STEEL, mat=material('acier', rough=0.3, metal=0.35), cavity=0.2, smooth=1)
set_origin(shaft, gr); set_origin(blade, Vector((gr.x, by - 0.15, gr.z)))
blade.parent = shaft; blade.matrix_parent_inverse = shaft.matrix_world.inverted()
attach(shaft, arm, 'handR')

F.finish(sys.argv[1] if len(sys.argv) > 1 else None)
