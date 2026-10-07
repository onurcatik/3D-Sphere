#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
QA = ROOT / "qa/faz-10"
RUNTIME = QA / "runtime"
QA.mkdir(parents=True, exist_ok=True)
RUNTIME.mkdir(parents=True, exist_ok=True)


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


tsc = shutil.which("tsc")
if not tsc:
    raise SystemExit("TypeScript compiler not found")

sources = [
    ROOT / "lib/scrollTimeline.ts",
    ROOT / "lib/cameraTimeline.ts",
    ROOT / "lib/cinematicLook.ts",
    ROOT / "lib/particleEnergy.ts",
    ROOT / "lib/coreEnergyTimeline.ts",
    ROOT / "lib/lightingTimeline.ts",
    ROOT / "lib/postProcessingBudget.ts",
    ROOT / "lib/particleBudget.ts",
]
compile_cmd = [
    tsc,
    *[str(path) for path in sources],
    "--target", "ES2020",
    "--module", "commonjs",
    "--skipLibCheck",
    "--outDir", str(RUNTIME),
]
compile_result = subprocess.run(compile_cmd, cwd=ROOT, text=True, capture_output=True)
(QA / "targeted_compile.txt").write_text((compile_result.stdout or "") + (compile_result.stderr or ""))
if compile_result.returncode != 0:
    raise SystemExit(compile_result.returncode)

node = shutil.which("node")
if not node:
    raise SystemExit("Node.js not found")

node_program = r'''
const path = require('path');
const runtime = process.argv[1];
const choreographyPath = process.argv[2];
const { sampleCameraTimeline } = require(path.join(runtime, 'cameraTimeline.js'));
const { sampleCinematicLook } = require(path.join(runtime, 'cinematicLook.js'));
const { sampleParticleEnergy } = require(path.join(runtime, 'particleEnergy.js'));
const { sampleCoreEnergy } = require(path.join(runtime, 'coreEnergyTimeline.js'));
const { sampleLighting } = require(path.join(runtime, 'lightingTimeline.js'));
const { samplePostProcessingBudget, getComposerMultisampling } = require(path.join(runtime, 'postProcessingBudget.js'));
const { getParticleBudget } = require(path.join(runtime, 'particleBudget.js'));
const choreography = require(choreographyPath);
const clamp01 = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const smoothstep = (a,b,x) => { if (b <= a) return x >= b ? 1 : 0; const t=clamp01((x-a)/(b-a)); return t*t*(3-2*t); };
const shockwave = time => clamp01(
  smoothstep(choreography.breakupStart, choreography.breakupStart + 0.14, time)
  * (1 - smoothstep(choreography.breakupStart + 0.18, choreography.breakupStart + 0.82, time))
);
const profiles = {
  'desktop-high': {tier:'desktop-high',dof:true,antialias:true},
  'desktop-balanced': {tier:'desktop-balanced',dof:true,antialias:true},
  'tablet': {tier:'tablet',dof:false,antialias:true},
  'mobile': {tier:'mobile',dof:false,antialias:true},
  'low-power': {tier:'low-power',dof:false,antialias:false},
};
const fields = ['highlightPressure','saturationRisk','bloomIntensity','bloomThreshold','bloomSmoothing','additiveGain','particleGain','pointScaleGain','debrisGain','dustGain','shaftGain','dofGain','bokehScale','vignetteDarkness'];
const result = {samplesPerProfile:10001, profiles:{}, particleBudgets:{}};
for (const [name, profile] of Object.entries(profiles)) {
  const mins=Object.fromEntries(fields.map(k=>[k,Infinity]));
  const maxs=Object.fromEntries(fields.map(k=>[k,-Infinity]));
  let bad=0, maxStep=0, previous=null;
  for(let i=0;i<=10000;i++){
    const time=11*i/10000, progress=time/11;
    const state=samplePostProcessingBudget({
      look:sampleCinematicLook(progress),
      coreEnergy:sampleCoreEnergy(time),
      lighting:sampleLighting(time),
      breakup:{shockwave:shockwave(time)},
      particle:sampleParticleEnergy(progress),
      cameraBloom:sampleCameraTimeline(progress).bloom,
      profile
    });
    for(const field of fields){
      const value=state[field];
      if(!Number.isFinite(value)) bad++;
      mins[field]=Math.min(mins[field],value);
      maxs[field]=Math.max(maxs[field],value);
      if(previous) maxStep=Math.max(maxStep,Math.abs(value-previous[field]));
    }
    previous=state;
  }
  const critical={};
  for(const time of [0,3.08,4.3,5.5,6.93,7.92,10.34,11]){
    const progress=time/11;
    critical[time.toFixed(2)]=samplePostProcessingBudget({
      look:sampleCinematicLook(progress),
      coreEnergy:sampleCoreEnergy(time),
      lighting:sampleLighting(time),
      breakup:{shockwave:shockwave(time)},
      particle:sampleParticleEnergy(progress),
      cameraBloom:sampleCameraTimeline(progress).bloom,
      profile
    });
  }
  result.profiles[name]={mins,maxs,bad,maxStep,critical,multisampling:getComposerMultisampling(profile)};
  result.particleBudgets[name]=getParticleBudget({tier:name});
}
process.stdout.write(JSON.stringify(result,null,2));
'''

sample_result = subprocess.run(
    [node, "-e", node_program, str(RUNTIME), str(ROOT / "spec/v3/orb_breakup_choreography.json")],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
if sample_result.returncode != 0:
    (QA / "postfx_sample_error.txt").write_text((sample_result.stdout or "") + (sample_result.stderr or ""))
    raise SystemExit(sample_result.returncode)
(QA / "postfx_budget_audit.json").write_text(sample_result.stdout + "\n")
audit = json.loads(sample_result.stdout)

# Archive baseline saturation metric. This is not a current render pass.
saturation_cmd = [
    "python3", str(ROOT / "tools/analyze_frame_saturation.py"),
    str(ROOT / "visual-baseline/desktop"),
    "--output", str(QA / "baseline_saturation_audit.json"),
]
saturation_result = subprocess.run(saturation_cmd, cwd=ROOT, text=True, capture_output=True)
(QA / "saturation_tool.log").write_text((saturation_result.stdout or "") + (saturation_result.stderr or ""))
if saturation_result.returncode != 0:
    raise SystemExit(saturation_result.returncode)
baseline_saturation = json.loads((QA / "baseline_saturation_audit.json").read_text())

postfx = (ROOT / "components/scene/CinematicPostFX.tsx").read_text()
particle_field = (ROOT / "components/scene/ParticleEnergyField.tsx").read_text()
orb_model = (ROOT / "components/scene/OrbModel.tsx").read_text()
fracture = (ROOT / "components/scene/ShellFractureFX.tsx").read_text()
temple = (ROOT / "components/scene/TempleEnvironment.tsx").read_text()
shaft = (ROOT / "components/scene/VolumetricLightShaft.tsx").read_text()
scene_timeline = (ROOT / "lib/sceneTimeline.ts").read_text()
core_runtime = (ROOT / "lib/runtime/coreEnergyRuntime.js").read_text()
reassembly_runtime = (ROOT / "lib/runtime/reassemblyRuntime.js").read_text()
css = (ROOT / "app/globals.css").read_text()

particle_caps_ok = all(item["total"] <= item["cap"] for item in audit["particleBudgets"].values())
mobile_caps_ok = all(audit["particleBudgets"][name]["total"] <= 1000 for name in ["mobile", "low-power"])
desktop_caps_ok = all(audit["particleBudgets"][name]["total"] <= 3000 for name in ["desktop-high", "desktop-balanced", "tablet"])
all_finite = all(profile["bad"] == 0 for profile in audit["profiles"].values())
max_risk = max(profile["maxs"]["saturationRisk"] for profile in audit["profiles"].values())
max_bloom = max(profile["maxs"]["bloomIntensity"] for profile in audit["profiles"].values())
min_threshold = min(profile["mins"]["bloomThreshold"] for profile in audit["profiles"].values())
max_bokeh = max(profile["maxs"]["bokehScale"] for profile in audit["profiles"].values())
max_step = max(profile["maxStep"] for profile in audit["profiles"].values())

# Reference hashes are the unchanged FAZ 7 assets recorded since FAZ 7.
desktop_glb = ROOT / "public/models/orb_v3_faz7_desktop.glb"
mobile_glb = ROOT / "public/models/orb_v3_faz7_mobile.glb"
expected_desktop = "b791a252abb0ef542c113ebd3455b4fcea257cf4184cdf762b624be990b8035c"
expected_mobile = "f5ca166be26a826855cc40856dd66b318283e8f8e3cf91625f348078bab27e65"

checks = {
    "postFxBudgetIsSceneSampleState": "postFx: PostProcessingBudget;" in scene_timeline and "postFx = samplePostProcessingBudget" in scene_timeline,
    "postFxDenseSamplingFinite": all_finite,
    "postFxDenseSamplingSmooth": max_step < 0.01,
    "analyticSaturationRiskBounded": max_risk <= 0.85,
    "bloomIntensityBounded": max_bloom <= 0.68,
    "bloomThresholdSelective": min_threshold >= 1.06,
    "dofBokehRestrained": max_bokeh <= 1.18,
    "composerUsesExplicitMultisampling": "<EffectComposer multisampling={multisampling}>" in postfx and "getComposerMultisampling" in postfx,
    "desktopComposerMsaaConfigured": audit["profiles"]["desktop-high"]["multisampling"] == 4 and audit["profiles"]["desktop-balanced"]["multisampling"] == 2,
    "mobileComposerMsaaDisabled": audit["profiles"]["mobile"]["multisampling"] == 0 and audit["profiles"]["low-power"]["multisampling"] == 0,
    "mobileDofDisabled": audit["profiles"]["mobile"]["maxs"]["bokehScale"] == 0 and audit["profiles"]["low-power"]["maxs"]["bokehScale"] == 0,
    "particleCapsPass": particle_caps_ok and mobile_caps_ok and desktop_caps_ok,
    "particleFieldUsesCentralBudget": "getParticleBudget(profile)" in particle_field and "profile.particleCount" not in particle_field,
    "coreParticlesUseCentralBudget": "particleBudget.core" in orb_model and "profile.particleCount" not in orb_model,
    "fractureDebrisUsesCentralBudget": "getParticleBudget(profile).debris" in fracture,
    "environmentDustUsesCentralBudget": "getParticleBudget(profile).dust" in temple and "profile.environmentDustCount" not in temple,
    "particleOpacityUsesPostFxGain": "sceneSample.postFx.particleGain" in particle_field,
    "particlePointSizeUsesPostFxGain": "sceneSample.postFx.pointScaleGain" in particle_field,
    "fractureUsesPostFxGain": "sample.postFx.debrisGain" in fracture and "sample.postFx.additiveGain" in fracture,
    "shaftUsesPostFxGain": "sample.postFx.shaftGain" in shaft,
    "coreRuntimeHasVisualBudget": "function setVisualBudget" in core_runtime and "state.visualGain" in core_runtime and "particleBudgetGain" in core_runtime,
    "orbModelFeedsCoreVisualBudget": "runtime.setVisualBudget" in orb_model,
    "reassemblyUsesVisualBudget": "visualGain = 1" in reassembly_runtime and "sample.postFx.additiveGain" in orb_model,
    "mainParticlesHaveConservativeBounds": "boundingSphere = new THREE.Sphere(new THREE.Vector3(), 7.2)" in particle_field and "frustumCulled renderOrder={5}" in particle_field,
    "coreParticlesHaveConservativeBounds": "g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),3.4)" in core_runtime and "particles.frustumCulled=true" in core_runtime,
    "fractureParticlesUseBoundedCulling": "geometry.boundingSphere.radius = 4.8" in fracture and "frustumCulled />" in fracture,
    "noChromaticAberrationPass": "ChromaticAberration" not in postfx,
    "grainIsRestrained": "opacity: 0.022" in css and 'data-device-tier="mobile"] .grain { opacity: .010; }' in css,
    "baselineSaturationMetricEstablished": baseline_saturation["maxNearWhiteRatio"] > 0.20 and baseline_saturation["warnings"] >= 1,
    "desktopGlbUnchanged": sha256(desktop_glb) == expected_desktop,
    "mobileGlbUnchanged": sha256(mobile_glb) == expected_mobile,
}

# Regression and syntax checks use the earlier phase validators after their semantic
# integration checks were widened to accept equivalent local-variable SceneSample assembly.
regressions = {}
for phase in (1, 2, 5, 6, 7, 8, 9):
    proc = subprocess.run(["python3", str(ROOT / f"tools/validate_v3_faz{phase}.py")], cwd=ROOT, text=True, capture_output=True)
    (QA / f"regression_faz{phase}.log").write_text((proc.stdout or "") + (proc.stderr or ""))
    regressions[f"faz{phase}"] = proc.returncode == 0
    checks[f"faz{phase}Regression"] = proc.returncode == 0

syntax_proc = subprocess.run([node, str(ROOT / "tools/check_ts_syntax.cjs")], cwd=ROOT, text=True, capture_output=True)
(QA / "ts_syntax.json").write_text(syntax_proc.stdout or "{}")
checks["tsTsxSyntax"] = syntax_proc.returncode == 0
for name, relative in [("coreRuntimeJsSyntax", "lib/runtime/coreEnergyRuntime.js"), ("reassemblyRuntimeJsSyntax", "lib/runtime/reassemblyRuntime.js")]:
    proc = subprocess.run([node, "--check", str(ROOT / relative)], cwd=ROOT, text=True, capture_output=True)
    (QA / f"{name}.log").write_text((proc.stdout or "") + (proc.stderr or ""))
    checks[name] = proc.returncode == 0

report = {
    "phase": 10,
    "passed": all(checks.values()),
    "checks": checks,
    "summary": {
        "maxAnalyticSaturationRisk": max_risk,
        "maxBloomIntensity": max_bloom,
        "minBloomThreshold": min_threshold,
        "maxBokehScale": max_bokeh,
        "maxPostFxAdjacentStep": max_step,
        "particleBudgets": audit["particleBudgets"],
        "archivalBaselineMaxNearWhiteRatio": baseline_saturation["maxNearWhiteRatio"],
        "archivalBaselineMaxHighLumaRatio": baseline_saturation["maxHighLumaRatio"],
        "archivalBaselineWarnings": baseline_saturation["warnings"],
        "regressions": regressions,
    },
}
(QA / "validation_v3_faz10.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
raise SystemExit(0 if report["passed"] else 1)
