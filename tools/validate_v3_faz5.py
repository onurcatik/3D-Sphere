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

CFG = json.loads((ROOT / "spec/v3/orb_breakup_choreography.json").read_text())


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sample(times: np.ndarray, values: np.ndarray, t: float, path: str) -> np.ndarray:
    if t <= float(times[0]): return values[0].astype(np.float64)
    if t >= float(times[-1]): return values[-1].astype(np.float64)
    i = int(np.searchsorted(times, t, side="right") - 1)
    i = max(0, min(i, len(times) - 2))
    u = (t - float(times[i])) / max(1e-12, float(times[i + 1] - times[i]))
    if path != "rotation":
        return values[i].astype(np.float64) * (1 - u) + values[i + 1].astype(np.float64) * u
    a = values[i].astype(np.float64); b = values[i + 1].astype(np.float64)
    a /= np.linalg.norm(a); b /= np.linalg.norm(b)
    dot = float(np.dot(a, b))
    if dot < 0: b = -b; dot = -dot
    dot = max(-1.0, min(1.0, dot))
    if dot > 0.9995:
        q = a + (b - a) * u
        return q / np.linalg.norm(q)
    theta = math.acos(dot); st = math.sin(theta)
    return (a * math.sin((1-u)*theta) + b * math.sin(u*theta)) / st


def qrot_many(q: np.ndarray, vertices: np.ndarray) -> np.ndarray:
    q = np.asarray(q, dtype=np.float64); q /= np.linalg.norm(q)
    xyz, w = q[:3], q[3]
    xyz_many = np.broadcast_to(xyz, vertices.shape)
    temp = 2.0 * np.cross(xyz_many, vertices)
    return vertices + w * temp + np.cross(xyz_many, temp)


def aabb_overlap(a: tuple[np.ndarray,np.ndarray], b: tuple[np.ndarray,np.ndarray]) -> bool:
    ext = np.minimum(a[1], b[1]) - np.maximum(a[0], b[0])
    return bool(np.all(ext > 0))


def model_check(profile: str, source_rel: str, output_rel: str, budget: int) -> dict[str, Any]:
    source_path = ROOT / source_rel; output_path = ROOT / output_rel
    source = read_glb(source_path); output = read_glb(output_path)
    sd, od = source.doc, output.doc
    sa = next(a for a in sd["animations"] if a.get("name") == "Orb_Main_Cinematic")
    oa = next(a for a in od["animations"] if a.get("name") == "Orb_Main_Cinematic")
    source_names = {n.get("name"): i for i,n in enumerate(sd["nodes"])}
    output_names = {n.get("name"): i for i,n in enumerate(od["nodes"])}
    shell_nodes = {output_names[f"Shell_{i:02d}"] for i in range(1,15)}

    non_shell_identical = True
    changed_channels = 0
    source_channel_map = {(int(c["target"]["node"]),c["target"]["path"]): c for c in sa["channels"]}
    for channel in oa["channels"]:
        key = (int(channel["target"]["node"]), channel["target"]["path"])
        src_channel = source_channel_map[key]
        src_sampler = sa["samplers"][int(src_channel["sampler"])]
        out_sampler = oa["samplers"][int(channel["sampler"])]
        is_shell_transform = key[0] in shell_nodes and key[1] in ("translation","rotation")
        if is_shell_transform:
            changed_channels += 1
            continue
        for side, sampler, glb in (("src",src_sampler,source),("out",out_sampler,output)):
            if sampler.get("interpolation","LINEAR") != (src_sampler if side == "out" else out_sampler).get("interpolation","LINEAR"):
                non_shell_identical = False
        s_in = read_accessor(source,int(src_sampler["input"])); o_in = read_accessor(output,int(out_sampler["input"]))
        s_out = read_accessor(source,int(src_sampler["output"])); o_out = read_accessor(output,int(out_sampler["output"]))
        if s_in.shape != o_in.shape or s_out.shape != o_out.shape or not np.array_equal(s_in,o_in) or not np.array_equal(s_out,o_out):
            non_shell_identical = False

    tracks: dict[int, dict[str, tuple[np.ndarray,np.ndarray]]] = {}
    source_tracks: dict[int, dict[str, tuple[np.ndarray,np.ndarray]]] = {}
    shell_metrics=[]; all_norms=[]
    for shell in range(1,15):
        ni=output_names[f"Shell_{shell:02d}"]; sni=source_names[f"Shell_{shell:02d}"]
        tracks[shell]={}; source_tracks[shell]={}
        for anim,glb,node,target in ((oa,output,ni,tracks[shell]),(sa,source,sni,source_tracks[shell])):
            for ch in anim["channels"]:
                if int(ch["target"]["node"])==node and ch["target"]["path"] in ("translation","rotation"):
                    sm=anim["samplers"][int(ch["sampler"])]
                    target[ch["target"]["path"]]=(read_accessor(glb,int(sm["input"])).reshape(-1),read_accessor(glb,int(sm["output"])))
        base=np.array(od["nodes"][ni].get("translation",[0,0,0]),float)
        p308=sample(*tracks[shell]["translation"],3.08,"translation")
        p550=sample(*tracks[shell]["translation"],5.50,"translation")
        p693=sample(*tracks[shell]["translation"],6.93,"translation")
        q550=sample(*tracks[shell]["rotation"],5.50,"rotation")
        all_norms.extend(np.linalg.norm(tracks[shell]["rotation"][1],axis=1).tolist())
        late_errors=[]
        for t in (7.92,8.5,9.5,10.34,11.0):
            op=sample(*tracks[shell]["translation"],t,"translation"); sp=sample(*source_tracks[shell]["translation"],t,"translation")
            oq=sample(*tracks[shell]["rotation"],t,"rotation"); sq=sample(*source_tracks[shell]["rotation"],t,"rotation")
            qerr=min(np.linalg.norm(oq-sq),np.linalg.norm(oq+sq))
            late_errors.append(max(float(np.linalg.norm(op-sp)),float(qerr)))
        shell_metrics.append({
            "shell":shell,
            "displacementAt3_08":float(np.linalg.norm(p308-base)),
            "displacementAt5_50":float(np.linalg.norm(p550-base)),
            "holdDifference5_50to6_93":float(np.linalg.norm(p550-p693)),
            "openQuaternionNorm":float(np.linalg.norm(q550)),
            "maxLateSourceError":max(late_errors),
        })

    # Conservative path check: no new main-shell AABB overlap pair may be introduced
    # during 3.08..5.50 relative to the touching/overlapping source arrangement.
    vertices={}
    for shell in range(1,15):
        gi=output_names[f"Shell_{shell:02d}_GEO"]
        prim=od["meshes"][od["nodes"][gi]["mesh"]]["primitives"][0]
        vertices[shell]=read_accessor(output,int(prim["attributes"]["POSITION"])).astype(np.float64)
    def box(shell:int,t:float):
        p=sample(*tracks[shell]["translation"],t,"translation"); q=sample(*tracks[shell]["rotation"],t,"rotation")
        world=qrot_many(q,vertices[shell])+p
        return world.min(0),world.max(0)
    initial_pairs=set()
    for i in range(1,15):
        for j in range(i+1,15):
            if aabb_overlap(box(i,3.08),box(j,3.08)): initial_pairs.add((i,j))
    new_pairs=set()
    for frame in range(int(round(3.08*60)),int(round(5.50*60))+1):
        t=frame/60.0; boxes={i:box(i,t) for i in range(1,15)}
        for i in range(1,15):
            for j in range(i+1,15):
                if (i,j) not in initial_pairs and aabb_overlap(boxes[i],boxes[j]): new_pairs.add((i,j))

    # Open pose conservative sphere clearance.
    sphere=[]
    centers={}; radii={}
    for shell in range(1,15):
        verts=vertices[shell]; local_center=(verts.min(0)+verts.max(0))/2; radius=float(np.linalg.norm(verts-local_center,axis=1).max())
        p=sample(*tracks[shell]["translation"],5.5,"translation"); q=sample(*tracks[shell]["rotation"],5.5,"rotation")
        center=qrot_many(q,local_center.reshape(1,3))[0]+p
        centers[shell]=center; radii[shell]=radius
    min_clearance=999.0; min_pair=None
    for i in range(1,15):
        for j in range(i+1,15):
            clearance=float(np.linalg.norm(centers[i]-centers[j])-radii[i]-radii[j])
            if clearance<min_clearance: min_clearance=clearance; min_pair=(i,j)

    checks={
        "outputWithinBudget": output_path.stat().st_size <= budget,
        "sourceBinaryIsPrefix": bytes(output.binary[:len(source.binary)]) == bytes(source.binary),
        "nodeCountPreserved": len(sd.get("nodes",[])) == len(od.get("nodes",[])),
        "meshCountPreserved": len(sd.get("meshes",[])) == len(od.get("meshes",[])),
        "materialCountPreserved": len(sd.get("materials",[])) == len(od.get("materials",[])),
        "animationChannelCountPreserved": len(sa["channels"]) == len(oa["channels"]) == 167,
        "exactly28ShellTransformChannelsReauthored": changed_channels == 28,
        "nonShellAnimationPayloadIdentical": non_shell_identical,
        "tightAt3_08": max(x["displacementAt3_08"] for x in shell_metrics) <= 0.04,
        "openPoseReadableDistance": min(x["displacementAt5_50"] for x in shell_metrics) >= 1.15 and max(x["displacementAt5_50"] for x in shell_metrics) <= 1.52,
        "openPoseHeldTo6_93": max(x["holdDifference5_50to6_93"] for x in shell_metrics) <= 0.002,
        "lateSourceContinuity": max(x["maxLateSourceError"] for x in shell_metrics) <= 0.005,
        "quaternionsNormalized": max(abs(x-1.0) for x in all_norms) <= 2e-5,
        "noNewAabbOverlapPairsDuringBreakup": len(new_pairs)==0,
        "openPoseSphereClearancePositive": min_clearance > 0.05,
        "phaseMetadataPresent": oa.get("extras",{}).get("chatgptV3Phase") == 5,
    }
    return {
        "profile":profile,
        "source":source_rel,
        "output":output_rel,
        "sourceSha256":sha256(source_path),
        "outputSha256":sha256(output_path),
        "outputBytes":output_path.stat().st_size,
        "checks":checks,
        "shellMetrics":shell_metrics,
        "initialAabbOverlapPairs":[list(x) for x in sorted(initial_pairs)],
        "newAabbOverlapPairs":[list(x) for x in sorted(new_pairs)],
        "minimumOpenSphereClearance":min_clearance,
        "minimumOpenSphereClearancePair":list(min_pair) if min_pair else None,
    }


def main():
    config_shells={int(x["shell"]):x for x in CFG["shells"]}
    group_members={g:set(v["shells"]) for g,v in CFG["groups"].items()}
    group_check=all({s for s,x in config_shells.items() if x["group"]==g}==members for g,members in group_members.items())
    reports=[
        model_check("desktop","public/models/orb_v3_faz4_desktop.glb","public/models/orb_v3_faz5_desktop.glb",4*1024*1024),
        model_check("mobile","public/models/orb_v3_faz4_mobile.glb","public/models/orb_v3_faz5_mobile.glb",2*1024*1024),
    ]
    desktop=read_glb(ROOT/"public/models/orb_v3_faz5_desktop.glb"); mobile=read_glb(ROOT/"public/models/orb_v3_faz5_mobile.glb")
    def open_meta(glb):
        return {n.get("name"):(n.get("extras",{}).get("breakupOpenTranslation"),n.get("extras",{}).get("breakupOpenRotation")) for n in glb.doc["nodes"] if str(n.get("name","")).startswith("Shell_") and len(str(n.get("name")))==8}
    cross_profile=open_meta(desktop)==open_meta(mobile)
    asset=(ROOT/"lib/assetProfile.ts").read_text()
    timeline=(ROOT/"lib/orbBreakupTimeline.ts").read_text()
    fx=(ROOT/"components/scene/ShellFractureFX.tsx").read_text()
    global_checks={
        "groupMembershipExact":group_check,
        "desktopMobileOpenPoseIdentical":cross_profile,
        "activeAssetsPhase5OrLater":(("orb_v3_faz5_desktop.glb" in asset and "orb_v3_faz5_mobile.glb" in asset) or ("orb_v3_faz7_desktop.glb" in asset and "orb_v3_faz7_mobile.glb" in asset)),
        "breakupRuntimeUsesSceneTime":"sample.sceneTime" in fx and "elapsedTime" not in fx and "Date.now" not in fx,
        "breakupTimelineIntegrated":((lambda scene: ("breakup: sampleOrbBreakup(clampedTime)" in scene) or ("const breakup = sampleOrbBreakup(clampedTime);" in scene and "breakup," in scene))((ROOT/"lib/sceneTimeline.ts").read_text())),
        "singleShockwaveContract":"shockwave" in timeline and "TorusGeometry" in fx,
        "deterministicDebrisSeed":"seededRandom(0x5f3759df)" in fx,
    }
    passed=all(global_checks.values()) and all(all(r["checks"].values()) for r in reports)
    report={"phase":5,"passed":passed,"globalChecks":global_checks,"models":reports}
    out=ROOT/"qa/faz-5/validation_v3_faz5.json"; out.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    raise SystemExit(0 if passed else 1)

if __name__=="__main__": main()
