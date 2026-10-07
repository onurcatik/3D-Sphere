#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    'package.json', 'tsconfig.json', 'app/layout.tsx', 'app/page.tsx', 'app/globals.css',
    'components/experience/CinematicExperience.tsx',
    'components/scene/CinematicCanvas.tsx', 'components/scene/OrbModel.tsx',
    'components/scene/CameraRig.tsx', 'components/scene/SceneLighting.tsx',
    'components/scene/TempleEnvironment.tsx', 'components/ui/ScrollNarrative.tsx',
    'lib/assetProfile.ts', 'lib/runtime/cameraRig.js', 'lib/runtime/coreEnergyRuntime.js',
    'public/models/orb_faz8_web_desktop.glb', 'public/models/orb_faz8_web_mobile.glb',
    'public/reference/orb-reference.png'
]

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()

def glb_json(path: Path):
    b=path.read_bytes()
    if len(b) < 20:
        raise ValueError('GLB too small')
    magic, version, length = struct.unpack_from('<4sII', b, 0)
    if magic != b'glTF' or version != 2 or length != len(b):
        raise ValueError('Invalid GLB header')
    off=12
    while off < len(b):
        clen, ctype = struct.unpack_from('<II', b, off); off += 8
        chunk=b[off:off+clen]; off += clen
        if ctype == 0x4E4F534A:
            return json.loads(chunk.decode('utf-8').rstrip('\x00 '))
    raise ValueError('JSON chunk not found')

results={'phase':'FAZ 9','status':'PASS','checks':{},'assets':{}}
missing=[]
for rel in REQUIRED:
    p=ROOT/rel
    ok=p.exists() and p.stat().st_size>0
    results['checks'][f'file:{rel}']=ok
    if not ok: missing.append(rel)

if missing:
    results['status']='FAIL'
    results['missing']=missing

for label, rel in [('desktop','public/models/orb_faz8_web_desktop.glb'),('mobile','public/models/orb_faz8_web_mobile.glb')]:
    p=ROOT/rel
    if not p.exists(): continue
    j=glb_json(p)
    anims={a.get('name',''):a for a in j.get('animations',[])}
    names=list(anims)
    required_anims={'Orb_Main_Cinematic','Ring_Idle','Core_Pulse'}
    anim_ok=required_anims.issubset(set(names))
    node_names={n.get('name','') for n in j.get('nodes',[])}
    node_ok={'ORB_ROOT','CORE_ROOT','SHELL_ROOT','CRYSTAL_SHELL_ROOT','RINGS_ROOT','DEBRIS_ROOT','PLATFORM_ROOT'}.issubset(node_names)
    results['checks'][f'{label}:animations']=anim_ok
    results['checks'][f'{label}:critical_nodes']=node_ok
    results['assets'][label]={
        'bytes':p.stat().st_size,
        'sha256':sha256(p),
        'nodes':len(j.get('nodes',[])),
        'meshes':len(j.get('meshes',[])),
        'materials':len(j.get('materials',[])),
        'animations':names,
        'main_channels':len(anims.get('Orb_Main_Cinematic',{}).get('channels',[]))
    }
    if not (anim_ok and node_ok): results['status']='FAIL'

source_checks={
    'scroll_progress_ref': ('components/experience/CinematicExperience.tsx','progressRef.current = p'),
    'scrolltrigger': ('components/experience/CinematicExperience.tsx','ScrollTrigger.create'),
    'lenis': ('components/experience/CinematicExperience.tsx','new Lenis'),
    'main_clip_seek': ('components/scene/OrbModel.tsx','mixer.setTime(time)'),
    'main_clip_name': ('components/scene/OrbModel.tsx','Orb_Main_Cinematic'),
    'core_runtime': ('components/scene/OrbModel.tsx','createCoreEnergyRuntime'),
    'camera_runtime': ('components/scene/CameraRig.tsx','createCinematicCameraRig'),
    'desktop_mobile_profile': ('lib/assetProfile.ts','orb_faz8_web_mobile.glb'),
    'single_canvas': ('components/scene/CinematicCanvas.tsx','<Canvas'),
}
for key,(rel,needle) in source_checks.items():
    txt=(ROOT/rel).read_text(encoding='utf-8')
    ok=needle in txt
    results['checks'][key]=ok
    if not ok: results['status']='FAIL'

results['checks']['reference_png_sha256']=sha256(ROOT/'public/reference/orb-reference.png')

out=ROOT/'spec/validation_faz9.json'
out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(0 if results['status']=='PASS' else 1)
