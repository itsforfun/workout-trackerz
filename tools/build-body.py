#!/usr/bin/env python3
"""Build models/body.glb: Odyr's turning 3D body, from BodyParts3D (CC BY 4.0, DBCLS).

Source: the BodyParts3D 4.0 web pack published by the Somakine project (already Y-up metres, one node per
structure). This script merges every muscle into Odyr's muscle groups (MUSCLE_GROUPS ids in js/library.js),
merges the skeleton into one 'bone' mesh, simplifies each mesh, and writes one small GLB with one named
mesh per group ('g_ch', 'g_sh', ..., 'rest' for muscles outside the groups, 'bone').

Usage (needs numpy and fast-simplification, e.g. pip install --target <dir> fast-simplification):
    PYTHONPATH=<dir> python3 tools/build-body.py <folder with the source .glb files> [models/body.glb]

Source files (data-packs/bodyparts3d-musculoskeletal/public/assets/bodyparts3d/ in github.com/ivershuo/somakine):
region GLBs (bones) and supplement-*-muscle GLBs. Licence and attribution: licenses/BodyParts3D.txt.
"""
import json
import os
import re
import struct
import sys

import numpy as np
import fast_simplification

# Muscle name (as in the source node names) -> Odyr muscle group id
GROUPS = {
    'ch': ['pectoralis-major', 'pectoralis-minor'],
    'sh': ['deltoid', 'supraspinatus', 'subscapularis'],
    'bi': ['biceps-brachii'],
    'tr': ['triceps-brachii'],
    'fa': ['brachioradialis', 'extensor-carpi-radialis-brevis', 'extensor-carpi-radialis-longus', 'extensor-digitorum',
           'flexor-carpi-radialis', 'pronator-quadratus', 'extensor-carpi-ulnaris', 'finger-flexors', 'palmaris-longus', 'supinator'],
    'ob': ['external-oblique', 'serratus-anterior'],
    'tp': ['trapezius', 'levator-scapulae'],
    'ub': ['infraspinatus', 'teres-major', 'teres-minor', 'rhomboid-major'],
    'lb': ['erector-spinae'],
    'gl': ['gluteus-maximus', 'gluteus-medius', 'gluteus-minimus', 'piriformis'],
    'qd': ['quadriceps', 'sartorius'],
    'hm': ['biceps-femoris', 'semimembranosus', 'semitendinosus'],
    'ad': ['adductor-brevis', 'adductor-longus', 'adductor-magnus', 'gracilis'],
    'cf': ['gastrocnemius', 'soleus', 'tibialis-anterior', 'fibularis-brevis', 'fibularis-longus', 'plantaris',
           'extensor-digitorum-longus', 'flexor-digitorum-longus', 'tibialis-posterior', 'popliteus'],
}
MUSCLE_TO_GROUP = {m: g for g, ms in GROUPS.items() for m in ms}
OTHER_MUSCLES = {'sternocleidomastoid', 'iliacus', 'psoas-major', 'obturator-internus', 'flexor-digitorum-brevis'}

# Triangle budget per mesh (the skeleton is only a faint frame inside, so it gets the least detail per bone)
BUDGET = {'bone': 16000, 'rest': 2500}
DEFAULT_BUDGET = 4500

COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}


def read_glb(path):
    data = open(path, 'rb').read()
    json_len = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len + 8
    return gltf, data[bin_start:]


def accessor(gltf, binary, index):
    acc = gltf['accessors'][index]
    view = gltf['bufferViews'][acc['bufferView']]
    count = acc['count'] * COMPONENTS[acc['type']]
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    arr = np.frombuffer(binary, dtype=DTYPES[acc['componentType']], count=count, offset=offset)
    return arr.reshape(acc['count'], COMPONENTS[acc['type']]) if COMPONENTS[acc['type']] > 1 else arr


def node_matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if 'scale' in node:
        m = np.diag([*node['scale'], 1.0]) @ m
    if 'rotation' in node:
        x, y, z, w = node['rotation']
        r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        rm = np.eye(4)
        rm[:3, :3] = r
        m = rm @ m
    if 'translation' in node:
        t = np.eye(4)
        t[:3, 3] = node['translation']
        m = t @ m
    return m


def structure_name(name):
    """'supplement-knee-muscle:quadriceps:isa:FJ123' or 'knee:tibia' -> 'quadriceps' / 'tibia'."""
    parts = name.split(':')
    return parts[1] if len(parts) > 1 and parts[1] != 'isa' else None


def collect(folder):
    """Yields (bucket, label, vertices, faces) for every mesh in the source GLBs, in world space."""
    for file in sorted(os.listdir(folder)):
        if not file.endswith('.glb'):
            continue
        is_muscle = file.startswith('supplement-') and file.endswith('-muscle.glb') or '-muscle-' in file
        gltf, binary = read_glb(os.path.join(folder, file))
        nodes = gltf['nodes']

        def walk(i, parent, label):
            node = nodes[i]
            world = parent @ node_matrix(node)
            label = structure_name(node.get('name', '')) or label
            if 'mesh' in node and label:
                for prim in gltf['meshes'][node['mesh']]['primitives']:
                    if prim.get('mode', 4) != 4 or 'indices' not in prim:
                        continue
                    pos = accessor(gltf, binary, prim['attributes']['POSITION']).astype(np.float64)
                    pos = (np.c_[pos, np.ones(len(pos))] @ world.T)[:, :3]
                    faces = accessor(gltf, binary, prim['indices']).astype(np.int64).reshape(-1, 3)
                    if label in MUSCLE_TO_GROUP:
                        bucket = 'g_' + MUSCLE_TO_GROUP[label]
                    elif is_muscle or label in OTHER_MUSCLES or label == 'gluteus-medius':
                        bucket = 'rest'
                    else:
                        bucket = 'bone'
                    if label == 'gluteus-medius':
                        bucket = 'g_gl'
                    if label == 'tibialis-posterior':
                        bucket = 'g_cf'
                    yield bucket, label, pos, faces
            for child in node.get('children', []):
                yield from walk(child, world, label)

        roots = gltf['scenes'][gltf.get('scene', 0)]['nodes']
        for root in roots:
            yield from walk(root, np.eye(4), None)


# ── Abs and lats: BodyParts3D has no rectus abdominis or latissimus dorsi, so they are built here as thin
# shells laid on the torso surface (read from the surrounding bones and muscles), shaped by landmarks.
TORSO = re.compile(r'(-rib$|thoracic-vertebra|lumbar-vertebra|^sacrum$|^hip-bone$|^external-oblique$|^erector-spinae$|'
                   r'^serratus-anterior$|^pectoralis-m|^scapula$|^teres-ma|^teres-mi|^infraspinatus$|^rhomboid-major$|'
                   r'^trapezius$|^gluteus-medius$)')


class TorsoSurface:
    """Radius of the torso around a vertical axis, per height and angle (0 = front, +x side = positive angle)."""

    def __init__(self, points, y0=0.84, y1=1.46, dy=0.01, bins=120):
        self.y0, self.dy, self.bins = y0, dy, bins
        rows = int(round((y1 - y0) / dy)) + 1
        pts = points[(points[:, 1] >= y0 - dy) & (points[:, 1] <= y1 + dy)]
        iy = np.clip(np.round((pts[:, 1] - y0) / dy).astype(int), 0, rows - 1)
        self.zc = np.zeros(rows)
        for r in range(rows):
            z = pts[iy == r][:, 2]
            self.zc[r] = (z.min() + z.max()) / 2 if len(z) else 0
        self.zc = np.convolve(np.pad(self.zc, 3, mode='edge'), np.ones(7) / 7, mode='valid')
        dz = pts[:, 2] - self.zc[iy]
        phi = np.arctan2(pts[:, 0], dz)
        ib = np.round((phi + np.pi) / (2 * np.pi) * bins).astype(int) % bins
        dist = np.hypot(pts[:, 0], dz)
        grid = np.full((rows, bins), np.nan)
        np.fmax.at(grid, (iy, ib), dist)
        for r in range(rows):   # fill empty angles (the hollow front of the belly) around the circle
            row = grid[r]
            ok = ~np.isnan(row)
            if ok.sum() >= 2:
                idx = np.arange(bins)
                grid[r] = np.interp(idx, idx[ok], row[ok], period=bins)
        # Ride on the highest point nearby (so shells never sink under a muscle), then soften lightly
        peak = grid.copy()
        for db in (-2, -1, 1, 2):
            peak = np.fmax(peak, np.roll(grid, db, axis=1))
        padded = np.pad(peak, ((2, 2), (0, 0)), mode='edge')
        grid = np.max([padded[k:k + len(peak)] for k in range(5)], axis=0)
        k = np.ones(5) / 5
        grid = np.apply_along_axis(lambda c: np.convolve(np.pad(c, 2, mode='wrap'), k, mode='valid'), 1, grid)
        grid = np.apply_along_axis(lambda c: np.convolve(np.pad(c, 1, mode='edge'), np.ones(3) / 3, mode='valid'), 0, grid)
        self.grid = grid

    def radius(self, y, phi):
        p = self.point(y, phi, 0)
        fy = np.clip((y - self.y0) / self.dy, 0, len(self.zc) - 1.001)
        zc = np.interp(fy, np.arange(len(self.zc)), self.zc)
        return float(np.hypot(p[0], p[2] - zc))

    def point(self, y, phi, offset):
        fy = np.clip((y - self.y0) / self.dy, 0, len(self.zc) - 1.001)
        fb = ((phi + np.pi) / (2 * np.pi) * self.bins) % self.bins
        r0, b0 = int(fy), int(fb)
        ty, tb = fy - r0, fb - b0
        b1 = (b0 + 1) % self.bins
        g = self.grid
        rad = (g[r0, b0] * (1 - tb) + g[r0, b1] * tb) * (1 - ty) + (g[r0 + 1, b0] * (1 - tb) + g[r0 + 1, b1] * tb) * ty
        zc = self.zc[r0] * (1 - ty) + self.zc[r0 + 1] * ty
        rad += offset
        return np.array([rad * np.sin(phi), y, zc + rad * np.cos(phi)])


def slab(top, bottom):
    """Closed shell from two (nu, nv, 3) grids of points: outer surface, inner surface and the rim."""
    nu, nv, _ = top.shape
    verts = np.vstack([top.reshape(-1, 3), bottom.reshape(-1, 3)])
    n = nu * nv
    idx = lambda u, v, layer=0: layer * n + u * nv + v
    faces = []
    for u in range(nu - 1):
        for v in range(nv - 1):
            a, b, c, d = idx(u, v), idx(u + 1, v), idx(u + 1, v + 1), idx(u, v + 1)
            faces += [(a, b, c), (a, c, d)]
            a, b, c, d = idx(u, v, 1), idx(u + 1, v, 1), idx(u + 1, v + 1, 1), idx(u, v + 1, 1)
            faces += [(a, c, b), (a, d, c)]
    rim = [(u, 0) for u in range(nu)] + [(nu - 1, v) for v in range(1, nv)] + \
          [(u, nv - 1) for u in range(nu - 2, -1, -1)] + [(0, v) for v in range(nv - 2, 0, -1)]
    for i in range(len(rim)):
        (u0, v0), (u1, v1) = rim[i], rim[(i + 1) % len(rim)]
        a, b, c, d = idx(u0, v0), idx(u1, v1), idx(u1, v1, 1), idx(u0, v0, 1)
        faces += [(a, c, b), (a, d, c)]
    faces = np.array(faces, dtype=np.int64)
    # Point the outer surface outwards (away from the body's vertical axis)
    centre = np.array([0, top[..., 1].mean(), bottom[..., 2].mean()])
    tri = verts[faces[: 2 * (nu - 1) * (nv - 1): 2]]
    normal = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]).sum(axis=0)
    outward = (tri.mean(axis=(0, 1)) - centre) * np.array([1, 0, 1])
    if np.dot(normal, outward) < 0:
        faces = faces[:, [0, 2, 1]]
    return verts, faces


def smooth(t, a, b):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def build_abs(surface, pubis_y, top_y):
    """Rectus abdominis: two segmented columns either side of the midline, from the pubis to the lower ribs."""
    nu, nv = 48, 12
    intersections = [pubis_y + (top_y - pubis_y) * k for k in (0.52, 0.72, 0.88)]   # navel and two above
    parts = []
    for side in (1, -1):
        top, bottom = np.zeros((nu, nv, 3)), np.zeros((nu, nv, 3))
        for i in range(nu):
            u = i / (nu - 1)
            y = pubis_y + 0.01 + u * (top_y - pubis_y - 0.01)
            half = 0.03 + 0.045 * smooth(u, 0.0, 0.55)          # narrow at the pubis, ~7.5 cm wide above
            seg = 1 - sum(0.65 * np.exp(-((y - yi) / 0.008) ** 2) for yi in intersections)
            for j in range(nv):
                v = j / (nv - 1)
                x = 0.006 + v * half
                bump = np.sin(np.pi * (0.08 + 0.84 * v)) ** 0.6
                phi = side * x / max(0.06, surface.radius(y, 0.0))
                out = 0.003 + 0.011 * bump * seg * (0.75 + 0.25 * smooth(u, 0.1, 0.5))
                top[i, j] = surface.point(y, phi, out)
                bottom[i, j] = surface.point(y, phi, -0.004)
        parts.append(slab(top, bottom))
    return merge(parts)


def build_lats(surface, low_y, t7_y, axilla_y, insertion):
    """Latissimus dorsi: a fan from the spine (T7 to the sacrum) and the iliac crest up into the armpit."""
    nu, nv = 40, 22
    parts = []
    for side in (1, -1):
        A = (np.pi - 0.03, low_y)           # medial, bottom (lumbar spine)
        D = (np.pi - 0.03, t7_y - 0.03)     # medial, top (T7, below the scapula's lower tip)
        B = (2.45, low_y + 0.03)            # lateral, bottom (back of the iliac crest)
        C = (1.5, axilla_y + 0.015)         # lateral, top (the armpit)
        H = insertion * np.array([side, 1, 1])
        top, bottom = np.zeros((nu, nv, 3)), np.zeros((nu, nv, 3))
        for i in range(nu):
            u = i / (nu - 1)
            for j in range(nv):
                v = j / (nv - 1)
                phi = (A[0] + (B[0] - A[0]) * v) * (1 - u) + (D[0] + (C[0] - D[0]) * v) * u
                y = (A[1] + (B[1] - A[1]) * v) * (1 - u) + (D[1] + (C[1] - D[1]) * v) * u
                ridges = 0.0014 * np.sin(2 * np.pi * v * 9) * smooth(u, 0.05, 0.3)   # fibres running to the armpit
                out = 0.003 + 0.010 * v ** 0.8 * (1 - 0.4 * u) + 0.005 * np.sin(np.pi * v) + ridges
                p_top = surface.point(y, side * phi, out)
                p_bot = surface.point(y, side * phi, -0.003)
                t = smooth(u, 0.5, 1.0) * smooth(v, 0.4, 1.0)    # the upper outer corner fans into the arm
                top[i, j] = p_top * (1 - t) + (H + np.array([0, 0.004, 0])) * t
                bottom[i, j] = p_bot * (1 - t) + (H - np.array([0, 0.004, 0])) * t
        parts.append(slab(top, bottom))
    return merge(parts)


def merge(parts):
    verts, faces, base = [], [], 0
    for v, f in parts:
        verts.append(v)
        faces.append(f + base)
        base += len(v)
    return np.vstack(verts), np.vstack(faces)


def write_glb(meshes, out):
    """meshes: list of (name, vertices float32 Nx3, faces uint32 Mx3)."""
    binary = bytearray()
    gltf = {'asset': {'version': '2.0', 'generator': 'Odyr tools/build-body.py',
                      'copyright': 'BodyParts3D, (c) The Database Center for Life Science, CC BY 4.0'},
            'scene': 0, 'scenes': [{'nodes': list(range(len(meshes)))}],
            'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': []}

    def add_view(data, target):
        while len(binary) % 4:
            binary.append(0)
        gltf['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data), 'target': target})
        binary.extend(data)
        return len(gltf['bufferViews']) - 1

    for i, (name, v, f) in enumerate(meshes):
        idx_type, idx_np = (5123, np.uint16) if len(v) < 65536 else (5125, np.uint32)
        pv = add_view(v.astype(np.float32).tobytes(), 34962)
        iv = add_view(f.astype(idx_np).ravel().tobytes(), 34963)
        gltf['accessors'].append({'bufferView': pv, 'componentType': 5126, 'count': len(v), 'type': 'VEC3',
                                  'min': v.min(axis=0).tolist(), 'max': v.max(axis=0).tolist()})
        gltf['accessors'].append({'bufferView': iv, 'componentType': idx_type, 'count': f.size, 'type': 'SCALAR'})
        gltf['meshes'].append({'name': name, 'primitives': [{'attributes': {'POSITION': 2 * i}, 'indices': 2 * i + 1}]})
        gltf['nodes'].append({'name': name, 'mesh': i})
    gltf['buffers'] = [{'byteLength': len(binary)}]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    while len(binary) % 4:
        binary.append(0)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(out, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, total))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        fh.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


def main():
    folder = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'models', 'body.glb')
    buckets = {}
    labelled = {}
    for bucket, label, v, f in collect(folder):
        buckets.setdefault(bucket, []).append((v, f))
        labelled.setdefault(label, []).append(v)

    # Centre the body on the origin, feet on y = 0
    allv = np.vstack([v for parts in buckets.values() for v, _ in parts])
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])

    meshes = []
    for name in sorted(buckets):
        v, f = merge(buckets[name])
        v = v + shift
        keep = min(1.0, BUDGET.get(name, DEFAULT_BUDGET) / len(f))
        if keep < 0.98:
            v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=1 - keep)
        else:
            v2, f2 = v.astype(np.float32), f.astype(np.int32)
        meshes.append((name, np.asarray(v2, dtype=np.float32), np.asarray(f2, dtype=np.uint32)))
        print(f'{name:6s} {len(f):7d} -> {len(f2):6d} triangles')
    # Abs and lats, fitted to the torso (see build_abs / build_lats)
    def pts(*names):
        return np.vstack([v for n in names for v in labelled[n]]) + shift
    torso = np.vstack([v for n, vs in labelled.items() if n and TORSO.search(n) for v in vs]) + shift
    surface = TorsoSurface(torso)
    hip = pts('hip-bone')
    pubis_y = float(hip[np.abs(hip[:, 0]) < 0.02][:, 1].max())
    top_y = float(pts('ninth-thoracic-vertebra')[:, 1].mean()) - 0.01
    low_y = float(pts('fifth-lumbar-vertebra')[:, 1].mean())
    t7_y = float(pts('seventh-thoracic-vertebra')[:, 1].mean())
    teres = pts('teres-major')
    axilla_y = float(teres[:, 1].mean()) - 0.005
    humerus = pts('humerus')
    shaft = humerus[(humerus[:, 0] > 0) & (np.abs(humerus[:, 1] - (axilla_y + 0.01)) < 0.012)]
    insertion = np.array([shaft[:, 0].min() + 0.005, axilla_y + 0.01, shaft[:, 2].mean() + 0.006])
    extra = {'g_ab': build_abs(surface, pubis_y, top_y), 'g_ub': build_lats(surface, low_y, t7_y, axilla_y, insertion)}
    print('abs from', round(pubis_y, 3), 'to', round(top_y, 3), '· lats', round(low_y, 3), round(t7_y, 3), round(axilla_y, 3), insertion.round(3))
    for name, (v, f) in extra.items():
        found = [k for k, m in enumerate(meshes) if m[0] == name]
        if found:
            k = found[0]
            _, v0, f0 = meshes[k]
            v, f = merge([(v0.astype(np.float64), f0.astype(np.int64)), (v, f)])
            meshes[k] = (name, v.astype(np.float32), f.astype(np.uint32))
        else:
            meshes.append((name, v.astype(np.float32), f.astype(np.uint32)))
        print(f'{name:6s} + fitted shape -> {len(meshes[found[0] if found else -1][2])} triangles')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    write_glb(meshes, out)
    print('height', round(float(hi[1] - lo[1]), 3), 'm;', os.path.getsize(out) // 1024, 'KB ->', out)


if __name__ == '__main__':
    main()
