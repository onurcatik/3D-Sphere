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
    'components/scene/VolumetricLightShaft.tsx','components/scene/ParticleEnergyField.tsx',
    'components/ui/ScrollNarrative.tsx','lib/assetProfile.ts','lib/scrollTimeline.ts','lib/cinematicLook.ts',
    'lib/particleEnergy.ts','lib/types.ts','lib/runtime/cameraRig.js','lib/runtime/coreEnergyRuntime.js',
    'public/models/orb_faz8_web_desktop.glb','public/models/orb_faz8_web_mobile.glb',
    'public/reference/orb-reference.png','spec/particle_energy.json','spec/FAZ12_PARTICLE_ENERGY_FIELD.md',
    'web_preview/index.html','tools/check_ts_syntax.cjs'
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

results={'phase':'FAZ 12','status':'PASS','checks':{},'particleEnergy':{},'assets':{},'syntax':{}}
for rel in REQUIRED:
    ok=(ROOT/rel).exists() and (ROOT/rel).stat().st_size>0
    results['checks'][f'file:{rel}']=ok
    if not ok: results['status']='FAIL'

pe=json.loads((ROOT/'spec/particle_energy.json').read_text())
keys=pe['keyframes']; progress=[float(k['progress']) for k in keys]
monotonic=progress[0]==0 and progress[-1]==1 and all(b>a for a,b in zip(progress,progress[1:]))
max_density=max(keys,key=lambda k:k['density'])
max_expansion=max(keys,key=lambda k:k['expansion'])
max_burst=max(keys,key=lambda k:k['burst'])
max_pull=max(keys,key=lambda k:k['magneticPull'])
story_ok=(max_density['id']=='core_cross' and max_expansion['id']=='core_cross' and max_burst['id']=='core_approach' and max_pull['id']=='lock')
results['checks']['particle_progress_monotonic']=monotonic
results['checks']['particle_story_peaks']=story_ok
results['particleEnergy']={'keyframes':len(keys),'maxDensityAt':max_density['id'],'maxExpansionAt':max_expansion['id'],'maxBurstAt':max_burst['id'],'maxMagneticPullAt':max_pull['id']}
if not monotonic or not story_ok: results['status']='FAIL'

for label,rel in [('desktop','public/models/orb_faz8_web_desktop.glb'),('mobile','public/models/orb_faz8_web_mobile.glb')]:
    p=ROOT/rel; j=glb_json(p); anims={a.get('name',''):a for a in j.get('animations',[])}; nodes={n.get('name','') for n in j.get('nodes',[])}
    ok={'Orb_Main_Cinematic','Ring_Idle','Core_Pulse'}.issubset(anims) and {'ORB_ROOT','CORE_ROOT','SHELL_ROOT','RINGS_ROOT'}.issubset(nodes)
    results['checks'][f'{label}:glb_integrity']=ok
    results['assets'][label]={'bytes':p.stat().st_size,'sha256':sha256(p),'nodes':len(j.get('nodes',[])),'meshes':len(j.get('meshes',[])),'mainChannels':len(anims['Orb_Main_Cinematic'].get('channels',[])) if 'Orb_Main_Cinematic' in anims else 0}
    if not ok: results['status']='FAIL'

source_checks={
    'particle_component_mounted':('components/scene/CinematicCanvas.tsx','<ParticleEnergyField profile={profile} progressRef={progressRef} runtimeStateRef={runtimeStateRef} />'),
    'gpu_vertex_motion':('components/scene/ParticleEnergyField.tsx','float radialExpansion = uExpansion'),
    'gpu_additive_blending':('components/scene/ParticleEnergyField.tsx','blending: THREE.AdditiveBlending'),
    'deterministic_seed':('components/scene/ParticleEnergyField.tsx','let seed = 0x4f524256'),
    'mobile_particle_scaling':('components/scene/ParticleEnergyField.tsx','profile.profile === "mobile" ? 0.82 : 1.0'),
    'particle_sampler':('components/scene/ParticleEnergyField.tsx','sampleParticleEnergy(progressRef.current)'),
    'flow_sync':('components/scene/OrbModel.tsx','runtime.setSpeed(particleEnergy.flowSpeed)'),
    'lightning_sync':('components/scene/OrbModel.tsx','runtime.setLightningGain(particleEnergy.lightningGain)'),
    'inner_core_reduced':('components/scene/OrbModel.tsx','Math.round(profile.particleCount * 0.55)'),
    'main_clip_seek':('components/scene/OrbModel.tsx','mixer.setTime(time)'),
    'phase12_status':('components/ui/ScrollNarrative.tsx','FAZ 12')
}
for key,(rel,needle) in source_checks.items():
    ok=needle in (ROOT/rel).read_text(encoding='utf-8')
    results['checks'][key]=ok
    if not ok: results['status']='FAIL'

orb=(ROOT/'components/scene/OrbModel.tsx').read_text(encoding='utf-8')
results['checks']['no_clock_driven_main_clip']='mixer.update(' not in orb
if not results['checks']['no_clock_driven_main_clip']: results['status']='FAIL'

particle_src=(ROOT/'components/scene/ParticleEnergyField.tsx').read_text(encoding='utf-8')
frame=particle_src.split('useFrame((state) => {',1)[1].split('});',1)[0]
results['checks']['no_cpu_particle_position_loop']='for (' not in frame and '.forEach(' not in frame
if not results['checks']['no_cpu_particle_position_loop']: results['status']='FAIL'

proc=subprocess.run(['node',str(ROOT/'tools/check_ts_syntax.cjs')],cwd=ROOT,text=True,capture_output=True)
try: syntax=json.loads(proc.stdout)
except Exception: syntax={'files':0,'errors':[{'message':proc.stdout+proc.stderr}]}
results['syntax']=syntax
results['checks']['ts_tsx_syntax']=proc.returncode==0 and not syntax.get('errors')
if not results['checks']['ts_tsx_syntax']: results['status']='FAIL'

jsproc=subprocess.run(['node','--check',str(ROOT/'lib/runtime/coreEnergyRuntime.js')],cwd=ROOT,text=True,capture_output=True)
results['checks']['core_runtime_js_syntax']=jsproc.returncode==0
if jsproc.returncode!=0: results['status']='FAIL'

pkg=json.loads((ROOT/'package.json').read_text())
results['checks']['package_phase12']=pkg.get('name')=='3d-premium-website-faz12' and pkg.get('scripts',{}).get('validate')=='python3 tools/validate_faz12.py'
if not results['checks']['package_phase12']: results['status']='FAIL'

out=ROOT/'spec/validation_faz12.json'; out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(0 if results['status']=='PASS' else 1)
