"""Themba — guerrier zoulou. Génère assets/models/themba.glb.

Lancement (depuis la racine du dépôt) :  <python de l'environnement bpy> tools/art/themba.py [sortie.glb] [--etape corps|tout]
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from mathutils import Vector
from lib.forge import *
from lib import human
from lib.human import srgb, Proportions

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = args[0] if args else os.path.join(ROOT, 'assets', 'models', 'themba.glb')

SKIN = srgb(134, 84, 56)
SKIN_DARK = srgb(92, 54, 36)
LIP = srgb(112, 56, 48)
HAIR = srgb(16, 12, 11)

reset_scene()
p = Proportions(bulk=1.14, torso_w=1.06, shoulder_w=0.245)
arm = build_armature('Themba', human.skeleton(p))
objects = [arm]

# ── corps
skin_mat = material('peau', rough=0.62)
body = human.body(p, tris=9000)
paint(body, SKIN, cavity=0.5, gradient=(0.0, 1.6, 0.86, 1.04))
assign(body, skin_mat)
print('corps :', tri_count(body), 'triangles ; sommets sans poids :', skin_to(body, arm))
objects.append(body)

# ── tête
head, eye_pos = human.head(p, jaw=1.05, nose=1.1, lips=1.05, brow=1.1)
ez = head['eye_z']
hairline = lambda co: np.clip(((co[:, 2] - (ez + 0.075)) + np.clip(co[:, 1] - 0.0, 0, 1) * 0.9 - np.clip(-co[:, 1] - 0.06, 0, 1) * 0.5) / 0.012, 0, 1)
paint(head, SKIN, rules=[
    (near((0, -0.122, ez - 0.075), (0.04, 0.026, 0.026), soft=0.45), LIP),
    (near((0.044, -0.1, ez), (0.034, 0.03, 0.02), soft=0.9), SKIN_DARK), (near((-0.044, -0.1, ez), (0.034, 0.03, 0.02), soft=0.9), SKIN_DARK),
    (hairline, HAIR),
], cavity=0.6, cavity_scale=110)
assign(head, skin_mat); attach(head, arm, 'head'); objects.append(head)
lids = human.eyelids(eye_pos, SKIN_DARK); assign(lids, skin_mat); attach(lids, arm, 'head'); objects.append(lids)
eyes = human.eyes(eye_pos); assign(eyes, material('yeux', rough=0.25)); attach(eyes, arm, 'head'); objects.append(eyes)
# sourcils
c = Clay()
for s in (1, -1): c.hull([((s * 0.02, -0.122, ez + 0.027), 0.0055), ((s * 0.054, -0.118, ez + 0.036), 0.0065), ((s * 0.074, -0.1, ez + 0.03), 0.004)])
brows = c.to_object('sourcils'); shade_smooth(brows); paint(brows, HAIR, cavity=0); assign(brows, skin_mat); attach(brows, arm, 'head'); objects.append(brows)

# ── mains
for s, S in ((1, 'L'), (-1, 'R')):
    h = human.hand(p, s, 'hand' + S)
    paint(h, SKIN, cavity=0.55, cavity_scale=120); assign(h, skin_mat); attach(h, arm, 'hand' + S); objects.append(h)

# ───────────────────────── Tenue et équipement
FUR = srgb(188, 146, 88); FUR_SPOT = srgb(34, 22, 14); FUR_LIGHT = srgb(232, 208, 160)
WHITE = srgb(240, 232, 214); CREAM = srgb(206, 190, 160)
HIDE_BROWN = srgb(96, 52, 28); HIDE_BLACK = srgb(26, 20, 18)
LEATHER = srgb(84, 48, 26); WOOD = srgb(92, 58, 32); WOOD_DARK = srgb(52, 32, 18)
RED = srgb(176, 38, 30); BLUE = srgb(28, 78, 150); BLACK = srgb(18, 16, 16); STEEL = srgb(196, 200, 206)
fur_mat = material('pelage', rough=0.95)
bead_mat = material('perles', rough=0.32)
wood_mat = material('bois', rough=0.7)
steel_mat = material('acier', rough=0.3, metal=0.35)
skin_surface = Surface(body); head_surface = Surface(head)
hs = head['scale']; pivot = Vector((0, 0.005, p.head_z))
H = lambda x, y, z: tuple(pivot + (Vector((x, y, z)) - pivot) * hs)      # point exprimé avant grossissement de la tête
z0 = p.head_z + 0.1

def piece(clay, name, voxel, tris, base, rules=(), mat=None, bone=None, smooth=3, cavity=0.5, cs=70, gradient=None):
    ob = clay.to_object(name)
    fuse(ob, voxel=voxel, smooth=smooth, smooth_factor=0.5, tris=tris)
    paint(ob, base, rules=rules, cavity=cavity, cavity_scale=cs, gradient=gradient)
    assign(ob, mat or fur_mat)
    if bone: attach(ob, arm, bone)
    objects.append(ob)
    return ob

# umqhele : bandeau en fourrure de léopard
c = Clay()
ring = ellipse(26, 0.094, 0.111, z0 + 0.058, cy=0.018)
ring = head_surface.snap_all([H(*a[:3]) for a in ring], 0.006)
for a, b in zip(ring, ring[1:] + ring[:1]): c.hull([(a, (0.012, 0.012, 0.021)), (b, (0.012, 0.012, 0.021))])
piece(c, 'umqhele', 0.004, 2400, FUR, rules=[(spots(30, 0.021, seed=3, ring=0.25), FUR_SPOT)], bone='head', cavity=0.3)

# plumes à l'arrière de la tête
c = Clay()
for i, (dx, lean, ln) in enumerate([(-0.05, -22, 0.2), (-0.025, -10, 0.25), (0.0, 0, 0.28), (0.025, 10, 0.25), (0.05, 22, 0.2)]):
    base = Vector(H(dx, 0.085, z0 + 0.075)); a = math.radians(lean)
    up = Vector((math.sin(a) * 0.9, 0.38, math.cos(a))).normalized()
    side = Vector((math.cos(a), 0, -math.sin(a)))
    pts = [base + up * ln * t + Vector((0, 0.05 * t * t, 0)) for t in (0, 0.33, 0.66, 1.0)]
    wid = [0.008, 0.024, 0.026, 0.008]
    for (q0, w0), (q1, w1) in zip(zip(pts, wid), list(zip(pts, wid))[1:]):
        c.hull([(q0 + side * w0, 0.0045), (q0 - side * w0, 0.0045), (q1 + side * w1, 0.0045), (q1 - side * w1, 0.0045)], sub=1)
tipz = H(0, 0, z0 + 0.27)[2]
piece(c, 'plumes', 0.004, 1400, BLACK, rules=[(lambda co: np.clip((co[:, 2] - tipz) / 0.03, 0, 1), WHITE)], bone='head', smooth=2, cavity=0.3)

# collier de perles (deux rangs) sur le haut du torse
neck = skin_surface.snap_all([(x, y, z - 0.04 * math.cos(a)) for x, y, z, a in ellipse(24, 0.1, 0.09, p.neck_z + 0.02, cy=0.012)], 0.008)
objects.append(attach(assign(beads(neck, 0.0115, [WHITE, RED, WHITE, BLACK, WHITE, BLUE], 'collier'), bead_mat), arm, 'chest'))
long = skin_surface.snap_all([(x, y - 0.03, z - 0.15 * max(0.0, math.cos(a)) ** 1.5) for x, y, z, a in ellipse(34, 0.125, 0.11, p.neck_z + 0.02, cy=0.012)], 0.008)
objects.append(attach(assign(beads(long, 0.0095, [RED, WHITE, BLUE, WHITE], 'collier_long'), bead_mat), arm, 'chest'))

# amashoba : touffes de queue de vache aux bras et sous les genoux
def tuft(center, axis, radius, length, n, seed):
    r = np.random.default_rng(seed)
    axis = axis.normalized()
    u = axis.cross(Vector((0, 1, 0))).normalized(); v = axis.cross(u)
    c = Clay()
    for i in range(n):
        a = 2 * math.pi * i / n + r.random() * 0.2
        out = u * math.cos(a) + v * math.sin(a)
        ln = length * (0.8 + 0.35 * r.random())
        c.chain([(center + out * radius, 0.017), (center + out * (radius + 0.022) + axis * ln * 0.5, 0.014), (center + out * (radius + 0.03 + 0.02 * r.random()) + axis * ln, 0.005)])
    ring = [(center + (u * math.cos(2 * math.pi * i / 16) + v * math.sin(2 * math.pi * i / 16)) * (radius + 0.004), 0.013) for i in range(17)]
    c.chain(ring)
    return c

for s, S in ((1, 'L'), (-1, 'R')):
    d = p.arm_dir(s)
    piece(tuft(p.shoulder(s) + d * 0.125, d, 0.058, 0.15, 13, 5 + s), 'amashoba_bras' + S, 0.005, 1300, WHITE,
          rules=[(near(tuple(p.shoulder(s) + d * 0.125), 0.085, soft=0.5), LEATHER)], bone='upperArm' + S, cavity=0.55, cs=50)
    kn = p.knee(s)
    piece(tuft(kn + Vector((0, 0.008, -0.075)), Vector((0, 0, -1)), 0.06, 0.2, 14, 9 + s), 'amashoba_jambe' + S, 0.005, 1400, WHITE,
          rules=[(near(tuple(kn + Vector((0, 0.008, -0.075))), 0.085, soft=0.5), LEATHER)], bone='shin' + S, cavity=0.55, cs=50)
    # bracelets de perles : masquent la jonction main / avant-bras
    P = p.hand_frame(s)
    wr = [P(-0.012, 0.036 * math.cos(2 * math.pi * i / 12), 0.036 * math.sin(2 * math.pi * i / 12)) for i in range(12)]
    objects.append(attach(assign(beads(wr, 0.0115, [WHITE, RED, WHITE, BLUE], 'bracelet' + S), bead_mat), arm, 'forearm' + S))
    an = p.ankle(s)
    ak = [(an.x + 0.05 * math.sin(2 * math.pi * i / 12), an.y + 0.05 * math.cos(2 * math.pi * i / 12), an.z + 0.035) for i in range(12)]
    objects.append(attach(assign(beads(ak, 0.0115, [WHITE, BLACK, WHITE, RED], 'cheville' + S), bead_mat), arm, 'shin' + S))

# ceinture, isinene (lanières de fourrure devant) et ibheshu (tablier de peau derrière)
bz = p.hip_z + 0.045
belt = ellipse(30, 0.168, 0.128, bz, cy=0.006)
c = Clay()
for a, b in zip(belt, belt[1:] + belt[:1]): c.capsule(a[:3], b[:3], 0.02)
piece(c, 'ceinture', 0.005, 900, LEATHER, bone='hips', cavity=0.3)
objects.append(attach(assign(beads([(x * 1.07, (y - 0.006) * 1.09 + 0.006, z) for x, y, z, a in belt], 0.011, [WHITE, RED, WHITE, WHITE, BLACK, WHITE], 'ceinture_perles'), bead_mat), arm, 'hips'))
c = Clay()
rng = np.random.default_rng(4)
for x, y, z, a in ellipse(26, 0.172, 0.132, bz - 0.01, cy=0.006):
    ca = math.cos(a)
    if ca < -0.45: continue                                   # l'arrière est couvert par l'ibheshu
    ln = (0.2 + 0.15 * max(0.0, ca) ** 2) * (0.9 + 0.2 * rng.random())
    out = Vector((math.sin(a), -math.cos(a), 0))
    top = Vector((x, y, z))
    c.chain([(top, 0.021), (top + out * 0.028 + Vector((0, 0, -ln * 0.5)), 0.02), (top + out * 0.04 + Vector((0, 0, -ln)), 0.009)])
piece(c, 'isinene', 0.005, 2600, FUR, rules=[(spots(60, 0.022, seed=8, ring=0.3), FUR_SPOT), (lambda co: np.clip((0.76 - co[:, 2]) / 0.08, 0, 1) * 0.7, FUR_LIGHT)], bone='hips', cavity=0.6, cs=50)
c = Clay()
c.hull([((0.15, 0.1, bz - 0.01), 0.018), ((-0.15, 0.1, bz - 0.01), 0.018), ((0.19, 0.165, 0.78), 0.016), ((-0.19, 0.165, 0.78), 0.016), ((0.11, 0.17, 0.56), 0.016), ((-0.11, 0.17, 0.56), 0.016), ((0, 0.175, 0.52), 0.016)])
piece(c, 'ibheshu', 0.006, 700, CREAM, rules=[(patches(9, 0.12, seed=2.0), HIDE_BROWN)], bone='hips', cavity=0.3)

# isihlangu : grand bouclier en peau de vache, bâton central et touffe au sommet
gl = p.grip(1)
sc = Vector((gl.x - 0.02, gl.y - 0.075, gl.z + 0.05))            # centre du bouclier
def shield_pt(u, v):                                              # u : hauteur, v : largeur
    half = 0.26 * (1 - abs(u) ** 2.4) ** 0.62 + 0.004
    x = v * half
    dome = 0.05 * (1 - (x / 0.26) ** 2) * (1 - u * u * 0.6)
    return (sc.x + x, sc.y - dome + 0.03, sc.z + u * 0.52)
def cowhide_texture(w=256, h=512):
    """Robe de vache peinte : fond crème, plaques brunes et noires, lacets centraux, bord assombri."""
    v, u = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))      # u : hauteur, v : largeur
    x, z = v * 2.1, u * 4.2
    n1 = np.sin(x * 1.3 + np.sin(z * 0.9) * 1.6) + np.sin(z * 1.1 + 1.7 + np.sin(x * 0.7) * 1.3) + 0.6 * np.sin((x + z) * 2.3)
    n2 = np.sin(x * 1.1 + 4.0 + np.sin(z * 0.7 + 1.0) * 1.4) + np.sin(z * 0.9 + 0.4 + np.sin(x * 0.9) * 1.2)
    img = np.empty((h, w, 3), dtype=np.float32)
    img[:] = (0.93, 0.89, 0.8)
    grain = 0.03 * np.sin(z * 37 + x * 5) * np.sin(x * 29)
    img += grain[..., None]
    def blend(mask, col): 
        m = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - m) + np.array(col, dtype=np.float32) * m
    blend((n1 - 0.55) / 0.12, (0.42, 0.22, 0.11))
    blend((n2 - 1.25) / 0.1, (0.1, 0.075, 0.065))
    lace = (np.abs(np.abs(v) - 0.11) < 0.045) & (np.abs(((u + 1) * 5.5) % 1.0 - 0.5) < 0.3) & (np.abs(u) < 0.78)
    blend(lace.astype(np.float32), (0.12, 0.08, 0.06))
    blend((np.abs(v) - 0.9) / 0.1 * 0.7, (0.3, 0.17, 0.09))
    return np.clip(img, 0, 1)
shield = grid_shell('shield', shield_pt, 36, 18, 0.014)
assign(shield, material('peau_de_vache', rough=0.85, double=True, image=image_from_array('robe', cowhide_texture()), vertex_color=False)); objects.append(shield)
c = Clay()
c.capsule(sc + Vector((0, 0.03, -0.58)), sc + Vector((0, 0.03, 0.66)), 0.012)
c.ball(sc + Vector((0, 0.03, 0.72)), (0.035, 0.035, 0.075))
stick = piece(c, 'shield_baton', 0.005, 500, WOOD_DARK, rules=[(lambda co: np.clip((co[:, 2] - (sc.z + 0.64)) / 0.02, 0, 1), FUR), (lambda co: spots(14, 0.012, seed=6, ring=0.3)(co) * (co[:, 2] > sc.z + 0.64), FUR_SPOT)], cavity=0.3)
# le bâton suit le bouclier ; le bouclier suit l'avant-bras gauche (le jeu le garde face à l'adversaire)
set_origin(shield, gl); set_origin(stick, gl)
bpy.context.view_layer.update()
stick.parent = shield; stick.matrix_parent_inverse = shield.matrix_world.inverted()
attach(shield, arm, 'forearmL')

# iklwa : lance courte à large lame
gr = p.grip(-1)
c = Clay()
c.capsule(gr + Vector((0, 0.42, 0)), gr + Vector((0, -0.4, 0)), 0.0125, 0.0115)
c.ball(gr + Vector((0, 0.43, 0)), 0.019)
for k in range(5): c.ball(gr + Vector((0, -0.34 - k * 0.016, 0)), (0.0165, 0.007, 0.0165))     # ligature
shaft = piece(c, 'spear', 0.004, 700, WOOD, rules=[(lambda co: ((co[:, 1] < gr.y - 0.325) & (co[:, 1] > gr.y - 0.415)).astype(np.float32), LEATHER)], mat=wood_mat, cavity=0.4)
c = Clay()
by = gr.y - 0.4
c.hull([(Vector((gr.x, by, gr.z)), 0.008), (Vector((gr.x, by - 0.1, gr.z + 0.046)), 0.003), (Vector((gr.x, by - 0.1, gr.z - 0.046)), 0.003),
        (Vector((gr.x, by - 0.12, gr.z)), 0.0075), (Vector((gr.x, by - 0.34, gr.z)), 0.0025)], sub=2)
blade = piece(c, 'spear_lame', 0.003, 600, STEEL, mat=steel_mat, cavity=0.2, smooth=1)
set_origin(shaft, gr); set_origin(blade, Vector((gr.x, by - 0.15, gr.z)))
bpy.context.view_layer.update()
blade.parent = shaft; blade.matrix_parent_inverse = shaft.matrix_world.inverted()
attach(shaft, arm, 'handR')

export_glb(OUT, objects)
print('exporté :', OUT, round(os.path.getsize(OUT) / 1024), 'Ko ;', sum(tri_count(o) for o in objects if o.type == 'MESH'), 'triangles')
