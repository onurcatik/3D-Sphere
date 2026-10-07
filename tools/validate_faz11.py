#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, struct, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    'package.json','tsconfig.json','app/layout.tsx','app/page.tsx','app/globals.css',
    'components/experience/CinematicExperience.tsx','components/experience/useCinematicScroll.ts',
    'components/scene/CinematicCanvas.tsx','components/scene/OrbModel.tsx','components/scene/CameraRig.tsx',
    'components/scene/SceneLighting.tsx','components/scene/TempleEnvironment.tsx',
    'components/scene/CinematicAtmosphere.tsx','components/scene/CinematicPostFX.tsx',
    'components/scene/VolumetricLightShaft.tsx','components/ui/ScrollNarrative.tsx',
    'lib/assetProfile.ts','lib/scrollTimeline.ts','lib/cinematicLook.ts','lib/types.ts',
    'lib/runtime/cameraRig.js','lib/runtime/coreEnergyRuntime.js',
    'public/models/orb_faz8_web_desktop.glb','public/models/orb_faz8_web_mobile.glb',
    'public/reference/orb-reference.png','spec/cinematic_look.json',
    'spec/FAZ11_CINEMATIC_LIGHTING_POSTFX.md','web_preview/index.html','tools/check_ts_syntax.cjs'
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

results={'phase':'FAZ 11','status':'PASS','checks':{},'look':{},'assets':{},'syntax':{}}
for rel in REQUIRED:
    p=ROOT/rel; ok=p.exists() and p.stat().st_size>0
    results['checks'][f'file:{rel}']=ok
    if not ok: results['status']='FAIL'

look=json.loads((ROOT/'spec/cinematic_look.json').read_text())
keys=look['keyframes']
progress=[k['progress'] for k in keys]
monotonic=progress[0]==0 and progress[-1]==1 and all(b>a for a,b in zip(progress,progress[1:]))
ranges={
    'exposure':(0.7,1.4),'bloomGain':(0.8,1.8),'bloomThreshold':(0.08,0.4),
    'vignetteDarkness':(0.4,0.95),'focalLength':(0.01,0.06),'bokehScale':(0,5),
    'fogDensity':(0.005,0.05),'beamOpacity':(0,1),'dustOpacity':(0,0.5)
}
ranges_ok=True
for field,(lo,hi) in ranges.items():
    ranges_ok &= all(lo <= float(k[field]) <= hi for k in keys)
max_bloom=max(keys,key=lambda k:k['bloomGain'])
min_fog=min(keys,key=lambda k:k['fogDensity'])
climax_ok=max_bloom['id']=='core_cross' and min_fog['id']=='core_cross'
mobile_ok=look['mobilePolicy']['depthOfField'] is False
results['checks']['look_progress_monotonic']=monotonic
results['checks']['look_numeric_ranges']=ranges_ok
results['checks']['climax_peaks_at_core_cross']=climax_ok
results['checks']['mobile_dof_disabled']=mobile_ok
results['look']={
    'keyframes':len(keys),'maxBloom':max_bloom['bloomGain'],'maxBloomAt':max_bloom['id'],
    'minFog':min_fog['fogDensity'],'minFogAt':min_fog['id'],
    'maxExposure':max(k['exposure'] for k in keys),'maxBokeh':max(k['bokehScale'] for k in keys)
}
if not all([monotonic,ranges_ok,climax_ok,mobile_ok]): results['status']='FAIL'

for label,rel in [('desktop','public/models/orb_faz8_web_desktop.glb'),('mobile','public/models/orb_faz8_web_mobile.glb')]:
    p=ROOT/rel; j=glb_json(p); anims={a.get('name',''):a for a in j.get('animations',[])}; nodes={n.get('name','') for n in j.get('nodes',[])}
    ok={'Orb_Main_Cinematic','Ring_Idle','Core_Pulse'}.issubset(anims) and {'ORB_ROOT','CORE_ROOT','SHELL_ROOT','RINGS_ROOT'}.issubset(nodes)
    results['checks'][f'{label}:glb_integrity']=ok
    results['assets'][label]={'bytes':p.stat().st_size,'sha256':sha256(p),'nodes':len(j.get('nodes',[])),'meshes':len(j.get('meshes',[])),'mainChannels':len(anims['Orb_Main_Cinematic'].get('channels',[])) if 'Orb_Main_Cinematic' in anims else 0}
    if not ok: results['status']='FAIL'

source_checks={
    'aces_tonemapping':('components/scene/CinematicAtmosphere.tsx','THREE.ACESFilmicToneMapping'),
    'dynamic_exposure':('components/scene/CinematicAtmosphere.tsx','gl.toneMappingExposure = look.exposure'),
    'exp2_fog':('components/scene/CinematicAtmosphere.tsx','THREE.FogExp2'),
    'dynamic_bloom':('components/scene/CinematicPostFX.tsx','bloomRef.current.intensity = bloomIntensity'),
    'dynamic_dof':('components/scene/CinematicPostFX.tsx','circleOfConfusionMaterial.focusDistance = normalizedFocus'),
    'mobile_dof_gate':('components/scene/CinematicPostFX.tsx','profile.dof &&'),
    'dynamic_vignette':('components/scene/CinematicPostFX.tsx','vignetteRef.current.darkness = look.vignetteDarkness'),
    'volumetric_beam':('components/scene/VolumetricLightShaft.tsx','THREE.AdditiveBlending'),
    'lighting_sampler':('components/scene/SceneLighting.tsx','sampleCinematicLook(progressRef.current)'),
    'dust_sampler':('components/scene/TempleEnvironment.tsx','dustMaterial.current.opacity = look.dustOpacity'),
    'central_scroll_mapper':('components/experience/useCinematicScroll.ts','getScrollTimelineSample(self.progress)'),
    'main_clip_seek':('components/scene/OrbModel.tsx','mixer.setTime(time)'),
    'phase11_status':('components/ui/ScrollNarrative.tsx','FAZ 11')
}
for key,(rel,needle) in source_checks.items():
    txt=(ROOT/rel).read_text(encoding='utf-8'); ok=needle in txt
    results['checks'][key]=ok
    if not ok: results['status']='FAIL'

orb=(ROOT/'components/scene/OrbModel.tsx').read_text()
results['checks']['no_clock_driven_main_clip']='mixer.update(' not in orb
if not results['checks']['no_clock_driven_main_clip']: results['status']='FAIL'

proc=subprocess.run(['node',str(ROOT/'tools/check_ts_syntax.cjs')],cwd=ROOT,text=True,capture_output=True)
try: syntax=json.loads(proc.stdout)
except Exception: syntax={'files':0,'errors':[{'message':proc.stdout+proc.stderr}]}
results['syntax']=syntax
results['checks']['ts_tsx_syntax']=proc.returncode==0 and not syntax.get('errors')
if not results['checks']['ts_tsx_syntax']: results['status']='FAIL'

out=ROOT/'spec/validation_faz11.json'; out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(0 if results['status']=='PASS' else 1)
