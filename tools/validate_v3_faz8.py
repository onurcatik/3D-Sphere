#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import pathlib
import shutil
import subprocess
import sys
from typing import Any

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

QA_DIR = ROOT / 'qa/faz-8'
RUNTIME_DIR = QA_DIR / 'runtime'
QA_DIR.mkdir(parents=True, exist_ok=True)
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

tsc = ROOT / 'node_modules/.bin/tsc'
if not tsc.exists():
    resolved = shutil.which('tsc')
    if not resolved:
        raise SystemExit('TypeScript compiler not found; cannot validate the FAZ 8 camera contract.')
    tsc = pathlib.Path(resolved)

compile_command = [
    str(tsc), '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node',
    '--skipLibCheck', '--esModuleInterop', '--outDir', str(RUNTIME_DIR),
    str(ROOT / 'lib/scrollTimeline.ts'), str(ROOT / 'lib/cameraTimeline.ts'), str(ROOT / 'lib/assetProfile.ts')
]
compile_result = subprocess.run(compile_command, cwd=ROOT, text=True, capture_output=True)
(QA_DIR / 'targeted_compile.txt').write_text((compile_result.stdout or '') + (compile_result.stderr or ''))
if compile_result.returncode != 0:
    raise SystemExit(compile_result.returncode)

node = shutil.which('node')
if not node:
    raise SystemExit('Node.js not found; cannot sample the FAZ 8 camera contract.')
sample_result = subprocess.run([node, str(ROOT / 'tools/export_v3_faz8_camera_samples.cjs')], cwd=ROOT, text=True, capture_output=True)
if sample_result.returncode != 0:
    (QA_DIR / 'camera_sample_error.txt').write_text((sample_result.stdout or '') + (sample_result.stderr or ''))
    raise SystemExit(sample_result.returncode)
(QA_DIR / 'camera_samples.json').write_text(sample_result.stdout)
from glb_v3_pipeline import read_accessor, read_glb  # noqa: E402
from validate_v3_faz5 import sample, qrot_many  # noqa: E402
from validate_v3_faz7 import tracks_for  # noqa: E402

CAMERA_DATA = json.loads((ROOT / 'qa/faz-8/camera_samples.json').read_text())
GLB = read_glb(ROOT / 'public/models/orb_v3_faz7_desktop.glb')
DOC = GLB.doc
NAMES = {n.get('name'): i for i, n in enumerate(DOC['nodes'])}
TRACKS = {s: tracks_for(GLB, NAMES[f'Shell_{s:02d}']) for s in range(1, 15)}


def local_bbox_corners(points: np.ndarray) -> np.ndarray:
    mn = points.min(axis=0); mx = points.max(axis=0)
    return np.array([[x, y, z] for x in (mn[0], mx[0]) for y in (mn[1], mx[1]) for z in (mn[2], mx[2])], dtype=np.float64)


CORNERS: dict[int, np.ndarray] = {}
for shell in range(1, 15):
    geo = NAMES[f'Shell_{shell:02d}_GEO']
    prim = DOC['meshes'][DOC['nodes'][geo]['mesh']]['primitives'][0]
    positions = read_accessor(GLB, int(prim['attributes']['POSITION'])).astype(np.float64)
    CORNERS[shell] = local_bbox_corners(positions)


def shell_points(time_value: float) -> np.ndarray:
    world: list[np.ndarray] = []
    for shell in range(1, 15):
        position = sample(*TRACKS[shell]['translation'], time_value, 'translation')
        rotation = sample(*TRACKS[shell]['rotation'], time_value, 'rotation')
        world.append(qrot_many(rotation, CORNERS[shell]) + position)
    return np.concatenate(world, axis=0)


def project(points: np.ndarray, camera: dict[str, Any], aspect: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    position = np.asarray(camera['position'], dtype=np.float64)
    target = np.asarray(camera['target'], dtype=np.float64)
    forward = target - position
    forward /= max(1e-12, float(np.linalg.norm(forward)))
    up = np.array([0.0, 1.0, 0.0], dtype=np.float64)
    right = np.cross(forward, up)
    right /= max(1e-12, float(np.linalg.norm(right)))
    local_up = np.cross(right, forward)
    local_up /= max(1e-12, float(np.linalg.norm(local_up)))
    roll = math.radians(float(camera['roll']))
    if abs(roll) > 1e-12:
        cr, sr = math.cos(roll), math.sin(roll)
        rolled_right = right * cr + local_up * sr
        rolled_up = -right * sr + local_up * cr
        right, local_up = rolled_right, rolled_up
    relative = points - position
    depth = relative @ forward
    tan_half = math.tan(math.radians(float(camera['fov'])) * 0.5)
    ndc_x = (relative @ right) / (np.maximum(depth, 1e-9) * tan_half * aspect)
    ndc_y = (relative @ local_up) / (np.maximum(depth, 1e-9) * tan_half)
    return ndc_x, ndc_y, depth


LIMITS = {
    'desktop': {'x': 0.985, 'yTop': 0.90, 'yBottom': -0.91},
    'tabletPortrait': {'x': 0.985, 'yTop': 0.86, 'yBottom': -0.90},
    'mobilePortrait': {'x': 0.985, 'yTop': 0.78, 'yBottom': -0.70},
    'mobileLandscape': {'x': 0.985, 'yTop': 0.88, 'yBottom': -0.90},
    'lowPowerPortrait': {'x': 0.985, 'yTop': 0.78, 'yBottom': -0.70},
}

profile_metrics: dict[str, Any] = {}
all_framing_pass = True
for profile_name, entry in CAMERA_DATA['profiles'].items():
    limits = LIMITS[profile_name]
    worst = {
        'minX': 1e9, 'maxX': -1e9, 'minY': 1e9, 'maxY': -1e9,
        'minDepth': 1e9, 'maxAbsX': 0.0, 'frameAtMaxAbsX': 0.0,
        'frameAtMinY': 0.0, 'frameAtMaxY': 0.0,
    }
    violations = []
    for camera in entry['samples']:
        t = float(camera['time'])
        points = shell_points(t)
        x, y, depth = project(points, camera, float(entry['aspect']))
        mnx, mxx = float(x.min()), float(x.max())
        mny, mxy = float(y.min()), float(y.max())
        mnd = float(depth.min())
        absx = max(abs(mnx), abs(mxx))
        if absx > worst['maxAbsX']:
            worst['maxAbsX'] = absx; worst['frameAtMaxAbsX'] = t
        if mny < worst['minY']:
            worst['minY'] = mny; worst['frameAtMinY'] = t
        if mxy > worst['maxY']:
            worst['maxY'] = mxy; worst['frameAtMaxY'] = t
        worst['minX'] = min(worst['minX'], mnx); worst['maxX'] = max(worst['maxX'], mxx)
        worst['minDepth'] = min(worst['minDepth'], mnd)
        safe = (
            mnx >= -limits['x'] and mxx <= limits['x'] and
            mny >= limits['yBottom'] and mxy <= limits['yTop'] and
            mnd > 0.25
        )
        if not safe:
            violations.append({'time': t, 'minX': mnx, 'maxX': mxx, 'minY': mny, 'maxY': mxy, 'minDepth': mnd})
    passed = len(violations) == 0
    all_framing_pass &= passed
    profile_metrics[profile_name] = {
        'passed': passed,
        'aspect': entry['aspect'],
        'limits': limits,
        'worst': worst,
        'violations': violations[:24],
        'violationCount': len(violations),
    }

# Desktop composition sign must oppose the narrative-copy side at chapter anchors.
# Positive projected center = orb is screen-right; negative = screen-left.
composition_expectations = {
    'hero_start': 'right',
    'unlock': 'left',
    'fragment_start': 'right',
    'core_reveal': 'left',
    'recall': 'right',
    'reassembly_start': 'left',
    'final_hero': 'center',
}
composition_metrics = []
desktop = CAMERA_DATA['profiles']['desktop']
for camera in desktop['critical']:
    expected = composition_expectations.get(camera['id'])
    if not expected:
        continue
    points = shell_points(float(camera['time']))
    x, y, depth = project(points, camera, float(desktop['aspect']))
    center = (float(x.min()) + float(x.max())) * 0.5
    if expected == 'right':
        passed = center >= 0.10
    elif expected == 'left':
        passed = center <= -0.10
    else:
        passed = abs(center) <= 0.08
    composition_metrics.append({'id': camera['id'], 'time': camera['time'], 'expected': expected, 'projectedCenterX': center, 'passed': passed})
composition_pass = all(item['passed'] for item in composition_metrics)

continuity = CAMERA_DATA['continuity']
continuity_metrics = {
    'maxPositionVelocityJump': max(item['positionVelocityJump'] for item in continuity),
    'maxTargetVelocityJump': max(item['targetVelocityJump'] for item in continuity),
    'maxFovVelocityJump': max(item['fovVelocityJump'] for item in continuity),
    'maxRollVelocityJump': max(item['rollVelocityJump'] for item in continuity),
}
continuity_pass = (
    continuity_metrics['maxPositionVelocityJump'] < 0.02 and
    continuity_metrics['maxTargetVelocityJump'] < 0.02 and
    continuity_metrics['maxFovVelocityJump'] < 0.02 and
    continuity_metrics['maxRollVelocityJump'] < 0.02
)

camera_ts = (ROOT / 'lib/cameraTimeline.ts').read_text()
rig_tsx = (ROOT / 'components/scene/CameraRig.tsx').read_text()
profile_ts = (ROOT / 'lib/assetProfile.ts').read_text()
canvas_tsx = (ROOT / 'components/scene/CinematicCanvas.tsx').read_text()

checks = {
    'elevenKeyframes': len(CAMERA_DATA['keyframes']) == 11,
    'coreRevealKeyframeAt5_50': any(abs(float(k['time']) - 5.50) < 1e-9 and k['id'] == 'core_reveal' for k in CAMERA_DATA['keyframes']),
    'focusTargetSeparateFromCompositionTarget': 'focusTarget' in camera_ts and 'distanceTo(focusTarget)' in rig_tsx,
    'c1CameraSpline': continuity_pass,
    'safeFramingAllProfiles661Samples': all_framing_pass,
    'desktopNarrativeCompositionOpposition': composition_pass,
    'touchParallaxDisabled': 'profile.inputMode === "touch" ? 0 : 1' in camera_ts and 'profile.inputMode === "mouse"' in rig_tsx,
    'parallaxAmplitudeReduced': '0.045 * profile.pointerParallax * parallaxGain' in rig_tsx and '0.018 * profile.pointerParallax * parallaxGain' in rig_tsx,
    'nearFarTightened': 'perspective.near = 0.10' in rig_tsx and 'perspective.far = 60' in rig_tsx and 'near: 0.10, far: 60' in canvas_tsx,
    'mobilePortraitSafeProfile': 'cameraDistanceScale: portraitMobile ? 1.52 : 1.16' in profile_ts and 'cameraCompositionScale: portraitMobile ? 0.04 : 0.28' in profile_ts,
    'tabletSafeProfile': 'cameraDistanceScale: 1.24' in profile_ts and 'cameraCompositionScale: 0.24' in profile_ts,
    'activeGlbStillPhase7': 'orb_v3_faz7_desktop.glb' in profile_ts and 'orb_v3_faz7_mobile.glb' in profile_ts,
}
passed = all(checks.values())
report = {
    'phase': 8,
    'passed': passed,
    'checks': checks,
    'continuity': {'passed': continuity_pass, **continuity_metrics, 'keyframes': continuity},
    'composition': {'passed': composition_pass, 'anchors': composition_metrics},
    'framing': {'passed': all_framing_pass, 'profiles': profile_metrics},
}
out = ROOT / 'qa/faz-8/validation_v3_faz8.json'
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
raise SystemExit(0 if passed else 1)
