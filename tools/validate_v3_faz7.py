#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import sys
from typing import Any

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from glb_v3_pipeline import read_accessor, read_glb  # noqa: E402
from validate_v3_faz5 import sample, qrot_many, aabb_overlap  # noqa: E402

CFG = json.loads((ROOT / "spec/v3/orb_reassembly_choreography.json").read_text())


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def quat_angle_degrees(a: np.ndarray, b: np.ndarray) -> float:
    qa = np.asarray(a, dtype=np.float64); qb = np.asarray(b, dtype=np.float64)
    qa /= max(1e-12, float(np.linalg.norm(qa))); qb /= max(1e-12, float(np.linalg.norm(qb)))
    dot = min(1.0, max(-1.0, abs(float(np.dot(qa, qb)))))
    return math.degrees(2.0 * math.acos(dot))


def tracks_for(glb, node_index: int) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    anim = next(a for a in glb.doc["animations"] if a.get("name") == "Orb_Main_Cinematic")
    result: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for ch in anim["channels"]:
        if int(ch["target"]["node"]) != node_index or ch["target"]["path"] not in ("translation", "rotation"):
            continue
        sm = anim["samplers"][int(ch["sampler"])]
        result[ch["target"]["path"]] = (
            read_accessor(glb, int(sm["input"])).reshape(-1),
            read_accessor(glb, int(sm["output"])),
        )
    return result


def model_check(profile: str, faz4_rel: str, faz5_rel: str, output_rel: str, budget: int) -> dict[str, Any]:
    faz4_path = ROOT / faz4_rel; faz5_path = ROOT / faz5_rel; output_path = ROOT / output_rel
    faz4 = read_glb(faz4_path); faz5 = read_glb(faz5_path); output = read_glb(output_path)
    f4d, f5d, od = faz4.doc, faz5.doc, output.doc
    f4a = next(a for a in f4d["animations"] if a.get("name") == "Orb_Main_Cinematic")
    oa = next(a for a in od["animations"] if a.get("name") == "Orb_Main_Cinematic")
    f4names = {n.get("name"): i for i, n in enumerate(f4d["nodes"])}
    f5names = {n.get("name"): i for i, n in enumerate(f5d["nodes"])}
    onames = {n.get("name"): i for i, n in enumerate(od["nodes"])}
    shell_nodes = {onames[f"Shell_{i:02d}"] for i in range(1, 15)}

    # All non-shell animation payload must remain identical to FAZ 4.
    f4map = {(int(c["target"]["node"]), c["target"]["path"]): c for c in f4a["channels"]}
    non_shell_identical = True; changed_channels = 0
    for channel in oa["channels"]:
        key = (int(channel["target"]["node"]), channel["target"]["path"])
        src_channel = f4map[key]
        src_sm = f4a["samplers"][int(src_channel["sampler"])]
        out_sm = oa["samplers"][int(channel["sampler"])]
        shell_transform = key[0] in shell_nodes and key[1] in ("translation", "rotation")
        if shell_transform:
            changed_channels += 1
            continue
        if src_sm.get("interpolation", "LINEAR") != out_sm.get("interpolation", "LINEAR"):
            non_shell_identical = False
            continue
        for field in ("input", "output"):
            a = read_accessor(faz4, int(src_sm[field])); b = read_accessor(output, int(out_sm[field]))
            if a.shape != b.shape or not np.array_equal(a, b):
                non_shell_identical = False

    tracks: dict[int, dict[str, tuple[np.ndarray, np.ndarray]]] = {}
    phase5_tracks: dict[int, dict[str, tuple[np.ndarray, np.ndarray]]] = {}
    metrics = []
    quaternion_norms = []
    pre_reassembly_max_position_error = 0.0
    pre_reassembly_max_rotation_error = 0.0
    for shell in range(1, 15):
        ni = onames[f"Shell_{shell:02d}"]; p5ni = f5names[f"Shell_{shell:02d}"]
        tracks[shell] = tracks_for(output, ni); phase5_tracks[shell] = tracks_for(faz5, p5ni)
        node = od["nodes"][ni]
        base_p = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
        base_q = np.array(node.get("rotation", [0, 0, 0, 1]), dtype=np.float64)
        # Every authored sample strictly before 6.93 must match FAZ 5.
        times = tracks[shell]["translation"][0]
        for t in times[times <= (CFG["openHoldEnd"] - 1.0 / CFG["sampleRateFps"] + 1e-8)]:
            tf = float(t)
            op = sample(*tracks[shell]["translation"], tf, "translation")
            fp = sample(*phase5_tracks[shell]["translation"], tf, "translation")
            oq = sample(*tracks[shell]["rotation"], tf, "rotation")
            fq = sample(*phase5_tracks[shell]["rotation"], tf, "rotation")
            pre_reassembly_max_position_error = max(pre_reassembly_max_position_error, float(np.linalg.norm(op - fp)))
            pre_reassembly_max_rotation_error = max(pre_reassembly_max_rotation_error, quat_angle_degrees(oq, fq))

        p693 = sample(*tracks[shell]["translation"], CFG["openHoldEnd"], "translation")
        p792 = sample(*tracks[shell]["translation"], CFG["alignEnd"], "translation")
        q792 = sample(*tracks[shell]["rotation"], CFG["alignEnd"], "rotation")
        p1034 = sample(*tracks[shell]["translation"], CFG["sealStart"], "translation")
        q1034 = sample(*tracks[shell]["rotation"], CFG["sealStart"], "rotation")
        p1100 = sample(*tracks[shell]["translation"], CFG["sealEnd"], "translation")
        q1100 = sample(*tracks[shell]["rotation"], CFG["sealEnd"], "rotation")
        quaternion_norms.extend(np.linalg.norm(tracks[shell]["rotation"][1], axis=1).tolist())
        metrics.append({
            "shell": shell,
            "wave": node.get("extras", {}).get("reassemblyWave"),
            "alignPositionShift": float(np.linalg.norm(p792 - p693)),
            "alignAngleErrorDegrees": quat_angle_degrees(q792, base_q),
            "positionErrorAt10_34": float(np.linalg.norm(p1034 - base_p)),
            "rotationErrorAt10_34Degrees": quat_angle_degrees(q1034, base_q),
            "positionErrorAt11_00": float(np.linalg.norm(p1100 - base_p)),
            "rotationErrorAt11_00Degrees": quat_angle_degrees(q1100, base_q),
        })

    # Collision policy: during recall, no AABB overlap pair may occur unless the
    # same conservative pair exists in the exact final closed pose.
    vertices: dict[int, np.ndarray] = {}
    for shell in range(1, 15):
        gi = onames[f"Shell_{shell:02d}_GEO"]
        prim = od["meshes"][od["nodes"][gi]["mesh"]]["primitives"][0]
        vertices[shell] = read_accessor(output, int(prim["attributes"]["POSITION"])).astype(np.float64)

    def box(shell: int, t: float):
        p = sample(*tracks[shell]["translation"], t, "translation")
        q = sample(*tracks[shell]["rotation"], t, "rotation")
        world = qrot_many(q, vertices[shell]) + p
        return world.min(0), world.max(0)

    def overlap_pairs(t: float):
        boxes = {i: box(i, t) for i in range(1, 15)}
        return {(i, j) for i in range(1, 15) for j in range(i + 1, 15) if aabb_overlap(boxes[i], boxes[j])}

    final_pairs = overlap_pairs(CFG["sealEnd"])
    new_pairs = set(); max_pair_count = 0
    for frame in range(int(round(CFG["openHoldEnd"] * 60)), int(round(CFG["sealStart"] * 60)) + 1):
        pairs = overlap_pairs(frame / 60.0)
        new_pairs |= (pairs - final_pairs)
        max_pair_count = max(max_pair_count, len(pairs))

    extras_ok = True
    expected_waves = {int(s): wave for wave, cfg in CFG["waves"].items() for s in cfg["shells"]}
    for shell in range(1, 15):
        ex = od["nodes"][onames[f"Shell_{shell:02d}"]].get("extras", {})
        extras_ok &= ex.get("reassemblyPhase") == 7
        extras_ok &= ex.get("reassemblyWave") == expected_waves[shell]
        extras_ok &= isinstance(ex.get("reassemblyTargetTranslation"), list)
        extras_ok &= isinstance(ex.get("reassemblyTargetRotation"), list)

    checks = {
        "outputWithinBudget": output_path.stat().st_size <= budget,
        "phase4BinaryIsPrefix": bytes(output.binary[:len(faz4.binary)]) == bytes(faz4.binary),
        "nodeCountPreserved": len(f4d.get("nodes", [])) == len(od.get("nodes", [])),
        "meshCountPreserved": len(f4d.get("meshes", [])) == len(od.get("meshes", [])),
        "materialCountPreserved": len(f4d.get("materials", [])) == len(od.get("materials", [])),
        "animationChannelCountPreserved": len(f4a["channels"]) == len(oa["channels"]) == 167,
        "exactly28ShellTransformChannelsReauthored": changed_channels == 28,
        "nonShellAnimationPayloadIdentical": non_shell_identical,
        "faz5BreakupPreservedBeforeRecall": pre_reassembly_max_position_error <= 2e-5 and pre_reassembly_max_rotation_error <= 0.002,
        "alignmentDoesNotCollapsePosition": max(m["alignPositionShift"] for m in metrics) <= 0.002,
        "alignmentWithinEightDegrees": max(m["alignAngleErrorDegrees"] for m in metrics) <= 8.0,
        "exactSeatBy10_34": max(m["positionErrorAt10_34"] for m in metrics) <= 1e-4 and max(m["rotationErrorAt10_34Degrees"] for m in metrics) <= 0.01,
        "exactFinalAt11": max(m["positionErrorAt11_00"] for m in metrics) <= 1e-5 and max(m["rotationErrorAt11_00Degrees"] for m in metrics) <= 0.01,
        "quaternionsNormalized": max(abs(n - 1.0) for n in quaternion_norms) <= 2e-5,
        "noNewAabbOverlapPairsDuringRecall": len(new_pairs) == 0,
        "reassemblyMetadataPresent": extras_ok,
        "phaseMetadataPresent": oa.get("extras", {}).get("chatgptV3Phase") == 7,
    }
    return {
        "profile": profile,
        "faz4": faz4_rel,
        "faz5Reference": faz5_rel,
        "output": output_rel,
        "outputSha256": sha256(output_path),
        "outputBytes": output_path.stat().st_size,
        "checks": checks,
        "preReassemblyMaxPositionError": pre_reassembly_max_position_error,
        "preReassemblyMaxRotationErrorDegrees": pre_reassembly_max_rotation_error,
        "shellMetrics": metrics,
        "finalClosedAabbPairs": [list(x) for x in sorted(final_pairs)],
        "newAabbOverlapPairsDuringRecall": [list(x) for x in sorted(new_pairs)],
        "maxAabbPairCountDuringRecall": max_pair_count,
    }


def main() -> None:
    reports = [
        model_check("desktop", "public/models/orb_v3_faz4_desktop.glb", "public/models/orb_v3_faz5_desktop.glb", "public/models/orb_v3_faz7_desktop.glb", 4 * 1024 * 1024),
        model_check("mobile", "public/models/orb_v3_faz4_mobile.glb", "public/models/orb_v3_faz5_mobile.glb", "public/models/orb_v3_faz7_mobile.glb", 2 * 1024 * 1024),
    ]
    desktop = read_glb(ROOT / "public/models/orb_v3_faz7_desktop.glb")
    mobile = read_glb(ROOT / "public/models/orb_v3_faz7_mobile.glb")
    def reassembly_meta(glb):
        return {
            n.get("name"): (
                n.get("extras", {}).get("reassemblyWave"),
                n.get("extras", {}).get("reassemblyStartSeconds"),
                n.get("extras", {}).get("reassemblySeatSeconds"),
                n.get("extras", {}).get("reassemblyTargetTranslation"),
                n.get("extras", {}).get("reassemblyTargetRotation"),
            )
            for n in glb.doc["nodes"] if str(n.get("name", "")).startswith("Shell_") and len(str(n.get("name"))) == 8
        }
    asset = (ROOT / "lib/assetProfile.ts").read_text()
    scene = (ROOT / "lib/sceneTimeline.ts").read_text()
    orb = (ROOT / "components/scene/OrbModel.tsx").read_text()
    runtime = (ROOT / "lib/runtime/reassemblyRuntime.js").read_text()
    timeline = (ROOT / "lib/orbReassemblyTimeline.ts").read_text()
    config_shells = {int(s): wave for wave, cfg in CFG["waves"].items() for s in cfg["shells"]}
    expected = set(range(1, 15))
    global_checks = {
        "waveMembershipCoversExactly14Shells": set(config_shells) == expected and len(config_shells) == 14,
        "desktopMobileReassemblyMetadataIdentical": reassembly_meta(desktop) == reassembly_meta(mobile),
        "activeAssetsPhase7": "orb_v3_faz7_desktop.glb" in asset and "orb_v3_faz7_mobile.glb" in asset,
        "sceneTimelineIncludesReassembly": ("reassembly: sampleOrbReassembly(clampedTime)" in scene) or ("const reassembly = sampleOrbReassembly(clampedTime);" in scene and "reassembly," in scene),
        "innerSeamUsesReassembly": "sample.reassembly.seamGlow" in orb,
        "runtimeUsesSceneTime": "sceneTime" in runtime and "elapsedTime" not in runtime and "Date.now" not in runtime and "Math.random" not in runtime,
        "runtimeHasMagneticGuides": "FAZ7_MagneticSlotGuides" in runtime,
        "runtimeHasFinalSealRing": "FAZ7_FinalSealRing" in runtime,
        "timelineHasSeatAndSealPulses": "seatPulse" in timeline and "sealPulse" in timeline,
    }
    passed = all(global_checks.values()) and all(all(r["checks"].values()) for r in reports)
    report = {"phase": 7, "passed": passed, "globalChecks": global_checks, "models": reports}
    out = ROOT / "qa/faz-7/validation_v3_faz7.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
