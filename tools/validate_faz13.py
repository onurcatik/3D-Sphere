#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, struct, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    'package.json','tsconfig.json','app/layout.tsx','app/page.tsx','app/globals.css',
    'components/experience/CinematicExperience.tsx','components/experience/useCinematicScroll.ts',
    'components/scene/AdaptiveQualityController.tsx','components/scene/CinematicCanvas.tsx',
    'components/scene/OrbModel.tsx','components/scene/CameraRig.tsx','components/scene/SceneLighting.tsx',
    'components/scene/TempleEnvironment.tsx','components/scene/CinematicAtmosphere.tsx',
    'components/scene/CinematicPostFX.tsx','components/scene/VolumetricLightShaft.tsx',
    'components/scene/ParticleEnergyField.tsx','components/ui/ScrollNarrative.tsx',
    'components/ui/ChapterRail.tsx','components/ui/SceneHUD.tsx','lib/assetProfile.ts',
    'lib/scrollTimeline.ts','lib/cinematicLook.ts','lib/particleEnergy.ts','lib/types.ts',
    'lib/runtime/cameraRig.js','lib/runtime/coreEnergyRuntime.js',
    'public/models/orb_faz8_web_desktop.glb','public/models/orb_faz8_web_mobile.glb',
    'public/reference/orb-reference.png','spec/FAZ13_RESPONSIVE_MOBILE.md',
    'spec/responsive_profiles.json','web_preview/index.html','tools/check_ts_syntax.cjs'
]

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def glb_json(path: Path):
    b=path.read_bytes(); magic,version,length=struct.unpack_from('<4sII',b,0)
    if magic!=b'glTF' or version!=2 or length!=len(b): raise ValueError('Invalid GLB header')
    off=12
    while off < len(b):
        clen,ctype=struct.unpack_from('<II',b,off); off+=8
        chunk=b[off:off+clen]; off+=clen
        if ctype==0x4E4F534A: return json.loads(chunk.decode('utf-8').rstrip('\x00 '))
    raise ValueError('JSON chunk not found')

results={'phase':'FAZ 13','status':'PASS','checks':{},'assets':{},'syntax':{},'profiles':{}}
for rel in REQUIRED:
    ok=(ROOT/rel).exists() and (ROOT/rel).stat().st_size>0
    results['checks'][f'file:{rel}']=ok
    if not ok: results['status']='FAIL'

profiles=json.loads((ROOT/'spec/responsive_profiles.json').read_text())
tiers=[p['tier'] for p in profiles['profiles']]
expected=['desktop-high','desktop-balanced','tablet','mobile','low-power']
results['checks']['five_quality_tiers']=tiers==expected
results['checks']['adaptive_dpr_policy']=profiles['adaptiveDpr']['degradeBelowFps']==46 and profiles['adaptiveDpr']['recoverAboveFps']==56.5
results['checks']['native_touch_policy']='native' in profiles['touch']['scrollEngine']
results['profiles']={'tiers':tiers,'adaptiveDpr':profiles['adaptiveDpr'],'touch':profiles['touch']}
for key in ['five_quality_tiers','adaptive_dpr_policy','native_touch_policy']:
    if not results['checks'][key]: results['status']='FAIL'

for label,rel in [('desktop','public/models/orb_faz8_web_desktop.glb'),('mobile','public/models/orb_faz8_web_mobile.glb')]:
    p=ROOT/rel; j=glb_json(p); anims={a.get('name',''):a for a in j.get('animations',[])}; nodes={n.get('name','') for n in j.get('nodes',[])}
    ok={'Orb_Main_Cinematic','Ring_Idle','Core_Pulse'}.issubset(anims) and {'ORB_ROOT','CORE_ROOT','SHELL_ROOT','RINGS_ROOT'}.issubset(nodes)
    results['checks'][f'{label}:glb_integrity']=ok
    results['assets'][label]={'bytes':p.stat().st_size,'sha256':sha256(p),'nodes':len(j.get('nodes',[])),'meshes':len(j.get('meshes',[])),'mainChannels':len(anims['Orb_Main_Cinematic'].get('channels',[])) if 'Orb_Main_Cinematic' in anims else 0}
    if not ok: results['status']='FAIL'

source_checks={
    'adaptive_quality_mounted':('components/scene/CinematicCanvas.tsx','<AdaptiveQualityController profile={profile} runtimeStateRef={runtimeStateRef} />'),
    'adaptive_dpr_downstep':('components/scene/AdaptiveQualityController.tsx','next - 0.1'),
    'adaptive_dpr_upstep':('components/scene/AdaptiveQualityController.tsx','next + 0.05'),
    'mobile_profile_tier':('lib/assetProfile.ts','tier = "mobile"'),
    'low_power_profile_tier':('lib/assetProfile.ts','tier = "low-power"'),
    'orientation_detection':('lib/assetProfile.ts','width >= height ? "landscape" : "portrait"'),
    'native_touch_scroll':('components/experience/useCinematicScroll.ts','const nativeTouch = profile.nativeTouchScroll || profile.inputMode === "touch"'),
    'lenis_skipped_touch':('components/experience/useCinematicScroll.ts','reducedMotion || nativeTouch'),
    'touch_scroll_dataset':('components/experience/useCinematicScroll.ts','native-touch'),
    'camera_distance_scale':('components/scene/CameraRig.tsx','delta.z *= profile.cameraDistanceScale'),
    'camera_orbit_scale':('components/scene/CameraRig.tsx','delta.x *= profile.cameraOrbitScale'),
    'camera_target_y':('components/scene/CameraRig.tsx','target.y += profile.cameraTargetYOffset'),
    'camera_fov_offset':('components/scene/CameraRig.tsx','sample.fov + profile.cameraFovOffset'),
    'environment_dust_lod':('components/scene/TempleEnvironment.tsx','profile.environmentDustCount'),
    'environment_minimal_lod':('components/scene/TempleEnvironment.tsx','profile.environmentDetail !== "minimal"'),
    'beam_segment_lod':('components/scene/VolumetricLightShaft.tsx','profile.beamSegments'),
    'shadow_map_profile':('components/scene/SceneLighting.tsx','profile.shadowMapSize'),
    'low_power_bloom':('components/scene/CinematicPostFX.tsx','profile.tier !== "low-power"'),
    'resize_profile_refresh':('components/experience/CinematicExperience.tsx','window.addEventListener("resize", update'),
    'orientation_profile_refresh':('components/experience/CinematicExperience.tsx','window.addEventListener("orientationchange", update'),
    'chapter_rail_mounted':('components/experience/CinematicExperience.tsx','<ChapterRail />'),
    'scene_hud_mounted':('components/experience/CinematicExperience.tsx','<SceneHUD />'),
    'dynamic_viewport_css':('app/globals.css','100dvh'),
    'safe_area_css':('app/globals.css','env(safe-area-inset-bottom)'),
    'touch_action_css':('app/globals.css','touch-action: pan-y pinch-zoom'),
    'phase13_status':('components/ui/ScrollNarrative.tsx','FAZ 13')
}
for key,(rel,needle) in source_checks.items():
    ok=needle in (ROOT/rel).read_text(encoding='utf-8')
    results['checks'][key]=ok
    if not ok: results['status']='FAIL'

orb=(ROOT/'components/scene/OrbModel.tsx').read_text(encoding='utf-8')
results['checks']['no_clock_driven_main_clip']='mixer.update(' not in orb and 'mixer.setTime(time)' in orb
if not results['checks']['no_clock_driven_main_clip']: results['status']='FAIL'

proc=subprocess.run(['node',str(ROOT/'tools/check_ts_syntax.cjs')],cwd=ROOT,text=True,capture_output=True)
try: syntax=json.loads(proc.stdout)
except Exception: syntax={'files':0,'errors':[{'message':proc.stdout+proc.stderr}]}
results['syntax']=syntax
results['checks']['ts_tsx_syntax']=proc.returncode==0 and not syntax.get('errors')
if not results['checks']['ts_tsx_syntax']: results['status']='FAIL'

for label,rel in [('core','lib/runtime/coreEnergyRuntime.js'),('camera','lib/runtime/cameraRig.js')]:
    jsproc=subprocess.run(['node','--check',str(ROOT/rel)],cwd=ROOT,text=True,capture_output=True)
    results['checks'][f'{label}_runtime_js_syntax']=jsproc.returncode==0
    if jsproc.returncode!=0: results['status']='FAIL'

pkg=json.loads((ROOT/'package.json').read_text())
results['checks']['package_phase13']=pkg.get('name')=='3d-premium-website-faz13' and pkg.get('scripts',{}).get('validate')=='python3 tools/validate_faz13.py'
if not results['checks']['package_phase13']: results['status']='FAIL'

out=ROOT/'spec/validation_faz13.json'; out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(0 if results['status']=='PASS' else 1)
