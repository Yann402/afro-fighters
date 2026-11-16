"""Lekishon — guerrier inspiré de l'univers maasaï. Génère assets/models/lekishon.glb."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.kit import *
from lib import textures

OCHRE = srgb(150, 62, 34); OCHRE_DARK = srgb(104, 40, 24)
F = Fighter('lekishon', Proportions(bulk=0.9, torso_w=0.93, shoulder_w=0.222, hip_w=0.098), skin=(124, 76, 52), skin_dark=(84, 50, 34), lip=(104, 52, 46),
            hair=None, brow_color=(30, 18, 14), head=dict(jaw=0.94, nose=1.0, lips=1.0, brow=0.95, face_w=0.94, scale=1.1), body_tris=8500)
p, arm, H, z0 = F.p, F.arm, F.H, F.z0
S = F.skin_surface
WHITE = srgb(240, 234, 220); RED = srgb(186, 30, 30); BLUE = srgb(26, 84, 168); ORANGE = srgb(232, 150, 30); GREEN = srgb(36, 130, 82); BLACK = srgb(20, 16, 16)
WOOD = srgb(66, 40, 22); STEEL = srgb(200, 204, 210)
bz = p.hip_z + 0.06
N = 30
shuka_mat = material('shuka', rough=0.9, double=True, image=image_from_array('carreaux', textures.shuka()), vertex_color=False)

# shuka : jupe longue à carreaux rouges, qui suit les jambes
rows = 10; z_low = 0.5
prof = [S.profile(bz - (bz - z_low) * i / rows, N, cy=0.01, widen=3) for i in range(rows + 1)]
def skirt(u, a):
    i = min(rows, int(round(u * rows))); j = int(round(a / (2 * math.pi) * N)) % N
    r = prof[i][j] + 0.014 + 0.05 * u * u
    return (r * math.sin(a), 0.01 - r * math.cos(a), bz - (bz - z_low) * u)
F.soft(tube_shell('shuka_jupe', skirt, rows, N, 0.01), shuka_mat)
# drapé en écharpe : de la hanche droite à l'épaule gauche
def sash(u, a):
    cx, cz = 0.02, 1.33
    q = Vector((cx + 0.2 * math.sin(a), 0.01 - 0.19 * math.cos(a), cz + 0.26 * math.sin(a) * 0.97))
    q += Vector((-0.62, 0, 0.5)).normalized() * (u - 0.5) * 0.2
    return S.snap(q, 0.012 + 0.004 * math.sin(a * 5))
F.soft(tube_shell('shuka_echarpe', sash, 5, 44, 0.008), shuka_mat)
# nœud sur l'épaule et pan qui retombe dans le dos
kn = Vector(S.snap((0.15, 0.02, 1.62), 0.02))
c = Clay(); c.ball(kn, (0.04, 0.035, 0.03))
F.piece(c, 'shuka_noeud', 0.005, 250, srgb(170, 26, 30), bone='chest', cavity=0.4, mat='tissu_uni', rough=0.9)
back = Vector(S.snap((0.15, 0.3, 1.5), 0.02))
F.soft(grid_shell('shuka_pan', lambda u, v: (kn.x + v * (0.075 + 0.03 * (u + 1) / 2), back.y + 0.015 + 0.05 * ((u + 1) / 2) ** 2, kn.z - 0.02 - 0.5 * (u + 1) / 2), 10, 5, 0.008), shuka_mat)

# large collier plat de perles : anneaux concentriques
for i, (col, n) in enumerate([([WHITE, RED], 22), ([BLUE, WHITE], 26), ([ORANGE, RED, ORANGE], 30), ([WHITE, GREEN], 34)]):
    F.beads(F.ring_on_skin(n, 0.07 + i * 0.017, 0.066 + i * 0.016, p.neck_z + 0.05 - i * 0.006, cy=0.012, offset=0.011, drop=0.014 * i), 0.0105, col, f'collier{i}', 'chest')
# bandeau perlé, pendentif frontal, boucles d'oreilles
F.beads(F.head_surface.snap_all([H(*a[:3]) for a in ellipse(30, 0.094, 0.111, z0 + 0.062, cy=0.018)], 0.006), 0.008, [BLUE, WHITE, RED, WHITE], 'bandeau', 'head')
F.beads([H(0, -0.115, z0 + 0.05 - k * 0.014) for k in range(3)], 0.0075, [ORANGE, WHITE, RED], 'pendentif', 'head')
for s in (1, -1):
    F.beads([H(s * 0.098, 0.018, z0 - 0.04 - k * 0.015) for k in range(4)], 0.0085, [WHITE, ORANGE, BLUE, RED], 'boucle' + ('L' if s > 0 else 'R'), 'head')

# cheveux longs teints à l'ocre : calotte et fines tresses tombant dans le dos
c = Clay()
c.ball(H(0, 0.03, z0 + 0.045), tuple(v * F.hs for v in (0.091, 0.103, 0.095)))
rng = np.random.default_rng(7)
for i in range(13):
    a = math.pi + (i - 6) * 0.2
    x0, y0 = 0.085 * math.sin(a), 0.03 - 0.1 * math.cos(a)
    top = Vector(H(x0, y0, z0 + 0.02)); ln = 0.3 + 0.06 * rng.random()
    mid = Vector((top.x * 1.12, top.y + 0.035, top.z - ln * 0.5)); end = Vector((top.x * 1.05, top.y + 0.02, top.z - ln))
    c.chain([(top, 0.014), (mid, 0.011), (end, 0.006)])
def hairline(co):
    front = Vector(H(0, -0.1, z0 + 0.075))
    return np.ones(len(co), dtype=np.float32)
hair = F.piece(c, 'tresses', 0.004, 3200, OCHRE, rules=[(lambda co: (np.sin(co[:, 2] * 330) > 0.55).astype(np.float32) * 0.6, OCHRE_DARK)], bone='head', cavity=0.6, cs=90, mat='cheveux', rough=0.85)

# bracelets et chevillères multicolores
for s, SIDE in ((1, 'L'), (-1, 'R')):
    d = p.arm_dir(s)
    for k, col in enumerate(([RED, WHITE], [BLUE, WHITE], [ORANGE, GREEN])):
        F.beads(F.limb_ring(p.hand_frame(s)(-0.014 - k * 0.019, 0, 0), d, 0.033 + k * 0.002, 12), 0.0095, col, f'bracelet{SIDE}{k}', 'forearm' + SIDE)
    F.beads(F.limb_ring(p.shoulder(s) + d * 0.14, d, 0.052, 14), 0.0095, [WHITE, BLUE, WHITE, RED], 'brassard' + SIDE, 'upperArm' + SIDE)
    an = p.ankle(s)
    for k, col in enumerate(([WHITE, RED], [BLUE, ORANGE])):
        F.beads(F.limb_ring((an.x, an.y, an.z + 0.035 + k * 0.02), (0, 0, 1), 0.044, 12), 0.0095, col, f'cheville{SIDE}{k}', 'shin' + SIDE)

# longue lance : lame effilée, talon de fer
gr = p.grip(-1)
c = Clay(); c.capsule(gr + Vector((0, 0.72, 0)), gr + Vector((0, -0.78, 0)), 0.0115)
shaft = F.piece(c, 'spear', 0.004, 500, WOOD, mat='bois', rough=0.7, cavity=0.3)
by = gr.y - 0.78
c = Clay()
c.hull([(Vector((gr.x, by + 0.02, gr.z)), 0.009), (Vector((gr.x, by - 0.1, gr.z + 0.03)), 0.003), (Vector((gr.x, by - 0.1, gr.z - 0.03)), 0.003), (Vector((gr.x, by - 0.2, gr.z)), 0.0075), (Vector((gr.x, by - 0.55, gr.z)), 0.0022)])
c.capsule(gr + Vector((0, 0.72, 0)), gr + Vector((0, 1.02, 0)), 0.0095, 0.003)
blade = F.piece(c, 'spear_lame', 0.003, 800, STEEL, mat=material('acier', rough=0.3, metal=0.35), cavity=0.2, smooth=1)
set_origin(shaft, gr); set_origin(blade, Vector((gr.x, by - 0.25, gr.z)))
blade.parent = shaft; blade.matrix_parent_inverse = shaft.matrix_world.inverted()
attach(shaft, arm, 'handR')

# rungu : massue à tête ronde
gl = p.grip(1)
c = Clay(); c.capsule(gl + Vector((0, 0.1, 0)), gl + Vector((0, -0.33, 0)), 0.012, 0.014); c.ball(gl + Vector((0, -0.37, 0)), 0.048)
rungu = F.piece(c, 'rungu', 0.004, 600, WOOD, mat='bois', rough=0.7, cavity=0.4)
set_origin(rungu, gl); attach(rungu, arm, 'handL')

F.finish(sys.argv[1] if len(sys.argv) > 1 else None)
