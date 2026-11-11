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
    """Yields (bucket, vertices, faces) for every mesh in the source GLBs, in world space."""
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
                    yield bucket, pos, faces
            for child in node.get('children', []):
                yield from walk(child, world, label)

        roots = gltf['scenes'][gltf.get('scene', 0)]['nodes']
        for root in roots:
            yield from walk(root, np.eye(4), None)


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
    for bucket, v, f in collect(folder):
        buckets.setdefault(bucket, []).append((v, f))

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
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    write_glb(meshes, out)
    print('height', round(float(hi[1] - lo[1]), 3), 'm;', os.path.getsize(out) // 1024, 'KB ->', out)


if __name__ == '__main__':
    main()
