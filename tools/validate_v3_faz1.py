#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'spec/v3/scene_timeline.json'
OUT = ROOT / 'qa/faz-1/validation_v3_faz1.json'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def monotone_slopes(xs: list[float], ys: list[float]) -> list[float]:
    delta = [(ys[i + 1] - ys[i]) / max(1e-12, xs[i + 1] - xs[i]) for i in range(len(xs) - 1)]
    slopes = [0.0] * len(xs)
    slopes[0] = delta[0]
    slopes[-1] = delta[-1]
    for i in range(1, len(xs) - 1):
        slopes[i] = (delta[i - 1] + delta[i]) * 0.5
    for i, d in enumerate(delta):
        if abs(d) < 1e-12:
            slopes[i] = slopes[i + 1] = 0.0
            continue
        alpha, beta = slopes[i] / d, slopes[i + 1] / d
        magnitude = alpha * alpha + beta * beta
        if magnitude > 9:
            scale = 3 / math.sqrt(magnitude)
            slopes[i] = scale * alpha * d
            slopes[i + 1] = scale * beta * d
    return slopes


def hermite(x: float, xs: list[float], ys: list[float], slopes: list[float]) -> float:
    x = max(0.0, min(1.0, x))
    index = len(xs) - 2
    for i in range(len(xs) - 1):
        if x >= xs[i] and (x < xs[i + 1] or i == len(xs) - 2):
            index = i
            break
    width = max(1e-12, xs[index + 1] - xs[index])
    t = max(0.0, min(1.0, (x - xs[index]) / width))
    t2, t3 = t * t, t * t * t
    h00, h10 = 2 * t3 - 3 * t2 + 1, t3 - 2 * t2 + t
    h01, h11 = -2 * t3 + 3 * t2, t3 - t2
    return h00 * ys[index] + h10 * width * slopes[index] + h01 * ys[index + 1] + h11 * width * slopes[index + 1]


spec = json.loads(SPEC.read_text())
segments = spec['segments']
duration = float(spec['durationSeconds'])
xs = [segments[0]['scroll'][0]] + [s['scroll'][1] for s in segments]
ys_seconds = [segments[0]['timeSeconds'][0]] + [s['timeSeconds'][1] for s in segments]
ys = [v / duration for v in ys_seconds]
slopes = monotone_slopes(xs, ys)

checks: dict[str, bool] = {}
checks['duration_11s'] = abs(duration - 11.0) < 1e-12
checks['critical_times'] = spec['criticalTimesSeconds'] == [0.0, 1.54, 3.08, 5.5, 6.93, 7.92, 10.34, 11.0]
checks['mapping_monotone_hermite'] = spec['mapping'] == 'monotone-cubic-hermite'
checks['scroll_endpoints'] = abs(xs[0]) < 1e-12 and abs(xs[-1] - 1.0) < 1e-12
checks['time_endpoints'] = abs(ys_seconds[0]) < 1e-12 and abs(ys_seconds[-1] - 11.0) < 1e-12
checks['positive_boundary_slopes'] = all(v > 0 for v in slopes)

samples = [hermite(i / 10000, xs, ys, slopes) for i in range(10001)]
checks['10001_samples_monotonic'] = all(b + 1e-12 >= a for a, b in zip(samples, samples[1:]))
checks['10001_samples_in_range'] = min(samples) >= -1e-12 and max(samples) <= 1 + 1e-12

for scroll, seconds in zip(xs, ys_seconds):
    mapped = hermite(scroll, xs, ys, slopes) * duration
    checks[f'boundary_{scroll:.2f}_{seconds:.2f}s'] = abs(mapped - seconds) < 1e-9

source = (ROOT / 'lib/scrollTimeline.ts').read_text()
checks['source_has_critical_times'] = all(str(v) in source for v in ['1.54', '3.08', '5.50', '6.93', '7.92', '10.34', '11.00'])
checks['source_declares_monotone_mapping'] = 'monotone-cubic-hermite' in source
checks['single_scene_sampler'] = 'export function sampleScene' in (ROOT / 'lib/sceneTimeline.ts').read_text()
checks['driver_samples_once'] = 'sampleScene(runtime.sceneTime, profile)' in (ROOT / 'components/scene/SceneTimelineDriver.tsx').read_text()

consumers = [
    'components/scene/OrbModel.tsx',
    'components/scene/CameraRig.tsx',
    'components/scene/SceneLighting.tsx',
    'components/scene/CinematicAtmosphere.tsx',
    'components/scene/CinematicPostFX.tsx',
    'components/scene/ParticleEnergyField.tsx',
    'components/scene/VolumetricLightShaft.tsx',
    'components/scene/TempleEnvironment.tsx',
]
checks['all_consumers_use_scene_sample'] = all('sceneSample' in (ROOT / rel).read_text() for rel in consumers)
checks['no_consumer_samples_look_directly'] = all('sampleCinematicLook' not in (ROOT / rel).read_text() for rel in consumers)
checks['no_consumer_samples_particle_directly'] = all('sampleParticleEnergy' not in (ROOT / rel).read_text() for rel in consumers)
checks['camera_keyframes_single_source'] = (
    'export const CAMERA_KEYFRAMES:' in (ROOT / 'lib/cameraTimeline.ts').read_text()
    and 'export const CAMERA_KEYFRAMES = [' not in (ROOT / 'lib/runtime/cameraRig.js').read_text()
)

phase0 = json.loads((ROOT / 'PROJECT_STATE.json').read_text())
for name, data in phase0.get('assets', {}).items():
    path = ROOT / 'public/models' / name
    checks[f'{name}:unchanged'] = path.exists() and sha256(path) == data['sha256']

status = 'PASS' if all(checks.values()) else 'FAIL'
result = {
    'phase': 'CHATGPT V3 FAZ 1',
    'status': status,
    'checks': checks,
    'mapping': {
        'samples': 10001,
        'slopes': slopes,
        'min': min(samples),
        'max': max(samples),
    },
    'deferredToPhase2': [
        'coreEnergyRuntime elapsed time',
        'particle shader elapsed time',
        'volumetric beam pulse elapsed time',
        'ambient dust elapsed time',
        'reverse-edge smoothstep cleanup',
        'AnimationAction final-to-reverse hardening',
    ],
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if status == 'PASS' else 1)
