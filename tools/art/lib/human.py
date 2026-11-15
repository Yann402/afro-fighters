"""Corps humain stylisé : squelette commun aux combattants, volumes du corps, tête, mains.

Tous les combattants partagent les mêmes noms d'os et la même pose de repos :
jambes droites, bras écartés de ARM_ANGLE degrés (pose en A, meilleure pour les poids de peau).
Le jeu compense cet angle au chargement (src/render/glbFighter.js).
"""
import math
import numpy as np
from mathutils import Vector
from .forge import Clay, fuse, carve, paint, near, shade_smooth

ARM_ANGLE = 35.0


def srgb(r, g, b):
    """Couleur sRGB 0-255 -> linéaire (les couleurs par sommet du glTF sont linéaires)."""
    f = lambda c: ((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92
    return (f(r), f(g), f(b))


class Proportions:
    """Mesures d'un combattant (mètres). Les valeurs par défaut donnent un athlète élancé."""

    def __init__(self, **kw):
        self.hip_z = 1.00          # hauteur du bassin
        self.hip_w = 0.105         # demi-écart des hanches
        self.knee_z = 0.51
        self.ankle_z = 0.085
        self.spine_z = 1.08
        self.chest_z = 1.30
        self.neck_z = 1.54
        self.head_z = 1.64         # articulation de la tête
        self.top_z = 1.88
        self.shoulder_w = 0.225
        self.shoulder_z = 1.49
        self.upper_arm = 0.30
        self.forearm = 0.275
        self.hand = 0.10
        self.bulk = 1.0            # épaisseur générale des membres et du torse
        self.torso_w = 1.0         # largeur du torse
        self.belly = 0.0           # ventre (0 : plat)
        self.head_scale = 1.0
        for k, v in kw.items(): setattr(self, k, v)

    # points clés
    def arm_dir(self, s):
        a = math.radians(ARM_ANGLE)
        return Vector((s * math.sin(a), 0, -math.cos(a)))

    def shoulder(self, s): return Vector((s * self.shoulder_w, 0.0, self.shoulder_z))
    def elbow(self, s): return self.shoulder(s) + self.arm_dir(s) * self.upper_arm
    def wrist(self, s): return self.elbow(s) + self.arm_dir(s) * self.forearm
    def hip(self, s): return Vector((s * self.hip_w, 0.0, self.hip_z - 0.05))
    def knee(self, s): return Vector((s * self.hip_w, -0.005, self.knee_z))
    def ankle(self, s): return Vector((s * self.hip_w, 0.012, self.ankle_z))

    def hand_frame(self, s):
        """Repère de la main : d (vers les doigts), n (dos de la main, vers l'extérieur), f (vers l'avant)."""
        a = math.radians(ARM_ANGLE)
        d = self.arm_dir(s); n = Vector((s * math.cos(a), 0, math.sin(a))); f = Vector((0, -1, 0))
        w = self.wrist(s)
        return lambda x, y, z: w + d * x + n * y + f * z

    def grip(self, s):
        """Centre du poing fermé : là où passe la hampe d'une arme."""
        return self.hand_frame(s)(0.085, -0.014, 0.0)


def skeleton(p):
    b = [
        ('hips', None, (0, 0, p.hip_z), (0, 0, p.spine_z)),
        ('spine', 'hips', (0, 0, p.spine_z), (0, 0, p.chest_z)),
        ('chest', 'spine', (0, 0, p.chest_z), (0, 0, p.neck_z)),
        ('neck', 'chest', (0, 0.01, p.neck_z), (0, 0.005, p.head_z)),
        ('head', 'neck', (0, 0.005, p.head_z), (0, 0.005, p.top_z)),
    ]
    for s, S in ((1, 'L'), (-1, 'R')):
        sh, el, wr = p.shoulder(s), p.elbow(s), p.wrist(s)
        b += [
            ('upperArm' + S, 'chest', sh, el),
            ('forearm' + S, 'upperArm' + S, el, wr),
            ('hand' + S, 'forearm' + S, wr, wr + p.arm_dir(s) * p.hand),
            ('thigh' + S, 'hips', p.hip(s), p.knee(s)),
            ('shin' + S, 'thigh' + S, p.knee(s), p.ankle(s)),
            ('foot' + S, 'shin' + S, p.ankle(s), (s * p.hip_w, -0.15, 0.02)),
        ]
    return [(n, par, tuple(h), tuple(t)) for n, par, h, t in b]


def body(p, name='body', tris=9000, voxel=0.008):
    """Corps sans tête ni mains (ceux-ci sont des pièces rigides, plus détaillées)."""
    c = Clay()
    k, w = p.bulk, p.torso_w
    # tronc
    c.ball((0, 0.005, p.hip_z - 0.02), (0.150 * w, 0.105 * k, 0.11))
    c.ball((0, -0.002 - p.belly * 0.04, 1.14), ((0.128 + p.belly * 0.03) * w, (0.092 + p.belly * 0.05) * k, 0.14))
    c.ball((0, 0.008, 1.33), (0.172 * w, 0.115 * k, 0.17))
    c.hull([((0, 0.012, p.shoulder_z + 0.005), 0.072 * k), ((p.shoulder_w - 0.05, 0.012, p.shoulder_z), 0.066 * k), ((-(p.shoulder_w - 0.05), 0.012, p.shoulder_z), 0.066 * k)])
    c.capsule((0, 0.014, p.neck_z - 0.05), (0, 0.006, p.head_z + 0.02), 0.056 * k, 0.05 * k)

    def side(s):
        d = p.arm_dir(s); ang = -s * ARM_ANGLE
        sh, el, wr = p.shoulder(s), p.elbow(s), p.wrist(s)
        # torse : pectoraux, dorsaux, trapèzes, abdominaux, fessiers
        c.ball((s * 0.086 * w, -0.07 * k, 1.415), (0.1 * w, 0.042 * k, 0.062), rot=(10, 0, s * 8))
        c.ball((s * 0.128 * w, 0.04, 1.32), (0.06, 0.075 * k, 0.15))
        c.hull([((0, 0.03, p.neck_z + 0.045), 0.045 * k), ((s * (p.shoulder_w - 0.07), 0.025, p.shoulder_z + 0.02), 0.042 * k)])
        for i, z in enumerate((1.245, 1.175, 1.105)):
            c.ball((s * 0.036, -0.078 * k - p.belly * 0.03, z), (0.036, 0.022, 0.03))
        c.ball((s * 0.075, 0.055 * k, p.hip_z - 0.045), (0.086, 0.078 * k, 0.092))
        # bras
        c.ball(sh + Vector((s * 0.012, 0, -0.005)), (0.074 * k, 0.07 * k, 0.085 * k), rot=(0, ang, 0))
        c.capsule(sh, el, 0.05 * k, 0.041 * k)
        c.ball(sh + d * 0.15 + Vector((0, -0.018, 0)), (0.048 * k, 0.046 * k, 0.09), rot=(0, ang, 0))
        c.ball(sh + d * 0.16 + Vector((0, 0.022, 0)), (0.045 * k, 0.042 * k, 0.1), rot=(0, ang, 0))
        c.ball(el, 0.041 * k)
        c.capsule(el, wr, 0.042 * k, 0.03 * k)
        c.ball(el + d * 0.085 + Vector((0, -0.006, 0)), (0.047 * k, 0.044 * k, 0.085), rot=(0, ang, 0))
        # jambes
        hp, kn, an = p.hip(s), p.knee(s), p.ankle(s)
        c.capsule(hp, kn, 0.086 * k, 0.057 * k)
        c.ball((s * (p.hip_w + 0.006), -0.032, (hp.z + kn.z) / 2 + 0.03), (0.076 * k, 0.07 * k, 0.17))
        c.ball((s * p.hip_w, 0.038, (hp.z + kn.z) / 2 + 0.02), (0.07 * k, 0.062 * k, 0.16))
        c.ball(kn + Vector((0, -0.018, 0)), 0.054 * k)
        c.capsule(kn, an, 0.054 * k, 0.036 * k)
        c.ball((s * (p.hip_w + 0.003), 0.03, kn.z - 0.15), (0.056 * k, 0.056 * k, 0.13))
        # pieds
        x = s * p.hip_w
        c.hull([((x, 0.035, 0.042), 0.04), ((x + s * 0.006, -0.09, 0.034), (0.05, 0.045, 0.032)), ((x + s * 0.004, -0.165, 0.024), (0.05, 0.032, 0.023))])
        for i in range(5):  # orteils
            c.ball((x + s * (-0.034 + i * 0.019), -0.198 + i * 0.006 * s * (1 if s > 0 else -1) * 0, 0.02 - i * 0.001), (0.0105 - i * 0.0006, 0.016, 0.012))

    c.mirror(side)
    ob = c.to_object(name)
    ob.data.validate()
    fuse(ob, voxel=voxel, smooth=22, smooth_factor=0.6, tris=tris)
    ob.data.validate()
    return ob


def head(p, name='head', tris=7000, voxel=0.0035, jaw=1.0, nose=1.0, lips=1.0, brow=1.0, face_w=1.0, scale=1.12):
    """Tête stylisée : crâne, visage à plans francs, mâchoire, arcades, nez, lèvres, oreilles, orbites creusées.
    scale grossit la tête autour de son articulation (proportions stylisées).
    Retourne l'objet et les positions des yeux."""
    z0 = p.head_z + 0.1
    c = Clay()
    c.ball((0, 0.02, z0 + 0.03), (0.088, 0.104, 0.1))                           # crâne
    fw = face_w
    c.hull([((0.044 * fw, -0.066, z0 + 0.05), 0.036), ((-0.044 * fw, -0.066, z0 + 0.05), 0.036),      # front
            ((0.05 * fw, -0.06, z0 - 0.02), 0.034), ((-0.05 * fw, -0.06, z0 - 0.02), 0.034),          # joues
            ((0.058 * fw * jaw, -0.004, z0 - 0.066), 0.026), ((-0.058 * fw * jaw, -0.004, z0 - 0.066), 0.026),   # angles de la mâchoire
            ((0.02 * jaw, -0.08, z0 - 0.094), 0.025), ((-0.02 * jaw, -0.08, z0 - 0.094), 0.025)])      # menton
    c.capsule((0, 0.014, p.neck_z + 0.0), (0, 0.008, z0 - 0.05), 0.06, 0.056)   # cou (s'emboîte dans le torse)
    c.hull([((0.048, -0.094, z0 + 0.03), 0.0145 * brow), ((-0.048, -0.094, z0 + 0.03), 0.0145 * brow), ((0, -0.098, z0 + 0.025), 0.014 * brow)])
    c.hull([((0, -0.102, z0 + 0.016), 0.011), ((0, -0.126 - 0.006 * (nose - 1), z0 - 0.026), 0.015 * nose)])   # nez
    c.ball((0, -0.109, z0 - 0.054), (0.032 * lips, 0.014, 0.0095 * lips))       # lèvre supérieure
    c.ball((0, -0.106, z0 - 0.071), (0.029 * lips, 0.015, 0.0115 * lips))       # lèvre inférieure

    def side(s):
        c.ball((s * 0.055 * fw, -0.074, z0 - 0.014), (0.024, 0.02, 0.016))          # pommette
        c.ball((s * 0.0175 * nose, -0.113, z0 - 0.032), 0.012 * nose)               # aile du nez
        c.ball((s * 0.086, 0.018, z0 - 0.006), (0.009, 0.019, 0.03), rot=(0, s * 8, s * -10))   # oreille

    c.mirror(side)
    ob = c.to_object(name)
    fuse(ob, voxel=voxel, smooth=10, smooth_factor=0.5)
    eyes = [(s * 0.039, -0.082, z0 + 0.004) for s in (1, -1)]
    cut = Clay()
    for ex, ey, ez in eyes: cut.ball((ex, ey - 0.02, ez), (0.0205, 0.018, 0.0105))    # orbites
    cut.ball((0, -0.125, z0 - 0.0625), (0.028 * lips, 0.014, 0.0018))                 # fente de la bouche
    for s in (1, -1): cut.ball((s * 0.0105 * nose, -0.128, z0 - 0.0385), (0.005, 0.006, 0.0035))   # narines
    carve(ob, cut)
    fuse(ob, voxel=voxel, smooth=2, smooth_factor=0.35, tris=tris)
    pivot = Vector((0, 0.005, p.head_z))
    for v in ob.data.vertices: v.co = pivot + (v.co - pivot) * scale
    ob['eye_z'] = p.head_z + (z0 + 0.004 - p.head_z) * scale
    ob['scale'] = scale
    eyes = [tuple(pivot + (Vector(e) - pivot) * scale) for e in eyes]
    return ob, eyes


def eyelids(positions, color, scale=1.12, name='paupieres'):
    """Paupières supérieures : donnent le regard (sans elles, les yeux paraissent exorbités)."""
    c = Clay()
    for (x, y, z) in positions:
        c.ball((x, y - 0.0035 * scale, z + 0.0075 * scale), (0.0185 * scale, 0.0165 * scale, 0.0095 * scale), rot=(-12, 0, -8 if x > 0 else 8))
    ob = c.to_object(name); shade_smooth(ob)
    paint(ob, color, cavity=0)
    return ob


def eyes(positions, radius=0.0172, iris=(60, 34, 18), name='eyes'):
    """Globes oculaires : blanc, iris et pupille peints par sommet, reflet dans l'iris."""
    c = Clay()
    for pos in positions: c.ball(pos, radius, sub=4)
    ob = c.to_object(name)
    shade_smooth(ob)
    from .forge import paint as _paint
    def ring(r0, r1):
        def fn(co):
            w = np.zeros(len(co), dtype=np.float32)
            for (x, y, z) in positions:
                d = np.sqrt((co[:, 0] - x) ** 2 + (co[:, 2] - z) ** 2)
                front = co[:, 1] < y
                w = np.maximum(w, np.where(front, np.clip((r1 - d) / max(r1 - r0, 1e-4), 0, 1), 0))
            return w
        return fn
    _paint(ob, srgb(238, 232, 222), rules=[(ring(radius * 0.52, radius * 0.6), srgb(*iris)), (ring(radius * 0.2, radius * 0.27), srgb(8, 6, 5))], cavity=0)
    return ob


def hand(p, s, name, tris=1400):
    """Poing fermé autour d'une hampe (prise d'arme), avec doigts et pouce distincts."""
    P = p.hand_frame(s)
    c = Clay()
    c.capsule(P(-0.035, 0.0, 0), P(0.02, 0.006, 0), 0.03, 0.028)                       # poignet
    c.hull([(P(0.025, 0.014, -0.024), 0.017), (P(0.025, 0.014, 0.024), 0.017), (P(0.072, 0.016, -0.032), 0.017), (P(0.072, 0.016, 0.032), 0.017)])   # paume
    for i in range(4):
        z = -0.034 + i * 0.0225
        r = 0.0108 - abs(i - 1.2) * 0.0007
        c.chain([(P(0.082, 0.014, z), r), (P(0.112, -0.012, z), r * 0.95), (P(0.102, -0.04, z), r * 0.88), (P(0.074, -0.043, z), r * 0.82)])
    c.chain([(P(0.028, -0.004, -0.036), 0.0125), (P(0.06, -0.022, -0.05), 0.011), (P(0.088, -0.044, -0.047), 0.0098)])   # pouce
    ob = c.to_object(name)
    fuse(ob, voxel=0.003, smooth=3, smooth_factor=0.5, tris=tris)
    return ob
