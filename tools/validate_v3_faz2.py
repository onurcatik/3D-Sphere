#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa/faz-2/validation_v3_faz2.json'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def text(rel: str) -> str:
    return (ROOT / rel).read_text()

checks: dict[str, bool] = {}
components = list((ROOT / 'components').rglob('*.tsx')) + list((ROOT / 'components').rglob('*.ts'))
lib_sources = list((ROOT / 'lib').rglob('*.js')) + list((ROOT / 'lib').rglob('*.ts'))
all_runtime_text = '\n'.join(p.read_text() for p in components + lib_sources)

checks['no_state_clock_elapsedTime_in_components_or_lib'] = 'state.clock.elapsedTime' not in all_runtime_text
checks['no_incremental_rotation_in_core_runtime'] = 'rotation +=' not in text('lib/runtime/coreEnergyRuntime.js') and 'rotation -=' not in text('lib/runtime/coreEnergyRuntime.js')
checks['core_runtime_uses_absolute_base_rotations'] = all(token in text('lib/runtime/coreEnergyRuntime.js') for token in ['ribbonsBase', 'ringsBase', 'o.rotation.y=base.y+t', 'o.rotation.z=base.z+t'])
checks['particle_uses_integrated_flow_time'] = all(token in text('components/scene/ParticleEnergyField.tsx') for token in ['uniform float uFlowTime;', 'material.uniforms.uFlowTime.value = sceneSample.flowTime'])
checks['particle_shader_no_uFlowSpeed_multiplier'] = 'uFlowSpeed' not in text('components/scene/ParticleEnergyField.tsx')
checks['scene_sample_exposes_flow_time'] = 'flowTime: CINEMATIC_DURATION_SECONDS * integrateParticleFlowProgress(cinematicProgress)' in text('lib/sceneTimeline.ts')
checks['flow_integral_is_analytic'] = 'smootherIntegral' in text('lib/particleEnergy.ts') and 'integrateParticleFlowProgress' in text('lib/particleEnergy.ts')
checks['beam_uses_scene_time'] = 'Math.sin(sample.sceneTime * 1.45)' in text('components/scene/VolumetricLightShaft.tsx')
checks['ambient_dust_uses_scene_time'] = 'dustGroup.current.rotation.y = sample.sceneTime * 0.004' in text('components/scene/TempleEnvironment.tsx')

numeric_reverse_smoothsteps = []
pattern = re.compile(r'smoothstep\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))')
for path in components + lib_sources:
    src = path.read_text()
    for m in pattern.finditer(src):
        a, b = float(m.group(1)), float(m.group(2))
        if a >= b:
            numeric_reverse_smoothsteps.append({'file': str(path.relative_to(ROOT)), 'edge0': a, 'edge1': b})
checks['no_numeric_reverse_or_equal_smoothstep'] = not numeric_reverse_smoothsteps
checks['particle_safe_normalize_guard'] = 'jitterAxisLengthSq = max(dot(jitterAxis, jitterAxis), 1e-8)' in text('components/scene/ParticleEnergyField.tsx')
checks['core_shader_safe_normalize_guard'] = 'safeNormalize' in text('lib/runtime/coreEnergyRuntime.js') and 'max(dot(v,v), 1e-8)' in text('lib/runtime/coreEnergyRuntime.js')

orb = text('components/scene/OrbModel.tsx')
seek = text('lib/runtime/seekAnimationAction.js')
asset_test = text('tests/assets.test.mjs')
checks['orb_uses_shared_seek_helper'] = 'configureSeekableAction(action, THREE.LoopOnce)' in orb and 'seekAnimationAction(mixer, action, time, clip.duration)' in orb
checks['seek_helper_rearms_enabled_paused'] = all(token in seek for token in ['action.enabled = true;', 'action.paused = false;', 'mixer.setTime(time);'])
checks['asset_test_uses_same_seek_helper'] = 'configureSeekableAction' in asset_test and 'seekAnimationAction' in asset_test
checks['standalone_seek_test_passed'] = (ROOT / 'qa/faz-2/seek_helper_test.exit').read_text().strip() == '0'

core = text('lib/runtime/coreEnergyRuntime.js')
checks['runtime_tracks_material_restoration'] = all(token in core for token in ['materialRestorations', 'ownedMaterials', 'mesh.material=original', 'ownedMaterials.forEach(material=>material.dispose())'])
checks['orb_tracks_base_material_cleanup'] = 'baseMaterials.forEach((material) => material.dispose())' in orb
checks['crystal_transmission_scoped_to_crystal_targets'] = 'crystalTargets.forEach' in core

flow_result = json.loads((ROOT / 'qa/faz-2/flow_time_test.json').read_text())
checks['flow_time_test_passed'] = flow_result.get('status') == 'PASS' and flow_result.get('samplesChecked') == 10001
checks['flow_time_derivative_matches_speed'] = float(flow_result.get('maxDerivativeError', 1)) < 1e-5
checks['ts_tsx_syntax_passed'] = json.loads((ROOT / 'qa/faz-2/ts_syntax.json').read_text()).get('errors') == []
checks['scene_timeline_targeted_compile_passed'] = (ROOT / 'qa/faz-2/scene_timeline_compile.exit').read_text().strip() == '0'
checks['core_runtime_js_syntax_passed'] = (ROOT / 'qa/faz-2/core_runtime_syntax.exit').read_text().strip() == '0'
checks['seek_runtime_js_syntax_passed'] = (ROOT / 'qa/faz-2/seek_runtime_syntax.exit').read_text().strip() == '0'
checks['faz1_regression_passed'] = (ROOT / 'qa/faz-2/faz1_regression.exit').read_text().strip() == '0'

state = json.loads((ROOT / 'PROJECT_STATE.json').read_text())
for name, data in state.get('assets', {}).items():
    path = ROOT / 'public/models' / name
    checks[f'{name}:unchanged'] = path.exists() and sha256(path) == data['sha256']

three_integration_exit = (ROOT / 'qa/faz-2/assets_three_test.exit').read_text().strip()
three_integration_log = (ROOT / 'qa/faz-2/assets_three_test.log').read_text()
blocked = three_integration_exit != '0' and "Cannot find package 'three'" in three_integration_log

status = 'PASS' if all(checks.values()) else 'FAIL'
result = {
    'phase': 'CHATGPT V3 FAZ 2',
    'status': status,
    'checks': checks,
    'diagnostics': {
        'numericReverseSmoothsteps': numeric_reverse_smoothsteps,
        'flowTime': flow_result,
        'actualThreeAnimationMixerIntegration': 'BLOCKED_DEPENDENCIES' if blocked else ('PASS' if three_integration_exit == '0' else 'FAIL'),
    },
    'environmentBlockers': [
        "Actual Three.js AnimationMixer + GLB integration test cannot run because node_modules is absent and the 'three' package cannot be resolved."
    ] if blocked else [],
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if status == 'PASS' else 1)
