"""Modou — lutteur inspiré du laamb sénégalais. Génère assets/models/modou.glb."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.kit import *
from lib import textures

F = Fighter('modou', Proportions(bulk=1.34, torso_w=1.24, shoulder_w=0.275, hip_w=0.125, belly=0.55), skin=(108, 66, 46), skin_dark=(72, 42, 28), lip=(96, 48, 42),
            hair=None, beard=(22, 16, 14), head=dict(jaw=1.18, nose=1.15, lips=1.1, brow=1.15, face_w=1.08, scale=1.1), hands=('open', 'open'), body_tris=9500)
p, arm, H, z0 = F.p, F.arm, F.H, F.z0
LEATHER = srgb(92, 50, 26); LEATHER_DARK = srgb(52, 30, 18); RED = srgb(170, 36, 28); WHITE = srgb(238, 230, 212); COWRIE = srgb(232, 222, 196)
INDIGO = srgb(30, 44, 110); CORD = srgb(180, 150, 100)
S = F.skin_surface
bz = p.hip_z + 0.05
N = 32

# ngemb : pagne de lutte enroulé, tissu rayé indigo et blanc
cloth_mat = material('tissu', rough=0.9, double=True, image=image_from_array('rayures', textures.stripes()), vertex_color=False)
rows = 7
prof = [S.profile(bz + 0.03 - 0.25 * i / rows, N, cy=0.01, widen=3) for i in range(rows + 1)]
def wrap(u, a):
    i = min(rows, int(round(u * rows))); j = int(round(a / (2 * math.pi) * N)) % N
    r = prof[i][j] + 0.012 + 0.012 * u
    return (r * math.sin(a), 0.01 - r * math.cos(a), bz + 0.03 - 0.25 * u)
F.soft(tube_shell('ngemb', wrap, rows, N, 0.012), cloth_mat)
# pans noués : un long devant, un derrière
def flap(front):
    sg = -1 if front else 1
    y0 = (0.01 - prof[1][0] - 0.03) if front else (0.01 + prof[1][N // 2] + 0.03)
    def fn(u, v):          # u : -1 haut, +1 bas
        t = (u + 1) / 2
        w = 0.105 + 0.02 * t
        return (v * w, y0 + sg * (0.02 + 0.07 * t * t), bz + 0.0 - (0.42 if front else 0.5) * t)
    return grid_shell('pan_avant' if front else 'pan_arriere', fn, 10, 6, 0.012)
F.soft(flap(True), cloth_mat); F.soft(flap(False), cloth_mat)
c = Clay(); c.ball((0.11, 0.01 - prof[0][2] - 0.035, bz + 0.0), (0.045, 0.035, 0.04))        # nœud sur la hanche
F.piece(c, 'noeud', 0.005, 300, WHITE, rules=[(lambda co: (np.sin(co[:, 2] * 260) > 0.2).astype(np.float32), INDIGO)], bone='hips', cavity=0.3, mat='tissu_uni', rough=0.9)

# ceinture de gris-gris : cordon épais et amulettes de cuir
belt = F.ring_on_skin(34, 0.3, 0.3, bz + 0.055, cy=0.01, offset=0.022)
c = Clay()
for a, b in zip(belt, belt[1:] + belt[:1]): c.capsule(a, b, 0.017)
F.piece(c, 'cordon', 0.005, 900, LEATHER_DARK, soft=True, cavity=0.3)
c = Clay()
for i, q in enumerate(F.ring_on_skin(13, 0.3, 0.3, bz + 0.03, cy=0.01, offset=0.034)):
    q = Vector(q); c.hull([(q + Vector((0, 0, 0.022)), (0.022, 0.022, 0.012)), (q - Vector((0, 0, 0.03)), (0.024, 0.024, 0.014))])
F.piece(c, 'grisgris_taille', 0.004, 1500, LEATHER, rules=[(lambda co: (np.sin(np.arctan2(co[:, 0], -co[:, 1]) * 13 / 2 * 3) > 0.5).astype(np.float32), RED)], soft=True, cavity=0.5)

# cordons croisés sur le torse et amulette centrale
c = Clay()
for sgn in (1, -1):
    path = [(sgn * (0.17 - 0.34 * t), -0.3, p.neck_z - 0.02 - 0.42 * t) for t in np.linspace(0, 1, 14)]
    path += [(sgn * (-0.17 + 0.34 * t), 0.3, p.neck_z - 0.44 + 0.42 * t) for t in np.linspace(0, 1, 14)]
    pts = S.snap_all(path, 0.008)
    for a, b in zip(pts, pts[1:]): c.capsule(a, b, 0.0085)
F.piece(c, 'cordons', 0.004, 1400, CORD, soft=True, cavity=0.3)
am = Vector(S.snap((0, -0.4, p.neck_z - 0.2), 0.02))
c = Clay(); c.hull([(am + Vector((0, 0, 0.03)), (0.03, 0.012, 0.012)), (am - Vector((0, 0, 0.035)), (0.034, 0.014, 0.014))])
F.piece(c, 'amulette', 0.004, 300, RED, bone='chest', cavity=0.3)
horn = Vector(S.snap((-0.09, -0.4, p.neck_z - 0.12), 0.012))
c = Clay(); c.capsule(horn, horn + Vector((-0.03, -0.01, -0.09)), 0.014, 0.003)
F.piece(c, 'corne', 0.003, 200, COWRIE, bone='chest', cavity=0.2, mat='perles', rough=0.35)

# gris-gris aux bras, bracelets et chevillères de cauris
for s, SIDE in ((1, 'L'), (-1, 'R')):
    d = p.arm_dir(s); ctr = p.shoulder(s) + d * 0.14
    ring = F.limb_ring(ctr, d, 0.078, 16)
    c = Clay()
    for a, b in zip(ring, ring[1:] + ring[:1]): c.capsule(a, b, 0.012)
    for q in F.limb_ring(ctr + d * 0.03, d, 0.088, 16)[::4]:
        q = Vector(q); c.hull([(q - d * 0.02, (0.02, 0.02, 0.014)), (q + d * 0.035, (0.022, 0.022, 0.016))])
    F.piece(c, 'grisgris_bras' + SIDE, 0.004, 900, LEATHER, rules=[(near(tuple(F.limb_ring(ctr + d * 0.03, d, 0.088, 16)[4]), 0.04, soft=0.3), RED)], bone='upperArm' + SIDE, cavity=0.5)
    F.beads(F.limb_ring(p.hand_frame(s)(-0.02, 0, 0), d, 0.045, 14), 0.012, [COWRIE], 'bracelet' + SIDE, 'forearm' + SIDE)
    an = p.ankle(s)
    F.beads(F.limb_ring((an.x, an.y, an.z + 0.04), (0, 0, 1), 0.057, 14), 0.012, [COWRIE, COWRIE, RED], 'cheville' + SIDE, 'shin' + SIDE)

# bandeau de corde blanche
ring = F.head_surface.snap_all([H(*a[:3]) for a in ellipse(26, 0.094, 0.111, z0 + 0.066, cy=0.018)], 0.004)
c = Clay()
for a, b in zip(ring, ring[1:] + ring[:1]): c.capsule(a, b, 0.0075)
F.piece(c, 'bandeau', 0.003, 700, WHITE, bone='head', cavity=0.3, mat='tissu_uni', rough=0.9)

F.finish(sys.argv[1] if len(sys.argv) > 1 else None)
