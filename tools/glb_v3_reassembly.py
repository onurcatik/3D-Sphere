#!/usr/bin/env python3
"""Bake CHATGPT V3 FAZ 5 breakup + FAZ 7 magnetic reassembly into V3 GLBs.

The script starts from the FAZ 4 GLB so the FAZ 5 sampled shell tracks are not
stacked a second time. Shell_01..Shell_14 translation/rotation tracks are baked
at 60 Hz. 0..6.93 s reproduces the FAZ 5 breakup authoring exactly; 6.93..11 s
uses the deterministic FAZ 7 alignment, staged approach, magnetic seat and seal.
All non-shell animation channels and all geometry/material binary payload remain
unchanged from the FAZ 4 input.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
from typing import Any

import numpy as np

from glb_v3_pipeline import FLOAT, append_accessor, read_accessor, read_glb, write_glb
from glb_v3_choreography import (
    build_shell_pose as build_breakup_pose,
    channel_map,
    find_animation,
    find_node_index,
    normalize,
    quat_normalize,
    quat_slerp,
    shell_basis,
    smootherstep01,
)


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


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


def build_reassembly_pose(
    reassembly: dict[str, Any],
    shell_cfg: dict[str, Any],
    base_translation: np.ndarray,
    base_rotation: np.ndarray,
    open_translation: np.ndarray,
    open_rotation: np.ndarray,
    time_value: float,
) -> tuple[np.ndarray, np.ndarray]:
    t = float(time_value)
    hold_end = float(reassembly["openHoldEnd"])
    align_end = float(reassembly["alignEnd"])
    seal_start = float(reassembly["sealStart"])
    wave = reassembly["waves"][shell_cfg["wave"]]
    start = float(wave["start"])
    seat_end = float(wave["seatEnd"])
    seat_duration = float(reassembly["seatDuration"])
    seat_start = max(start + 0.20, seat_end - seat_duration)
    radial, tangent, up = shell_basis(base_translation)
    spin = float(shell_cfg["spinSign"])

    # Open pose is deliberately maintained positionally while rotation acquires
    # the target slot orientation. A tiny outward pulse visualizes magnetic capture.
    prealigned_rotation = quat_slerp(open_rotation, base_rotation, float(reassembly["alignRotationFraction"]))
    if t <= hold_end:
        return open_translation.copy(), open_rotation.copy()
    if t < align_end:
        u = smootherstep01((t - hold_end) / max(1e-9, align_end - hold_end))
        pulse = math.sin(math.pi * clamp01((t - hold_end) / max(1e-9, align_end - hold_end)))
        pos = open_translation + radial * float(reassembly["alignPulseDistance"]) * pulse
        rot = quat_slerp(open_rotation, prealigned_rotation, u)
        return pos, rot
    if t < start:
        return open_translation.copy(), prealigned_rotation.copy()

    preseat = base_translation + radial * float(reassembly["preSeatGap"])
    if t < seat_start:
        raw = clamp01((t - start) / max(1e-9, seat_start - start))
        u = smootherstep01(raw)
        arc = math.sin(math.pi * raw)
        pos = open_translation * (1.0 - u) + preseat * u
        pos = pos + tangent * (float(shell_cfg["pathArc"]) * spin * arc)
        pos = pos + up * (float(shell_cfg["verticalArc"]) * arc)
        rot = quat_slerp(prealigned_rotation, base_rotation, smootherstep01(min(1.0, raw * 1.08)))
        return pos, rot

    if t < seat_end:
        raw = clamp01((t - seat_start) / max(1e-9, seat_end - seat_start))
        u = smootherstep01(raw)
        gap = float(reassembly["preSeatGap"]) * (1.0 - u)
        # Positive-only micro lift gives a magnetic snap without crossing the slot.
        lift = float(reassembly["seatLift"]) * math.sin(math.pi * raw) * (1.0 - raw)
        pos = base_translation + radial * (gap + lift)
        return pos, base_rotation.copy()

    # Exact slot lock. No overshoot or spring history is allowed after seating.
    if t <= seal_start:
        return base_translation.copy(), base_rotation.copy()
    return base_translation.copy(), base_rotation.copy()


def bake(
    source: pathlib.Path,
    phase5_reference: pathlib.Path,
    output: pathlib.Path,
    breakup_cfg_path: pathlib.Path,
    reassembly_cfg_path: pathlib.Path,
    profile: str,
) -> dict[str, Any]:
    breakup = json.loads(breakup_cfg_path.read_text())
    reassembly = json.loads(reassembly_cfg_path.read_text())
    glb = read_glb(source)
    phase5 = read_glb(phase5_reference)
    doc = glb.doc
    anim = find_animation(doc, "Orb_Main_Cinematic")
    phase5_anim = find_animation(phase5.doc, "Orb_Main_Cinematic")
    channels = channel_map(anim)
    phase5_channels = channel_map(phase5_anim)
    duration = float(reassembly["durationSeconds"])
    fps = int(reassembly["sampleRateFps"])
    sample_count = int(round(duration * fps)) + 1
    times = np.linspace(0.0, duration, sample_count, dtype=np.float32).reshape(-1, 1)
    shared_time_accessor = append_accessor(glb, times, FLOAT, "SCALAR", None, include_minmax=True)
    breakup_shells = {int(item["shell"]): item for item in breakup["shells"]}
    reassembly_shells = {int(item["shell"]): item for item in reassembly["shells"]}

    records: list[dict[str, Any]] = []
    for shell in range(1, 15):
        name = f"Shell_{shell:02d}"
        node_index = find_node_index(doc, name)
        p5_node_index = find_node_index(phase5.doc, name)
        node = doc["nodes"][node_index]
        base_translation = np.array(node.get("translation", [0.0, 0.0, 0.0]), dtype=np.float64)
        base_rotation = quat_normalize(np.array(node.get("rotation", [0.0, 0.0, 0.0, 1.0]), dtype=np.float64))

        source_tracks: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        phase5_tracks: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        sampler_indexes: dict[str, int] = {}
        for path in ("translation", "rotation"):
            _, channel = channels[(node_index, path)]
            sampler_index = int(channel["sampler"])
            sampler = anim["samplers"][sampler_index]
            source_tracks[path] = (
                read_accessor(glb, int(sampler["input"])).reshape(-1).astype(np.float64),
                read_accessor(glb, int(sampler["output"])).astype(np.float64),
            )
            sampler_indexes[path] = sampler_index

            _, p5_channel = phase5_channels[(p5_node_index, path)]
            p5_sampler = phase5_anim["samplers"][int(p5_channel["sampler"])]
            phase5_tracks[path] = (
                read_accessor(phase5, int(p5_sampler["input"])).reshape(-1).astype(np.float64),
                read_accessor(phase5, int(p5_sampler["output"])).astype(np.float64),
            )

        open_t = float(reassembly["openHoldEnd"])
        open_translation = sample_track(*phase5_tracks["translation"], open_t, "translation")
        open_rotation = sample_track(*phase5_tracks["rotation"], open_t, "rotation")
        translations = np.empty((sample_count, 3), dtype=np.float32)
        rotations = np.empty((sample_count, 4), dtype=np.float32)
        for i, t in enumerate(times[:, 0]):
            tf = float(t)
            if tf <= open_t + 1e-6:
                # Recompute FAZ 5 from the same FAZ 4 source so the new GLB remains compact.
                pos, rot = build_breakup_pose(
                    breakup,
                    breakup_shells[shell],
                    base_translation,
                    base_rotation,
                    source_tracks["translation"],
                    source_tracks["rotation"],
                    tf,
                )
            else:
                pos, rot = build_reassembly_pose(
                    reassembly,
                    reassembly_shells[shell],
                    base_translation,
                    base_rotation,
                    open_translation,
                    open_rotation,
                    tf,
                )
            translations[i] = np.asarray(pos, dtype=np.float32)
            rotations[i] = quat_normalize(np.asarray(rot, dtype=np.float64)).astype(np.float32)

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

        rcfg = reassembly_shells[shell]
        wave = reassembly["waves"][rcfg["wave"]]
        node.setdefault("extras", {}).update({
            "reassemblyPhase": 7,
            "reassemblyWave": rcfg["wave"],
            "reassemblyStartSeconds": float(wave["start"]),
            "reassemblySeatSeconds": float(wave["seatEnd"]),
            "reassemblyTargetTranslation": [float(x) for x in base_translation],
            "reassemblyTargetRotation": [float(x) for x in base_rotation],
        })
        records.append({
            "shell": shell,
            "wave": rcfg["wave"],
            "start": float(wave["start"]),
            "seatEnd": float(wave["seatEnd"]),
            "targetTranslation": node["extras"]["reassemblyTargetTranslation"],
            "targetRotation": node["extras"]["reassemblyTargetRotation"],
        })

    anim.setdefault("extras", {}).update({
        "chatgptV3Phase": 7,
        "breakupChoreographyVersion": breakup["version"],
        "reassemblyChoreographyVersion": reassembly["version"],
        "reassemblySampleRateFps": fps,
        "reassemblyAlignStartSeconds": float(reassembly["openHoldEnd"]),
        "reassemblyAlignEndSeconds": float(reassembly["alignEnd"]),
        "reassemblySealStartSeconds": float(reassembly["sealStart"]),
        "reassemblySealEndSeconds": float(reassembly["sealEnd"]),
    })
    doc.setdefault("asset", {}).setdefault("extras", {}).update({
        "chatgptV3Phase": 7,
        "breakupChoreography": breakup["version"],
        "reassemblyChoreography": reassembly["version"],
    })
    write_glb(glb, output)
    return {
        "profile": profile,
        "source": str(source),
        "phase5Reference": str(phase5_reference),
        "output": str(output),
        "sourceSha256": sha256(source),
        "phase5ReferenceSha256": sha256(phase5_reference),
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
    breakup = root / "spec/v3/orb_breakup_choreography.json"
    reassembly = root / "spec/v3/orb_reassembly_choreography.json"
    models = [
        (
            "desktop",
            root / "public/models/orb_v3_faz4_desktop.glb",
            root / "public/models/orb_v3_faz5_desktop.glb",
            root / "public/models/orb_v3_faz7_desktop.glb",
        ),
        (
            "mobile",
            root / "public/models/orb_v3_faz4_mobile.glb",
            root / "public/models/orb_v3_faz5_mobile.glb",
            root / "public/models/orb_v3_faz7_mobile.glb",
        ),
    ]
    results = [bake(src, p5, out, breakup, reassembly, profile) for profile, src, p5, out in models]
    manifest = {
        "phase": 7,
        "breakupChoreography": json.loads(breakup.read_text()),
        "reassemblyChoreography": json.loads(reassembly.read_text()),
        "models": results,
    }
    manifest_path = root / "public/models/orb_v3_faz7_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"manifest": str(manifest_path), "models": results}, indent=2))


if __name__ == "__main__":
    main()
