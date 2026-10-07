#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
QA = ROOT / 'qa/faz-9'
RUNTIME = QA / 'runtime'
QA.mkdir(parents=True, exist_ok=True)
RUNTIME.mkdir(parents=True, exist_ok=True)

# Compile the dependency-free lighting timeline and sample it densely.
tsc = shutil.which('tsc')
if not tsc:
    raise SystemExit('TypeScript compiler not found')
compile_cmd = [
    tsc, str(ROOT / 'lib/lightingTimeline.ts'), '--target', 'ES2020', '--module', 'commonjs',
    '--skipLibCheck', '--outDir', str(RUNTIME)
]
compile_result = subprocess.run(compile_cmd, cwd=ROOT, text=True, capture_output=True)
(QA / 'targeted_compile.txt').write_text((compile_result.stdout or '') + (compile_result.stderr or ''))
if compile_result.returncode != 0:
    raise SystemExit(compile_result.returncode)

node = shutil.which('node')
if not node:
    raise SystemExit('Node.js not found')
node_program = r'''
const { sampleLighting, LIGHTING_KEYFRAMES } = require(process.argv[1]);
const fields = Object.keys(sampleLighting(0));
let bad = 0;
let maxDelta = 0;
let previous = sampleLighting(0);
let mins = Object.fromEntries(fields.map(k => [k, Infinity]));
let maxs = Object.fromEntries(fields.map(k => [k, -Infinity]));
for (let i = 0; i <= 10000; i += 1) {
  const time = 11 * i / 10000;
  const state = sampleLighting(time);
  for (const field of fields) {
    const value = state[field];
    if (!Number.isFinite(value)) bad += 1;
    mins[field] = Math.min(mins[field], value);
    maxs[field] = Math.max(maxs[field], value);
    if (i > 0) maxDelta = Math.max(maxDelta, Math.abs(value - previous[field]));
  }
  previous = state;
}
const result = {
  samples: 10001,
  keyframes: LIGHTING_KEYFRAMES.length,
  bad,
  maxDelta,
  mins,
  maxs,
  critical: {
    hero: sampleLighting(0),
    unlock: sampleLighting(3.08),
    core: sampleLighting(5.5),
    recall: sampleLighting(7.92),
    seal: sampleLighting(10.34),
    final: sampleLighting(11)
  }
};
process.stdout.write(JSON.stringify(result, null, 2));
'''
lighting_js = RUNTIME / 'lightingTimeline.js'
sample_result = subprocess.run([node, '-e', node_program, str(lighting_js)], cwd=ROOT, text=True, capture_output=True)
if sample_result.returncode != 0:
    (QA / 'lighting_sample_error.txt').write_text((sample_result.stdout or '') + (sample_result.stderr or ''))
    raise SystemExit(sample_result.returncode)
(QA / 'lighting_timeline_audit.json').write_text(sample_result.stdout + '\n')
audit = json.loads(sample_result.stdout)

scene_timeline = (ROOT / 'lib/sceneTimeline.ts').read_text()
lighting_timeline = (ROOT / 'lib/lightingTimeline.ts').read_text()
scene_lighting = (ROOT / 'components/scene/SceneLighting.tsx').read_text()
material_env = (ROOT / 'components/scene/MaterialEnvironment.tsx').read_text()
temple = (ROOT / 'components/scene/TempleEnvironment.tsx').read_text()
atmosphere = (ROOT / 'components/scene/CinematicAtmosphere.tsx').read_text()
shaft = (ROOT / 'components/scene/VolumetricLightShaft.tsx').read_text()
canvas = (ROOT / 'components/scene/CinematicCanvas.tsx').read_text()
asset_profile = (ROOT / 'lib/assetProfile.ts').read_text()

core = audit['critical']['core']
final = audit['critical']['final']

numeric_smoothstep_errors = []
for relative in [
    'components/scene/TempleEnvironment.tsx',
    'components/scene/VolumetricLightShaft.tsx',
    'components/scene/CinematicAtmosphere.tsx',
    'components/scene/SceneLighting.tsx',
]:
    text = (ROOT / relative).read_text()
    for match in re.finditer(r'smoothstep\(\s*([0-9.]+)\s*,\s*([0-9.]+)', text):
        a, b = float(match.group(1)), float(match.group(2))
        if a >= b:
            numeric_smoothstep_errors.append({'file': relative, 'a': a, 'b': b})

checks = {
    'lightingTimelineHasTenKeyframes': audit['keyframes'] == 10,
    'lightingTimelineDenseSamplingFinite': audit['samples'] == 10001 and audit['bad'] == 0,
    'lightingTimelineSmoothDenseSampling': audit['maxDelta'] < 0.001,
    'coreExposureTrimProtectsHighlights': core['exposureTrim'] <= 0.95,
    'coreFogOpensForDepth': core['fogDensityScale'] <= 0.80,
    'coreEnvironmentSupportsMetal': core['environmentGain'] >= 1.0,
    'contactShadowReturnsAtFinal': final['contactShadowOpacity'] > core['contactShadowOpacity'],
    'sceneSampleOwnsLightingState': 'lighting: LightingState;' in scene_timeline and (('lighting: sampleLighting(clampedTime)' in scene_timeline) or ('const lighting = sampleLighting(clampedTime);' in scene_timeline and 'lighting,' in scene_timeline)),
    'singleShadowCastingKeyLight': scene_lighting.count('castShadow={profile.shadows === "high"}') == 1,
    'separateKeyFillRimCoreLights': all(token in scene_lighting for token in ['ref={key}', 'ref={warmRim}', 'ref={coolFill}', 'ref={coreKey}']),
    'environmentIntensityIsTimelineDriven': 'sample.lighting.environmentGain' in material_env and 'scene.environmentIntensity' in material_env,
    'localPmremNoExternalHdrDependency': 'RoomEnvironment' in material_env and 'PMREMGenerator' in material_env,
    'floorHasControlledPhysicalResponse': 'lighting.floorRoughness' in temple and 'lighting.floorMetalness' in temple,
    'contactShadowIsRadialAndDynamic': 'uOpacity' in temple and 'lighting.contactShadowOpacity' in temple and 'smoothstep(0.06, 0.96, d)' in temple,
    'templeHasDepthLayers': all(token in temple for token in ['z={-2.6}', 'z={-6.5}', 'z={-10.2}']),
    'fogDensityIsLightingDriven': 'look.fogDensity * lighting.fogDensityScale' in atmosphere,
    'clearColorIsSeparateFromFogColor': 'clearColor.copy' in atmosphere and 'fogColor.copy' in atmosphere,
    'volumetricShaftUsesLightingGain': 'lighting.shaftGain' in shaft,
    'volumetricShaftDepthTestsWithoutDepthWrite': 'depthTest' in shaft and 'depthWrite={false}' in shaft,
    'materialEnvironmentReceivesRuntimeState': '<MaterialEnvironment profile={profile} runtimeStateRef={runtimeStateRef} />' in canvas,
    'phase7GlbsRemainActive': 'orb_v3_faz7_desktop.glb' in asset_profile and 'orb_v3_faz7_mobile.glb' in asset_profile,
    'noInvalidNumericSmoothstep': len(numeric_smoothstep_errors) == 0,
}

passed = all(checks.values())
report = {
    'phase': 9,
    'passed': passed,
    'checks': checks,
    'lightingAudit': audit,
    'numericSmoothstepErrors': numeric_smoothstep_errors,
}
(QA / 'validation_v3_faz9.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
raise SystemExit(0 if passed else 1)
