#!/usr/bin/env python3
"""Deterministic GLB enhancer for CHATGPT V3 / FAZ 3.

Preserves scene/node/animation topology, embeds vertex normals for every triangle
primitive, and adds a thin reversed-winding inner surface for Shell_01..Shell_14.
No external DCC or network dependency is required.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import pathlib
import struct
from dataclasses import dataclass
from typing import Any

import numpy as np

GLB_MAGIC = b"glTF"
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
ARRAY_BUFFER = 34962
ELEMENT_ARRAY_BUFFER = 34963
FLOAT = 5126
UNSIGNED_INT = 5125

COMPONENT_DTYPES = {
    5120: np.int8,
    5121: np.uint8,
    5122: np.int16,
    5123: np.uint16,
    5125: np.uint32,
    5126: np.float32,
}
TYPE_COMPONENTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


@dataclass
class Glb:
    doc: dict[str, Any]
    binary: bytearray


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_glb(path: pathlib.Path) -> Glb:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path}: file too small")
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION or total != len(data):
        raise ValueError(f"{path}: invalid GLB header")
    offset = 12
    json_len, json_type = struct.unpack_from("<II", data, offset)
    offset += 8
    if json_type != JSON_CHUNK:
        raise ValueError(f"{path}: first chunk is not JSON")
    doc = json.loads(data[offset : offset + json_len].decode("utf-8"))
    offset += json_len
    binary = bytearray()
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == BIN_CHUNK:
            if binary:
                raise ValueError(f"{path}: multiple BIN chunks unsupported")
            binary = bytearray(chunk)
    if not binary:
        raise ValueError(f"{path}: missing BIN chunk")
    return Glb(doc=doc, binary=binary)


def write_glb(glb: Glb, path: pathlib.Path) -> None:
    glb.doc.setdefault("buffers", [{"byteLength": len(glb.binary)}])
    glb.doc["buffers"][0]["byteLength"] = len(glb.binary)
    raw_json = json.dumps(glb.doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    raw_json += b" " * ((4 - len(raw_json) % 4) % 4)
    raw_bin = bytes(glb.binary)
    raw_bin += b"\x00" * ((4 - len(raw_bin) % 4) % 4)
    total = 12 + 8 + len(raw_json) + 8 + len(raw_bin)
    out = bytearray(struct.pack("<4sII", GLB_MAGIC, GLB_VERSION, total))
    out.extend(struct.pack("<II", len(raw_json), JSON_CHUNK))
    out.extend(raw_json)
    out.extend(struct.pack("<II", len(raw_bin), BIN_CHUNK))
    out.extend(raw_bin)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)


def read_accessor(glb: Glb, accessor_index: int) -> np.ndarray:
    accessor = glb.doc["accessors"][accessor_index]
    if "sparse" in accessor:
        raise ValueError("Sparse accessors are not supported by the FAZ 3 pipeline")
    view = glb.doc["bufferViews"][accessor["bufferView"]]
    dtype = np.dtype(COMPONENT_DTYPES[accessor["componentType"]]).newbyteorder("<")
    components = TYPE_COMPONENTS[accessor["type"]]
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    stride = int(view.get("byteStride", dtype.itemsize * components))
    count = int(accessor["count"])
    if stride == dtype.itemsize * components:
        arr = np.frombuffer(glb.binary, dtype=dtype, count=count * components, offset=offset)
        return arr.reshape(count, components).copy()
    return np.ndarray(
        (count, components),
        dtype=dtype,
        buffer=glb.binary,
        offset=offset,
        strides=(stride, dtype.itemsize),
    ).copy()


def append_raw(glb: Glb, raw: bytes, target: int | None = None) -> int:
    pad = (4 - len(glb.binary) % 4) % 4
    if pad:
        glb.binary.extend(b"\x00" * pad)
    offset = len(glb.binary)
    glb.binary.extend(raw)
    view: dict[str, Any] = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw)}
    if target is not None:
        view["target"] = target
    glb.doc.setdefault("bufferViews", []).append(view)
    return len(glb.doc["bufferViews"]) - 1


def append_accessor(
    glb: Glb,
    arr: np.ndarray,
    component_type: int,
    accessor_type: str,
    target: int | None,
    *,
    include_minmax: bool = False,
) -> int:
    expected = TYPE_COMPONENTS[accessor_type]
    if arr.ndim == 1:
        arr = arr.reshape(-1, 1)
    if arr.shape[1] != expected:
        raise ValueError(f"Accessor {accessor_type} expects {expected} components, got {arr.shape}")
    dtype = np.dtype(COMPONENT_DTYPES[component_type]).newbyteorder("<")
    packed = np.ascontiguousarray(arr, dtype=dtype)
    view_index = append_raw(glb, packed.tobytes(order="C"), target)
    accessor: dict[str, Any] = {
        "bufferView": view_index,
        "byteOffset": 0,
        "componentType": component_type,
        "count": int(len(packed)),
        "type": accessor_type,
    }
    if include_minmax:
        accessor["min"] = [float(x) for x in packed.min(axis=0)]
        accessor["max"] = [float(x) for x in packed.max(axis=0)]
    glb.doc.setdefault("accessors", []).append(accessor)
    return len(glb.doc["accessors"]) - 1


def vertex_normals(positions: np.ndarray, indices: np.ndarray) -> np.ndarray:
    triangles = indices.reshape(-1, 3).astype(np.int64)
    a = positions[triangles[:, 0]].astype(np.float64)
    b = positions[triangles[:, 1]].astype(np.float64)
    c = positions[triangles[:, 2]].astype(np.float64)
    face = np.cross(b - a, c - a)
    normals = np.zeros((len(positions), 3), dtype=np.float64)
    np.add.at(normals, triangles[:, 0], face)
    np.add.at(normals, triangles[:, 1], face)
    np.add.at(normals, triangles[:, 2], face)
    lengths = np.linalg.norm(normals, axis=1)
    bad = lengths < 1e-12
    if np.any(bad):
        fallback = positions[bad].astype(np.float64)
        fallback_len = np.linalg.norm(fallback, axis=1)
        fallback_len[fallback_len < 1e-12] = 1.0
        normals[bad] = fallback / fallback_len[:, None]
        lengths = np.linalg.norm(normals, axis=1)
    normals /= np.maximum(lengths[:, None], 1e-12)
    return normals.astype(np.float32)


def mesh_signed_volume(positions: np.ndarray, indices: np.ndarray) -> float:
    tri = indices.reshape(-1, 3).astype(np.int64)
    v0, v1, v2 = positions[tri[:, 0]], positions[tri[:, 1]], positions[tri[:, 2]]
    return float(np.einsum("ij,ij->i", v0, np.cross(v1, v2)).sum() / 6.0)


def boundary_edge_count(indices: np.ndarray) -> int:
    tri = indices.reshape(-1, 3).astype(np.int64)
    counts: dict[tuple[int, int], int] = {}
    for face in tri:
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            key = (int(min(a, b)), int(max(a, b)))
            counts[key] = counts.get(key, 0) + 1
    return sum(1 for count in counts.values() if count == 1)


def find_node(doc: dict[str, Any], name: str) -> int:
    for i, node in enumerate(doc.get("nodes", [])):
        if node.get("name") == name:
            return i
    raise KeyError(name)


def find_material(doc: dict[str, Any], name: str) -> int:
    for i, mat in enumerate(doc.get("materials", [])):
        if mat.get("name") == name:
            return i
    raise KeyError(name)


def enhance(source: pathlib.Path, output: pathlib.Path, profile: str, thickness: float) -> dict[str, Any]:
    source_bytes = source.read_bytes()
    source_hash = sha256_bytes(source_bytes)
    glb = read_glb(source)
    doc = glb.doc

    # Keep explicit original counts for audit.
    original_counts = {
        "nodes": len(doc.get("nodes", [])),
        "meshes": len(doc.get("meshes", [])),
        "accessors": len(doc.get("accessors", [])),
        "bufferViews": len(doc.get("bufferViews", [])),
    }

    normal_cache: dict[tuple[int, int], tuple[int, np.ndarray]] = {}
    primitives_with_normals = 0
    for mesh in doc.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4 or "indices" not in primitive:
                continue
            pos_acc = primitive["attributes"]["POSITION"]
            idx_acc = primitive["indices"]
            key = (pos_acc, idx_acc)
            if key not in normal_cache:
                positions = read_accessor(glb, pos_acc).astype(np.float32)
                indices = read_accessor(glb, idx_acc).reshape(-1).astype(np.uint32)
                normals = vertex_normals(positions, indices)
                normal_acc = append_accessor(glb, normals, FLOAT, "VEC3", ARRAY_BUFFER)
                normal_cache[key] = (normal_acc, normals)
            primitive.setdefault("attributes", {})["NORMAL"] = normal_cache[key][0]
            primitives_with_normals += 1

    inner_material = find_material(doc, "MAT_Shell_Inner")
    shell_records: list[dict[str, Any]] = []
    for shell_number in range(1, 15):
        root_name = f"Shell_{shell_number:02d}"
        geo_name = f"{root_name}_GEO"
        root_index = find_node(doc, root_name)
        geo_index = find_node(doc, geo_name)
        geo_node = doc["nodes"][geo_index]
        mesh_index = int(geo_node["mesh"])
        source_mesh = doc["meshes"][mesh_index]
        if len(source_mesh.get("primitives", [])) != 1:
            raise ValueError(f"{geo_name}: expected exactly one primitive")
        primitive = source_mesh["primitives"][0]
        if primitive.get("mode", 4) != 4 or "indices" not in primitive:
            raise ValueError(f"{geo_name}: shell primitive is not indexed triangles")
        pos_acc = primitive["attributes"]["POSITION"]
        idx_acc = primitive["indices"]
        positions = read_accessor(glb, pos_acc).astype(np.float32)
        indices = read_accessor(glb, idx_acc).reshape(-1).astype(np.uint32)
        normal_acc, normals = normal_cache[(pos_acc, idx_acc)]
        signed_volume = mesh_signed_volume(positions, indices)
        boundary_edges = boundary_edge_count(indices)
        if signed_volume <= 0:
            raise ValueError(f"{geo_name}: non-positive signed volume {signed_volume}")
        if boundary_edges != 0:
            raise ValueError(f"{geo_name}: open topology ({boundary_edges} boundary edges)")

        inner_positions = positions - normals * np.float32(thickness)
        inner_normals = -normals
        tri = indices.reshape(-1, 3)
        inner_indices = tri[:, [0, 2, 1]].reshape(-1).astype(np.uint32)
        inner_pos_acc = append_accessor(glb, inner_positions, FLOAT, "VEC3", ARRAY_BUFFER, include_minmax=True)
        inner_norm_acc = append_accessor(glb, inner_normals, FLOAT, "VEC3", ARRAY_BUFFER)
        inner_idx_acc = append_accessor(
            glb,
            inner_indices.reshape(-1, 1),
            UNSIGNED_INT,
            "SCALAR",
            ELEMENT_ARRAY_BUFFER,
            include_minmax=True,
        )
        inner_mesh = {
            "name": f"{root_name}_Inner_GEO",
            "primitives": [
                {
                    "attributes": {"POSITION": inner_pos_acc, "NORMAL": inner_norm_acc},
                    "indices": inner_idx_acc,
                    "material": inner_material,
                    "mode": 4,
                    "extras": {
                        "role": "shell-inner-surface",
                        "sourceMesh": source_mesh.get("name", geo_name),
                        "thickness": thickness,
                    },
                }
            ],
            "extras": {"generatedBy": "CHATGPT_V3_FAZ3", "stableShellId": f"shell-{shell_number:02d}"},
        }
        doc.setdefault("meshes", []).append(inner_mesh)
        inner_mesh_index = len(doc["meshes"]) - 1
        inner_node: dict[str, Any] = {
            "name": f"{root_name}_Inner_GEO",
            "mesh": inner_mesh_index,
            "extras": {
                "generatedBy": "CHATGPT_V3_FAZ3",
                "stableShellId": f"shell-{shell_number:02d}",
                "inheritsAnimationFrom": root_name,
            },
        }
        for transform_key in ("translation", "rotation", "scale", "matrix"):
            if transform_key in geo_node:
                inner_node[transform_key] = copy.deepcopy(geo_node[transform_key])
        doc.setdefault("nodes", []).append(inner_node)
        inner_node_index = len(doc["nodes"]) - 1
        doc["nodes"][root_index].setdefault("children", []).append(inner_node_index)
        root_extras = doc["nodes"][root_index].setdefault("extras", {})
        root_extras.update(
            {
                "stableShellId": f"shell-{shell_number:02d}",
                "pivotPolicy": "preserve-source-node-origin",
                "innerSurfaceNode": inner_node_index,
            }
        )
        shell_records.append(
            {
                "shell": root_name,
                "sourceMeshIndex": mesh_index,
                "innerMeshIndex": inner_mesh_index,
                "innerNodeIndex": inner_node_index,
                "vertices": int(len(positions)),
                "triangles": int(len(indices) // 3),
                "boundaryEdges": boundary_edges,
                "signedVolume": signed_volume,
                "thickness": thickness,
            }
        )

    asset = doc.setdefault("asset", {"version": "2.0"})
    generator = asset.get("generator", "")
    tag = "CHATGPT V3 FAZ3 GLB Pipeline"
    asset["generator"] = f"{generator} | {tag}" if generator else tag
    extras = asset.setdefault("extras", {})
    extras["chatgptV3"] = {
        "phase": 3,
        "profile": profile,
        "sourceFile": source.name,
        "sourceSha256": source_hash,
        "normalPolicy": "area-weighted embedded vertex normals",
        "innerSurfacePolicy": "reversed-winding normal-offset shell layer",
        "innerSurfaceThickness": thickness,
        "uvPolicy": "not generated because current GLB has no textures; procedural/material phase remains UV-independent",
        "tangentPolicy": "not generated because there is no tangent-space normal map in FAZ3",
        "pivotPolicy": "source transforms preserved; stable shell IDs added",
    }

    write_glb(glb, output)
    out_bytes = output.read_bytes()
    return {
        "profile": profile,
        "source": str(source),
        "output": str(output),
        "sourceBytes": len(source_bytes),
        "outputBytes": len(out_bytes),
        "sourceSha256": source_hash,
        "outputSha256": sha256_bytes(out_bytes),
        "primitivesWithEmbeddedNormals": primitives_with_normals,
        "normalAccessorReuseCount": len(normal_cache),
        "addedInnerShells": len(shell_records),
        "shells": shell_records,
        "originalCounts": original_counts,
        "enhancedCounts": {
            "nodes": len(doc.get("nodes", [])),
            "meshes": len(doc.get("meshes", [])),
            "accessors": len(doc.get("accessors", [])),
            "bufferViews": len(doc.get("bufferViews", [])),
        },
        "animations": [a.get("name") for a in doc.get("animations", [])],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--thickness", type=float, default=0.016)
    args = parser.parse_args()
    if not (0.002 <= args.thickness <= 0.05):
        raise SystemExit("--thickness must be between 0.002 and 0.05 scene units")
    root = pathlib.Path(args.root).resolve()
    jobs = [
        (
            "desktop",
            root / "public/models/orb_faz8_web_desktop.glb",
            root / "public/models/orb_v3_faz3_desktop.glb",
        ),
        (
            "mobile",
            root / "public/models/orb_faz8_web_mobile.glb",
            root / "public/models/orb_v3_faz3_mobile.glb",
        ),
    ]
    reports = [enhance(src, dst, profile, args.thickness) for profile, src, dst in jobs]
    manifest = {
        "schema": 1,
        "phase": 3,
        "pipeline": "tools/glb_v3_pipeline.py",
        "innerSurfaceThickness": args.thickness,
        "models": reports,
    }
    manifest_path = root / "public/models/orb_v3_faz3_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
