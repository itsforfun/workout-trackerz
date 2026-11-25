"""Build models/body-female.glb: the female figure for Odyr's turning 3D body (v3.2).

A smooth, athletic female mannequin made with MPFB (MakeHuman for Blender; exported assets are CC0), posed like
the male model (arms down) and sized to the same frame. Her skin is split into Odyr's muscle groups by rules:
which bone of her rig moves each part of the skin (MPFB's skin weights), where it sits on the body and which way
it faces (thigh skin facing forward = quads, facing back = hamstrings, facing the other leg = adductors ...).
These are regions on the skin, not anatomical muscles. The chest region stops above the bust; the bust itself,
head, hands and feet are never a muscle group. The face is smoothed into a featureless mannequin head.

Run with Blender 4.5 and the MPFB extension installed (no window opens):
    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/build-body-female.py -- [models/body.glb] [models/body-female.glb]
"""
import json
import math
import os
import struct
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MALE = args[0] if len(args) > 0 else os.path.join(ROOT, 'models', 'body.glb')
OUT = args[1] if len(args) > 1 else os.path.join(ROOT, 'models', 'body-female.glb')

# Athletic and clearly female: toned, average weight, natural bust
MACROS = {'gender': 0.0, 'muscle': 0.6, 'weight': 0.5, 'proportions': 0.8, 'cupsize': 0.5, 'firmness': 0.7}
# An hourglass silhouette: narrower waist, fuller hips and glutes, softer shoulders (MPFB shape targets, 0–1)
SHAPE = {
    'torso/measure-waist-circ-decr': 0.55,
    'torso/measure-hips-circ-incr': 0.45,
    'buttocks/buttocks-volume-incr': 0.55,
    'hip/hip-scale-horiz-incr': 0.2,
    'torso/torso-vshape-decr': 0.25,
    'torso/measure-shoulder-dist-decr': 0.15,
}
ARM_ANGLE = 9          # degrees out from vertical, like the male model's hanging arms
HEAD_FROM = 0.875      # share of her height above which the head is smoothed into a mannequin head
SMOOTH_PASSES = 4      # majority filter on face labels, for clean region edges

NEVER = ('head', 'jaw', 'special', 'oris', 'tongue', 'levator', 'orbicularis', 'temporalis', 'oculi', 'risorius',
         'eye', 'wrist', 'metacarpal', 'finger', 'foot', 'toe')
MARKS = {'nipple', 'nippleTip', 'genitals'}


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def male_frame():
    """Height of the male figure and the depth centre of his torso, so she stands in the same frame."""
    bpy.ops.import_scene.gltf(filepath=MALE)
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    pts = np.array([o.matrix_world @ v.co for o in objs for v in o.data.vertices])
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    torso = pts[(pts[:, 2] > 0.95) & (pts[:, 2] < 1.35)]
    return pts[:, 2].max() - pts[:, 2].min(), (torso[:, 1].min() + torso[:, 1].max()) / 2


def is_bone_group(name):
    return '.' in name or name.startswith(('spine', 'neck', 'head', 'root', 'jaw'))


def make_female():
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    from bl_ext.user_default.mpfb.services.targetservice import TargetService
    human = HumanService.create_human()
    macros = TargetService.get_default_macro_info_dict()
    macros.update(MACROS)
    TargetService.reapply_macro_details(human, macros)
    from bl_ext.user_default.mpfb.services.locationservice import LocationService
    targets = LocationService.get_mpfb_data('targets')
    for name, weight in SHAPE.items():
        TargetService.load_target(human, os.path.join(targets, name + '.target.gz'), weight=weight)
    bpy.context.view_layer.update()
    rig = HumanService.add_builtin_rig(human, 'default')
    bpy.context.view_layer.update()
    # Lower both arms from the A-pose to hang beside the body
    for side, sign in (('L', 1), ('R', -1)):
        pb = rig.pose.bones[f'upperarm01.{side}']
        current = ((rig.matrix_world @ pb.tail) - (rig.matrix_world @ pb.head)).normalized()
        a = math.radians(ARM_ANGLE)
        target = Vector((sign * math.sin(a), 0.0, -math.cos(a))).normalized()
        rot = current.rotation_difference(target).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(pb.head) @ rot @ Matrix.Translation(-pb.head) @ pb.matrix
        bpy.context.view_layer.update()
    joints = {b.name: rig.matrix_world @ b.head for b in rig.pose.bones}
    depsgraph = bpy.context.evaluated_depsgraph_get()
    ev = human.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(ev, depsgraph=depsgraph)
    names = [g.name for g in human.vertex_groups]
    # Strongest bone and any marker groups (nipple, genitals) for each vertex, read before the groups are dropped
    bones, marks = [], []
    for v in mesh.vertices:
        best, weight, mark = '', 0.0, set()
        for g in v.groups:
            n = names[g.group]
            if n in MARKS and g.weight > 0.1:
                mark.add(n)
            if is_bone_group(n) and g.weight > weight:
                best, weight = n, g.weight
        bones.append(best)
        marks.append(mark)
    obj = bpy.data.objects.new('Female', mesh)
    obj.matrix_world = human.matrix_world.copy()
    bpy.context.collection.objects.link(obj)
    bpy.data.objects.remove(human, do_unlink=True)
    bpy.data.objects.remove(rig, do_unlink=True)
    return obj, bones, marks, joints


def soften(obj, marks):
    """A mannequin, not a portrait: smooth the face away and the nipples (the bust keeps its shape), then a light pass."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    zs = [v.co.z for v in bm.verts]
    lo, hi = min(zs), max(zs)
    height = hi - lo
    head = [v for v in bm.verts if v.co.z > lo + HEAD_FROM * height]
    marked = [bm.verts[i].co.copy() for i, m in enumerate(marks) if m & {'nipple', 'nippleTip'}]
    bust = [v for v in bm.verts if marked and min((v.co - c).length for c in marked[::4]) < 0.03]
    for _ in range(40):
        bmesh.ops.smooth_vert(bm, verts=head, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for _ in range(12):
        bmesh.ops.smooth_vert(bm, verts=bust, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for _ in range(2):
        bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.3, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(obj.data)
    bm.free()


def polygon_normals(pts, polygons):
    """Vertex normals from polygons of any size (fan-split for the sums)."""
    tris = np.array([(p[0], p[k], p[k + 1]) for p in polygons for k in range(1, len(p) - 1)], dtype=np.int64)
    return vertex_normals(pts, tris)


def vertex_normals(pts, faces):
    n = np.zeros_like(pts)
    fn = np.cross(pts[faces[:, 1]] - pts[faces[:, 0]], pts[faces[:, 2]] - pts[faces[:, 0]])
    for k in range(3):
        np.add.at(n, faces[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


def label_vertices(pts, normals, bones, marks, joints):
    """Odyr group for each vertex. Blender axes: front is -Y, her left is +X, up is +Z."""
    z = pts[:, 2]
    height = z.max() - z.min()
    u = height / 1.66                                  # proportions below are for a 1.66 m figure
    nipple = np.array([bool(m & {'nipple', 'nippleTip'}) for m in marks])
    apex = z[nipple].mean() if nipple.any() else z.min() + 0.72 * height
    bust_top, bust_low = apex + 0.07 * u, apex - 0.065 * u
    hip_joint = (joints['upperleg01.L'].z + joints['upperleg01.R'].z) / 2
    crest = hip_joint + 0.11 * u                       # top of the pelvis
    fold = hip_joint - 0.10 * u                        # where the glutes meet the thigh
    armpit = (joints['upperarm01.L'].z + joints['upperarm01.R'].z) / 2 - 0.07 * u
    neck = joints['neck01'].z
    labels = []
    for i, (p, n, bone) in enumerate(zip(pts, normals, bones)):
        x, _y, zz = p
        ax = abs(x)
        out = n[0] * (1 if x >= 0 else -1)            # > 0 faces away from the midline
        front, back = n[1] < -0.3, n[1] > 0.3
        lab = 'rest'
        if not bone or bone.startswith(NEVER) or marks[i] & MARKS:
            lab = 'rest'
        elif bone.startswith('neck'):
            lab = 'g_tp' if back or n[2] > 0.5 else 'rest'
        elif bone.startswith('lowerarm'):
            lab = 'g_fa'
        elif bone.startswith(('upperarm', 'shoulder')):
            shoulder = joints['upperarm01.L' if x >= 0 else 'upperarm01.R'].z
            if zz > shoulder - 0.09 * u:
                lab = 'g_sh'
            else:
                lab = 'g_bi' if n[1] < 0 else 'g_tr'
        elif bone.startswith('lowerleg'):
            lab = 'g_cf'
        elif bone.startswith('upperleg'):
            if back and zz > fold:
                lab = 'g_gl'
            elif out < -0.45:
                lab = 'g_ad'
            elif back or (n[1] > 0.1 and out < 0.6):
                lab = 'g_hm'
            else:
                lab = 'g_qd'
        elif bone.startswith(('pelvis', 'root')):
            if back or (out > 0.6 and zz > fold):
                lab = 'g_gl'
            elif front and zz > hip_joint and ax < 0.09 * u:
                lab = 'g_ab'
        else:   # spine, clavicle, breast: the torso
            if back:
                if zz > armpit + 0.35 * (neck - armpit) or (zz > armpit and ax < 0.06 * u):
                    lab = 'g_tp'
                elif zz > (crest + armpit) / 2 or ax > 0.09 * u:
                    lab = 'g_ub'
                else:
                    lab = 'g_lb'
            elif front:
                if bust_top < zz < neck - 0.02 * u:
                    lab = 'g_ch' if ax < 0.15 * u else 'g_sh'
                elif zz >= bust_low:
                    lab = 'rest'                       # the bust is never coloured
                elif zz > crest - 0.06 * u:
                    lab = 'g_ab' if ax < 0.065 * u else 'g_ob'
            else:       # the sides of the torso
                lab = 'g_ub' if zz > bust_low else ('g_ob' if zz > crest - 0.06 * u else 'rest')
        labels.append(lab)
    print('landmarks: apex', round(apex, 3), 'bust', round(bust_low, 3), round(bust_top, 3), 'crest', round(crest, 3),
          'hip', round(hip_joint, 3), 'fold', round(fold, 3), 'armpit', round(armpit, 3), 'neck', round(neck, 3))
    return np.array(labels, dtype=object)


def face_labels(vertex_labels, faces):
    """faces: the original polygons (mostly quads), so region borders run along the mesh's rows, not zig-zag."""
    out = []
    for f in faces:
        ls = [vertex_labels[k] for k in f]
        out.append(max(set(ls), key=lambda l: (ls.count(l), l != 'rest')))
    out = np.array(out, dtype=object)
    # Majority filter over neighbouring faces, for clean edges
    edges = {}
    for fi, f in enumerate(faces):
        for a, b in zip(f, f[1:] + f[:1]):
            edges.setdefault((min(a, b), max(a, b)), []).append(fi)
    neighbours = [[] for _ in faces]
    for fs in edges.values():
        for i in fs:
            neighbours[i].extend(j for j in fs if j != i)
    for _ in range(SMOOTH_PASSES):
        nxt = out.copy()
        for i, ns in enumerate(neighbours):
            votes = {}
            for j in ns:
                votes[out[j]] = votes.get(out[j], 0) + 1
            if votes:
                best = max(votes, key=lambda k: votes[k])
                if best != out[i] and votes[best] >= 2:
                    nxt[i] = best
        out = nxt
    return out


def write_glb(meshes, out):
    """meshes: list of (name, positions Nx3, normals Nx3, faces Mx3), already in glTF axes (Y up, front +Z)."""
    binary = bytearray()
    gltf = {'asset': {'version': '2.0', 'generator': 'Odyr tools/build-body-female.py',
                      'copyright': 'Figure made with MakeHuman/MPFB (CC0)'},
            'scene': 0, 'scenes': [{'nodes': list(range(len(meshes)))}],
            'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': []}

    def add(data, target, comp, count, kind, extra=None):
        while len(binary) % 4:
            binary.append(0)
        gltf['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data), 'target': target})
        binary.extend(data)
        acc = {'bufferView': len(gltf['bufferViews']) - 1, 'componentType': comp, 'count': count, 'type': kind}
        acc.update(extra or {})
        gltf['accessors'].append(acc)
        return len(gltf['accessors']) - 1

    for i, (name, v, n, f) in enumerate(meshes):
        v = v.astype(np.float32)
        p = add(v.tobytes(), 34962, 5126, len(v), 'VEC3', {'min': v.min(axis=0).tolist(), 'max': v.max(axis=0).tolist()})
        q = add(n.astype(np.float32).tobytes(), 34962, 5126, len(n), 'VEC3')
        idx_type, idx_np = (5123, np.uint16) if len(v) < 65536 else (5125, np.uint32)
        k = add(f.astype(idx_np).ravel().tobytes(), 34963, idx_type, f.size, 'SCALAR')
        gltf['meshes'].append({'name': name, 'primitives': [{'attributes': {'POSITION': p, 'NORMAL': q}, 'indices': k}]})
        gltf['nodes'].append({'name': name, 'mesh': i})
    gltf['buffers'] = [{'byteLength': len(binary)}]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    while len(binary) % 4:
        binary.append(0)
    with open(out, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        fh.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


def main():
    clear()
    male_height, male_torso_y = male_frame()
    obj, bones, marks, joints = make_female()
    soften(obj, marks)
    pts = np.array([obj.matrix_world @ v.co for v in obj.data.vertices])
    polygons = [list(p.vertices) for p in obj.data.polygons]
    poly_labels = face_labels(label_vertices(pts, polygon_normals(pts, polygons), bones, marks, joints), polygons)
    # Split into triangles, each keeping its polygon's label
    faces, labels = [], []
    for poly, lab in zip(polygons, poly_labels):
        for k in range(1, len(poly) - 1):
            faces.append((poly[0], poly[k], poly[k + 1]))
            labels.append(lab)
    faces, labels = np.array(faces, dtype=np.int64), np.array(labels, dtype=object)
    normals = vertex_normals(pts, faces)
    # Same frame as the male figure: same height, feet on the floor, torso centred where his is
    lo = pts.min(axis=0)
    scale = male_height / (pts[:, 2].max() - lo[2])
    pts = (pts - np.array([0.0, 0.0, lo[2]])) * scale
    band = (pts[:, 2] > 0.95) & (pts[:, 2] < 1.35)
    pts[:, 0] -= (pts[band, 0].min() + pts[band, 0].max()) / 2
    pts[:, 1] -= (pts[band, 1].min() + pts[band, 1].max()) / 2 - male_torso_y
    # Blender (Z up, front -Y) to glTF (Y up, front +Z)
    to_gltf = lambda a: np.stack([a[:, 0], a[:, 2], -a[:, 1]], axis=1)
    pts_g, nrm_g = to_gltf(pts), to_gltf(normals)
    meshes = []
    for name in sorted(set(labels)):
        fs = faces[labels == name]
        used, inverse = np.unique(fs.ravel(), return_inverse=True)
        meshes.append((name, pts_g[used], nrm_g[used], inverse.reshape(-1, 3)))
        print(f'{name:6s} {len(fs):6d} triangles')
    write_glb(meshes, OUT)
    print('height', round(float(pts[:, 2].max()), 3), 'm;', os.path.getsize(OUT) // 1024, 'KB ->', OUT)


main()
