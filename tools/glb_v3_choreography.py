#!/usr/bin/env python3
"""Bake deterministic shell breakup choreography into V3 FAZ 5 GLBs.

Only Shell_01..Shell_14 translation/rotation channels in Orb_Main_Cinematic are
re-authored. All non-shell animation channels, geometry, materials and textures
remain byte-identical to FAZ 4 inputs. The resulting animation is sampled at a
fixed 60 Hz so LINEAR glTF interpolation follows the authored curved path closely.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import pathlib
from typing import Any

import numpy as np

from glb_v3_pipeline import (
    FLOAT,
    Glb,
    append_accessor,
    read_accessor,
    read_glb,
    write_glb,
)


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def smoothstep01(v: float) -> float:
    x = clamp01(v)
    return x * x * (3.0 - 2.0 * x)


def smootherstep01(v: float) -> float:
    x = clamp01(v)
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)


def normalize(v: np.ndarray, fallback: np.ndarray | None = None) -> np.ndarray:
    n = float(np.linalg.norm(v))
    if n < 1e-12:
        if fallback is None:
            fallback = np.array([1.0, 0.0, 0.0], dtype=np.float64)
        return normalize(fallback)
    return v / n


def quat_normalize(q: np.ndarray) -> np.ndarray:
    return normalize(q, np.array([0.0, 0.0, 0.0, 1.0], dtype=np.float64))


def quat_axis_angle(axis: np.ndarray, angle_radians: float) -> np.ndarray:
    axis = normalize(axis)
    half = 0.5 * angle_radians
    s = math.sin(half)
    return quat_normalize(np.array([axis[0] * s, axis[1] * s, axis[2] * s, math.cos(half)], dtype=np.float64))


def quat_mul(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return quat_normalize(np.array([
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ], dtype=np.float64))


def quat_slerp(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    q0 = quat_normalize(a.astype(np.float64))
    q1 = quat_normalize(b.astype(np.float64))
    dot = float(np.dot(q0, q1))
    if dot < 0.0:
        q1 = -q1
        dot = -dot
    dot = max(-1.0, min(1.0, dot))
    if dot > 0.9995:
        return quat_normalize(q0 + (q1 - q0) * t)
    theta = math.acos(dot)
    sin_theta = math.sin(theta)
    if abs(sin_theta) < 1e-9:
        return q0
    return quat_normalize(
        q0 * (math.sin((1.0 - t) * theta) / sin_theta)
        + q1 * (math.sin(t * theta) / sin_theta)
    )


def sample_track(times: np.ndarray, values: np.ndarray, time_value: float, path: str) -> np.ndarray:
    t = float(time_value)
    if t <= float(times[0]):
        return values[0].astype(np.float64)
    if t >= float(times[-1]):
        return values[-1].astype(np.float64)
    index = int(np.searchsorted(times, t, side="right") - 1)
    index = max(0, min(index, len(times) - 2))
    span = float(times[index + 1] - times[index])
    u = 0.0 if span <= 1e-12 else (t - float(times[index])) / span
    if path == "rotation":
        return quat_slerp(values[index], values[index + 1], u)
    return values[index].astype(np.float64) * (1.0 - u) + values[index + 1].astype(np.float64) * u


def shell_basis(base: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    radial = normalize(base)
    up = np.array([0.0, 1.0, 0.0], dtype=np.float64)
    tangent = np.cross(up, radial)
    if np.linalg.norm(tangent) < 1e-8:
        tangent = np.cross(np.array([1.0, 0.0, 0.0], dtype=np.float64), radial)
    tangent = normalize(tangent)
    return radial, tangent, up


def mass_exponent(mass_class: str) -> float:
    if mass_class == "heavy":
        return 1.13
    if mass_class == "light":
        return 0.91
    return 1.0


def build_shell_pose(
    cfg: dict[str, Any],
    shell_cfg: dict[str, Any],
    base_translation: np.ndarray,
    base_rotation: np.ndarray,
    source_translation: tuple[np.ndarray, np.ndarray],
    source_rotation: tuple[np.ndarray, np.ndarray],
    time_value: float,
) -> tuple[np.ndarray, np.ndarray]:
    t = float(time_value)
    radial, tangent, up = shell_basis(base_translation)
    spin = float(shell_cfg["spinSign"])
    group_start = float(cfg["groups"][shell_cfg["group"]]["start"])
    start = group_start + float(shell_cfg.get("delay", 0.0))
    awakening_start = float(cfg["awakeningStart"])
    breakup_start = float(cfg["breakupStart"])
    open_time = float(cfg["openPoseTime"])
    hold_end = float(cfg["openHoldEnd"])
    recall_end = float(cfg["fallbackRecallEnd"])
    tension_distance = float(cfg["tensionDistance"])
    tension_angle = math.radians(float(cfg["tensionAngleDegrees"])) * spin

    tension_axis = normalize(tangent * spin + up * 0.18)
    q_tension = quat_mul(base_rotation, quat_axis_angle(tension_axis, tension_angle))
    tension_position = base_translation + radial * tension_distance

    final_position = (
        base_translation
        + radial * float(shell_cfg["radialDistance"])
        + tangent * float(shell_cfg["tangentDistance"])
        + up * float(shell_cfg["axialDistance"])
    )
    final_axis = normalize(tangent * (0.72 * spin) + up * 0.42 + radial * 0.22)
    final_rotation = quat_mul(
        base_rotation,
        quat_axis_angle(final_axis, math.radians(float(shell_cfg["rotationDegrees"]))),
    )

    if t <= awakening_start:
        return base_translation.copy(), base_rotation.copy()

    if t < start:
        denom = max(1e-6, breakup_start - awakening_start)
        tension_u = smoothstep01((min(t, breakup_start) - awakening_start) / denom)
        pulse = math.sin(math.pi * clamp01((t - awakening_start) / max(1e-6, start - awakening_start)))
        pos = base_translation + radial * tension_distance * tension_u + tangent * (0.006 * spin * pulse)
        rot = quat_slerp(base_rotation, q_tension, tension_u)
        return pos, rot

    if t <= open_time:
        raw = clamp01((t - start) / max(1e-6, open_time - start))
        shaped = smootherstep01(raw ** mass_exponent(str(shell_cfg["massClass"])))
        pos = tension_position * (1.0 - shaped) + final_position * shaped
        arc = math.sin(math.pi * raw)
        pos = pos + up * (float(shell_cfg["arcLift"]) * arc) + tangent * (float(shell_cfg["orbitArc"]) * arc)
        rot = quat_slerp(q_tension, final_rotation, shaped)
        transient = quat_axis_angle(radial, math.radians(8.0) * spin * arc)
        rot = quat_mul(transient, rot)
        return pos, rot

    if t <= hold_end:
        return final_position.copy(), final_rotation.copy()

    if t < recall_end:
        u = smootherstep01((t - hold_end) / max(1e-6, recall_end - hold_end))
        src_pos = sample_track(*source_translation, t, "translation")
        src_rot = sample_track(*source_rotation, t, "rotation")
        return final_position * (1.0 - u) + src_pos * u, quat_slerp(final_rotation, src_rot, u)

    return (
        sample_track(*source_translation, t, "translation"),
        sample_track(*source_rotation, t, "rotation"),
    )


def find_animation(doc: dict[str, Any], name: str) -> dict[str, Any]:
    for anim in doc.get("animations", []):
        if anim.get("name") == name:
            return anim
    raise KeyError(name)


def find_node_index(doc: dict[str, Any], name: str) -> int:
    for index, node in enumerate(doc.get("nodes", [])):
        if node.get("name") == name:
            return index
    raise KeyError(name)


def channel_map(anim: dict[str, Any]) -> dict[tuple[int, str], tuple[int, dict[str, Any]]]:
    result: dict[tuple[int, str], tuple[int, dict[str, Any]]] = {}
    for index, channel in enumerate(anim.get("channels", [])):
        result[(int(channel["target"]["node"]), str(channel["target"]["path"]))] = (index, channel)
    return result


def bake(source: pathlib.Path, output: pathlib.Path, cfg_path: pathlib.Path, profile: str) -> dict[str, Any]:
    cfg = json.loads(cfg_path.read_text())
    glb = read_glb(source)
    doc = glb.doc
    anim = find_animation(doc, "Orb_Main_Cinematic")
    channels = channel_map(anim)
    duration = float(cfg["durationSeconds"])
    fps = int(cfg["sampleRateFps"])
    sample_count = int(round(duration * fps)) + 1
    times = np.linspace(0.0, duration, sample_count, dtype=np.float32).reshape(-1, 1)
    shared_time_accessor = append_accessor(glb, times, FLOAT, "SCALAR", None, include_minmax=True)

    records: list[dict[str, Any]] = []
    for shell_cfg in cfg["shells"]:
        shell = int(shell_cfg["shell"])
        name = f"Shell_{shell:02d}"
        node_index = find_node_index(doc, name)
        node = doc["nodes"][node_index]
        base_translation = np.array(node.get("translation", [0.0, 0.0, 0.0]), dtype=np.float64)
        base_rotation = np.array(node.get("rotation", [0.0, 0.0, 0.0, 1.0]), dtype=np.float64)

        source_tracks: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        sampler_indexes: dict[str, int] = {}
        for path in ("translation", "rotation"):
            key = (node_index, path)
            if key not in channels:
                raise ValueError(f"{name}: missing {path} animation channel")
            _, channel = channels[key]
            sampler_index = int(channel["sampler"])
            sampler = anim["samplers"][sampler_index]
            source_tracks[path] = (
                read_accessor(glb, int(sampler["input"])).reshape(-1).astype(np.float64),
                read_accessor(glb, int(sampler["output"])).astype(np.float64),
            )
            sampler_indexes[path] = sampler_index

        translations = np.empty((sample_count, 3), dtype=np.float32)
        rotations = np.empty((sample_count, 4), dtype=np.float32)
        for i, t in enumerate(times[:, 0]):
            pos, rot = build_shell_pose(
                cfg,
                shell_cfg,
                base_translation,
                base_rotation,
                source_tracks["translation"],
                source_tracks["rotation"],
                float(t),
            )
            translations[i] = pos.astype(np.float32)
            rotations[i] = quat_normalize(rot).astype(np.float32)

        translation_accessor = append_accessor(glb, translations, FLOAT, "VEC3", None, include_minmax=True)
        rotation_accessor = append_accessor(glb, rotations, FLOAT, "VEC4", None)
        anim["samplers"][sampler_indexes["translation"]].update({
            "input": shared_time_accessor,
            "output": translation_accessor,
            "interpolation": "LINEAR",
        })
        anim["samplers"][sampler_indexes["rotation"]].update({
            "input": shared_time_accessor,
            "output": rotation_accessor,
            "interpolation": "LINEAR",
        })

        open_index = int(round(float(cfg["openPoseTime"]) * fps))
        node.setdefault("extras", {}).update({
            "breakupPhase": 5,
            "breakupGroup": shell_cfg["group"],
            "breakupMassClass": shell_cfg["massClass"],
            "breakupStartSeconds": float(cfg["groups"][shell_cfg["group"]]["start"]) + float(shell_cfg.get("delay", 0.0)),
            "breakupOpenTranslation": [float(x) for x in translations[open_index]],
            "breakupOpenRotation": [float(x) for x in rotations[open_index]],
        })
        records.append({
            "shell": shell,
            "group": shell_cfg["group"],
            "massClass": shell_cfg["massClass"],
            "start": node["extras"]["breakupStartSeconds"],
            "openTranslation": node["extras"]["breakupOpenTranslation"],
            "openRotation": node["extras"]["breakupOpenRotation"],
        })

    anim.setdefault("extras", {}).update({
        "chatgptV3Phase": 5,
        "breakupChoreographyVersion": cfg["version"],
        "breakupSampleRateFps": fps,
        "breakupOpenPoseSeconds": float(cfg["openPoseTime"]),
        "breakupOpenHoldEndSeconds": float(cfg["openHoldEnd"]),
        "fallbackRecallEndSeconds": float(cfg["fallbackRecallEnd"]),
    })
    doc.setdefault("asset", {}).setdefault("extras", {}).update({
        "chatgptV3Phase": 5,
        "breakupChoreography": cfg["version"],
    })

    write_glb(glb, output)
    return {
        "profile": profile,
        "source": str(source),
        "output": str(output),
        "sourceSha256": sha256(source),
        "outputSha256": sha256(output),
        "sampleRateFps": fps,
        "sampleCount": sample_count,
        "shells": records,
        "outputBytes": output.stat().st_size,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()
    cfg_path = root / "spec/v3/orb_breakup_choreography.json"
    models = [
        ("desktop", root / "public/models/orb_v3_faz4_desktop.glb", root / "public/models/orb_v3_faz5_desktop.glb"),
        ("mobile", root / "public/models/orb_v3_faz4_mobile.glb", root / "public/models/orb_v3_faz5_mobile.glb"),
    ]
    results = [bake(src, out, cfg_path, profile) for profile, src, out in models]
    manifest = {
        "phase": 5,
        "choreography": json.loads(cfg_path.read_text()),
        "models": results,
    }
    manifest_path = root / "public/models/orb_v3_faz5_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"manifest": str(manifest_path), "models": results}, indent=2))


if __name__ == "__main__":
    main()
