"""Outils de modélisation par script pour Blender (module bpy), sans interface.

Méthode : on assemble des volumes simples (sphères déformées, capsules effilées, enveloppes convexes),
on les fusionne en une seule peau par remaillage volumique, puis on lisse et on allège le maillage.
C'est l'équivalent scripté d'une ébauche de sculpture.

Repère Blender : Z vers le haut, le personnage regarde vers -Y, sa gauche est en +X.
"""
import math
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _activate(obj):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj, mod):
    _activate(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


class Clay:
    """Accumule des volumes dans un même maillage brut."""

    def __init__(self):
        self.bm = bmesh.new()

    def ball(self, c, r, rot=None, sub=3):
        """Ellipsoïde. r : rayon ou (rx, ry, rz). rot : angles d'Euler en degrés."""
        r = (r, r, r) if isinstance(r, (int, float)) else r
        m = Matrix.Translation(Vector(c))
        if rot: m = m @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
        m = m @ Matrix.Diagonal((r[0], r[1], r[2], 1))
        bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0, matrix=m)
        return self

    def hull(self, spheres, sub=2):
        """Enveloppe convexe de plusieurs sphères [(centre, rayon), ...] : capsules, coins, plaques."""
        tmp = bmesh.new()
        for c, r in spheres:
            rr = (r, r, r) if isinstance(r, (int, float)) else r
            bmesh.ops.create_icosphere(tmp, subdivisions=sub, radius=1.0, matrix=Matrix.Translation(Vector(c)) @ Matrix.Diagonal((rr[0], rr[1], rr[2], 1)))
        res = bmesh.ops.convex_hull(tmp, input=tmp.verts[:])
        junk = [g for g in res['geom_interior'] + res['geom_unused'] if isinstance(g, bmesh.types.BMVert) and g.is_valid]
        if junk: bmesh.ops.delete(tmp, geom=junk, context='VERTS')
        me = bpy.data.meshes.new('_tmp'); tmp.to_mesh(me); tmp.free()
        self.bm.from_mesh(me); bpy.data.meshes.remove(me)
        return self

    def capsule(self, a, b, ra, rb=None):
        return self.hull([(a, ra), (b, ra if rb is None else rb)])

    def chain(self, pts):
        """Suite de capsules : [(point, rayon), ...]."""
        for (a, ra), (b, rb) in zip(pts, pts[1:]): self.capsule(a, b, ra, rb)
        return self

    def mirror(self, fn):
        """Appelle fn(signe) pour la gauche (+1) et la droite (-1)."""
        for s in (1, -1): fn(s)
        return self

    def to_object(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me); self.bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def fuse(obj, voxel, smooth=8, smooth_factor=0.6, tris=None, laplacian=0):
    """Fusionne les volumes en une peau unique, lisse, puis réduit au nombre de triangles voulu."""
    m = obj.modifiers.new('fusion', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.adaptivity = 0
    apply_modifier(obj, m)
    if smooth:
        m = obj.modifiers.new('lissage', 'SMOOTH'); m.factor = smooth_factor; m.iterations = smooth
        apply_modifier(obj, m)
    if tris:
        n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if n > tris:
            m = obj.modifiers.new('allègement', 'DECIMATE'); m.ratio = tris / n
            apply_modifier(obj, m)
    shade_smooth(obj)
    return obj


def carve(obj, cutter_clay, name='_outil'):
    """Retire de obj le volume décrit par cutter_clay (orbites, bouche, entailles)."""
    cut = cutter_clay.to_object(name)
    m = cut.modifiers.new('f', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.004; apply_modifier(cut, m)
    m = obj.modifiers.new('creux', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cut; m.solver = 'EXACT'
    apply_modifier(obj, m)
    bpy.data.objects.remove(cut)
    return obj


def shade_smooth(obj):
    for p in obj.data.polygons: p.use_smooth = True


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ───────────────────────── Couleurs par sommet
def paint(obj, base, rules=(), cavity=0.55, cavity_scale=60.0, gradient=None, name='Col'):
    """Peint les sommets : couleur de base, règles locales, creux assombris, dégradé vertical.

    rules : [(fonction(positions Nx3) -> poids N entre 0 et 1, couleur)], appliquées dans l'ordre.
    cavity : intensité de l'assombrissement des creux (occlusion approchée par la courbure).
    gradient : (z_bas, z_haut, facteur_bas, facteur_haut) multiplie la luminosité selon la hauteur.
    """
    me = obj.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
    no = np.empty(n * 3, dtype=np.float32); me.vertices.foreach_get('normal', no); no = no.reshape(n, 3)
    col = np.tile(np.array(base, dtype=np.float32), (n, 1))
    for fn, c in rules:
        w = np.clip(fn(co), 0, 1)[:, None]
        col = col * (1 - w) + np.array(c, dtype=np.float32) * w
    if cavity:
        # courbure : écart entre un sommet et la moyenne de ses voisins, projeté sur la normale
        e = np.empty(len(me.edges) * 2, dtype=np.int32); me.edges.foreach_get('vertices', e); e = e.reshape(-1, 2)
        acc = np.zeros((n, 3), dtype=np.float32); cnt = np.zeros(n, dtype=np.float32)
        np.add.at(acc, e[:, 0], co[e[:, 1]]); np.add.at(acc, e[:, 1], co[e[:, 0]])
        np.add.at(cnt, e[:, 0], 1); np.add.at(cnt, e[:, 1], 1)
        d = ((acc / np.maximum(cnt, 1)[:, None]) - co)
        conc = np.einsum('ij,ij->i', d, no) * cavity_scale       # > 0 dans les creux
        for _ in range(3):                                       # adoucit la carte
            a2 = np.zeros(n, dtype=np.float32)
            np.add.at(a2, e[:, 0], conc[e[:, 1]]); np.add.at(a2, e[:, 1], conc[e[:, 0]])
            conc = 0.5 * conc + 0.5 * a2 / np.maximum(cnt, 1)
        shade = 1 - cavity * np.clip(conc, 0, 1) + 0.25 * cavity * np.clip(-conc, 0, 1)
        col *= shade[:, None]
    if gradient:
        z0, z1, f0, f1 = gradient
        t = np.clip((co[:, 2] - z0) / (z1 - z0), 0, 1)
        col *= (f0 + (f1 - f0) * t)[:, None]
    col = np.clip(col, 0, 1)
    rgba = np.concatenate([col, np.ones((n, 1), dtype=np.float32)], axis=1)
    attr = me.color_attributes.get(name) or me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', rgba.ravel())
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = list(me.color_attributes).index(attr)
    return obj


def near(center, radius, soft=0.5):
    """Règle de peinture : poids 1 au centre d'un ellipsoïde, 0 au bord (bord adouci)."""
    c = np.array(center, dtype=np.float32)
    r = np.array((radius,) * 3 if isinstance(radius, (int, float)) else radius, dtype=np.float32)
    def fn(co):
        d = np.linalg.norm((co - c) / r, axis=1)
        return np.clip((1 - d) / max(soft, 1e-3), 0, 1)
    return fn


def spots(n, size, seed=1, ring=0.0):
    """Règle de peinture : n taches réparties au hasard sur la surface (pelage, peau de vache).
    ring > 0 : taches en anneau (rosettes de léopard)."""
    def fn(co):
        r = np.random.default_rng(seed)
        centers = co[r.choice(len(co), size=min(n, len(co)), replace=False)]
        sizes = size * (0.6 + 0.8 * r.random(len(centers)))
        d = np.linalg.norm(co[:, None, :] - centers[None, :, :], axis=2) / sizes[None, :]
        w = np.clip((1 - d) / 0.25, 0, 1)
        if ring: w = w * np.clip((d - ring) / 0.15, 0, 1)
        return w.max(axis=1)
    return fn


def patches(scale, threshold=0.15, seed=0.0):
    """Règle de peinture : grandes plaques irrégulières (robe de vache)."""
    def fn(co):
        x, y, z = co[:, 0] * scale + seed, co[:, 1] * scale, co[:, 2] * scale + seed * 1.7
        v = np.sin(x * 1.3 + np.sin(z * 0.9) * 1.6) + np.sin(z * 1.1 + 1.7 + np.sin(x * 0.7) * 1.3) + 0.6 * np.sin((x + z) * 2.3 + y)
        return np.clip((v - threshold * 3) / 0.25, 0, 1)
    return fn


def ellipse(n, rx, ry, z, cx=0.0, cy=0.0, start=0.0):
    """n points sur une ellipse horizontale ; l'angle 0 est devant le personnage (-Y)."""
    out = []
    for i in range(n):
        a = start + 2 * math.pi * i / n
        out.append((cx + rx * math.sin(a), cy - ry * math.cos(a), z, a))
    return out


def beads(points, radius, colors, name):
    """Rang de perles : une petite sphère par point, couleurs alternées."""
    bm = bmesh.new(); cols = []
    for i, pt in enumerate(points):
        n0 = len(bm.verts)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius, matrix=Matrix.Translation(Vector(pt[:3])))
        cols += [colors[i % len(colors)]] * (len(bm.verts) - n0)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    shade_smooth(ob)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', np.array([(*c, 1.0) for c in cols], dtype=np.float32).ravel())
    return ob


class Surface:
    """Pose des accessoires sur la peau : projette des points sur la surface d'un maillage."""

    def __init__(self, obj):
        from mathutils.bvhtree import BVHTree
        bm = bmesh.new(); bm.from_mesh(obj.data); bm.transform(obj.matrix_world)
        self.tree = BVHTree.FromBMesh(bm); self.bm = bm

    def snap(self, pt, offset=0.0):
        loc, normal, _, _ = self.tree.find_nearest(Vector(pt[:3]))
        return tuple(loc + normal * offset)

    def snap_all(self, pts, offset=0.0):
        return [self.snap(q, offset) for q in pts]


def grid_shell(name, fn, nu, nv, thickness):
    """Coque fine définie par une fonction (u, v dans [-1, 1]) -> point : boucliers, tabliers, capes."""
    bm = bmesh.new()
    rows = [[bm.verts.new(fn(-1 + 2 * i / nu, -1 + 2 * j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    # coordonnées de texture : u (hauteur) -> V de l'image, v (largeur) -> U de l'image
    uv = bm.loops.layers.uv.new('UVMap')
    index = {}
    for i in range(nu + 1):
        for j in range(nv + 1): index[rows[i][j]] = (j / nv, i / nu)
    for f in bm.faces:
        for l in f.loops: l[uv].uv = index[l.vert]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new('épaisseur', 'SOLIDIFY'); m.thickness = thickness; m.offset = 0
    apply_modifier(ob, m)
    shade_smooth(ob)
    return ob


def image_from_array(name, rgb):
    """Crée une image Blender (intégrée au GLB à l'export) depuis un tableau H x W x 3 en sRGB 0-1, ligne 0 en bas."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.concatenate([rgb.astype(np.float32), np.ones((h, w, 1), dtype=np.float32)], axis=2)
    img.pixels.foreach_set(px.ravel())
    img.file_format = 'PNG'; img.pack()
    return img


def material(name, color=(1, 1, 1), rough=0.8, metal=0.0, vertex_color=True, image=None, emissive=None, double=False):
    """Matériau exportable en glTF. Les couleurs par sommet multiplient la couleur de base."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if image is not None:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = image
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if emissive:
        b.inputs['Emission Color'].default_value = (*emissive, 1); b.inputs['Emission Strength'].default_value = 1.0
    m.use_backface_culling = not double
    m['vertexColors'] = bool(vertex_color)
    return m


def assign(obj, mat):
    obj.data.materials.clear(); obj.data.materials.append(mat)
    return obj


# ───────────────────────── Squelette
def build_armature(name, bones):
    """bones : [(nom, parent ou None, tête (x,y,z), queue (x,y,z))]."""
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(ob)
    _activate(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, parent, head, tail in bones:
        eb = arm.edit_bones.new(bname)
        eb.head = Vector(head); eb.tail = Vector(tail)
        if parent: eb.parent = arm.edit_bones[parent]; eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def skin_to(obj, arm):
    """Poids de peau automatiques (diffusion de chaleur depuis les os)."""
    for o in bpy.context.view_layer.objects: o.select_set(False)
    obj.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    groups = {g.name for g in obj.vertex_groups}
    if not groups: raise RuntimeError(f'poids automatiques non calculés pour {obj.name}')
    unweighted = sum(1 for v in obj.data.vertices if not v.groups)
    return unweighted


def set_origin(obj, point):
    """Place le pivot de l'objet en un point donné (ex. la prise en main d'un bouclier), sans le déplacer."""
    pt = Vector(point)
    obj.data.transform(Matrix.Translation(-pt))
    obj.location = pt
    bpy.context.view_layer.update()
    return obj


def attach(obj, arm, bone):
    """Fixe un objet rigide à un os en conservant sa position dans le monde."""
    bpy.context.view_layer.update()
    pb = arm.pose.bones[bone]
    obj.parent = arm; obj.parent_type = 'BONE'; obj.parent_bone = bone
    obj.matrix_parent_inverse = (arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))).inverted()
    return obj


def export_glb(path, objects):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in objects: o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_skins=True, export_animations=False, export_extras=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
        export_normals=True, export_tangents=False, export_image_format='AUTO',
    )
