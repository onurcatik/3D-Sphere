#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    'package.json', 'tsconfig.json', 'app/layout.tsx', 'app/page.tsx', 'app/globals.css',
    'components/experience/CinematicExperience.tsx',
    'components/experience/useCinematicScroll.ts',
    'components/scene/CinematicCanvas.tsx', 'components/scene/OrbModel.tsx',
    'components/scene/CameraRig.tsx', 'components/scene/SceneLighting.tsx',
    'components/scene/TempleEnvironment.tsx', 'components/ui/ScrollNarrative.tsx',
    'lib/assetProfile.ts', 'lib/scrollTimeline.ts', 'lib/types.ts',
    'lib/runtime/cameraRig.js', 'lib/runtime/coreEnergyRuntime.js',
    'public/models/orb_faz8_web_desktop.glb', 'public/models/orb_faz8_web_mobile.glb',
    'public/reference/orb-reference.png', 'spec/scroll_timeline.json',
    'spec/FAZ10_SCROLL_TIMELINE.md', 'web_preview/index.html'
]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def glb_json(path: Path):
    b = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', b, 0)
    if magic != b'glTF' or version != 2 or length != len(b):
        raise ValueError('Invalid GLB header')
    off = 12
    while off < len(b):
        clen, ctype = struct.unpack_from('<II', b, off); off += 8
        chunk = b[off:off + clen]; off += clen
        if ctype == 0x4E4F534A:
            return json.loads(chunk.decode('utf-8').rstrip('\x00 '))
    raise ValueError('JSON chunk not found')

def ease(name: str, t: float) -> float:
    t = max(0.0, min(1.0, t))
    if name == 'smoothstep': return t*t*(3-2*t)
    if name == 'smootherstep': return t*t*t*(t*(t*6-15)+10)
    if name == 'cubicInOut': return 4*t*t*t if t < .5 else 1 - ((-2*t+2)**3)/2
    if name == 'sineInOut': return -(math.cos(math.pi*t)-1)/2
    return t

def map_progress(p: float, segments: list[dict]) -> float:
    p = max(0.0, min(1.0, p))
    seg = segments[-1]
    for i, item in enumerate(segments):
        if p >= item['scroll'][0] and (p < item['scroll'][1] or i == len(segments)-1):
            seg = item; break
    a,b = seg['scroll']; c,d = seg['scene']
    local = (p-a)/max(1e-12,b-a)
    return c+(d-c)*ease(seg['ease'], local)

results = {'phase':'FAZ 10','status':'PASS','checks':{},'assets':{},'timeline':{}}
for rel in REQUIRED:
    p = ROOT / rel
    ok = p.exists() and p.stat().st_size > 0
    results['checks'][f'file:{rel}'] = ok
    if not ok: results['status'] = 'FAIL'

cfg = json.loads((ROOT/'spec/scroll_timeline.json').read_text())
segments = cfg['segments']
continuous = True
for i, seg in enumerate(segments):
    if i == 0:
        continuous &= abs(seg['scroll'][0]) < 1e-12 and abs(seg['scene'][0]) < 1e-12
    else:
        prev = segments[i-1]
        continuous &= abs(prev['scroll'][1]-seg['scroll'][0]) < 1e-12
        continuous &= abs(prev['scene'][1]-seg['scene'][0]) < 1e-12
continuous &= abs(segments[-1]['scroll'][1]-1) < 1e-12 and abs(segments[-1]['scene'][1]-1) < 1e-12
samples = [map_progress(i/2000, segments) for i in range(2001)]
monotonic = all(b + 1e-12 >= a for a,b in zip(samples,samples[1:]))
endpoint = abs(samples[0]) < 1e-12 and abs(samples[-1]-1) < 1e-12
chapter_vh = sum((s['scroll'][1]-s['scroll'][0])*cfg['scrollHeightVh'] for s in segments)
results['checks']['timeline_continuous'] = continuous
results['checks']['timeline_monotonic'] = monotonic
results['checks']['timeline_endpoints'] = endpoint
results['checks']['chapter_height_700vh'] = abs(chapter_vh-700) < 1e-8
results['timeline'] = {
    'segments':len(segments),'durationSeconds':cfg['durationSeconds'],
    'scrollHeightVh':chapter_vh,'minSample':min(samples),'maxSample':max(samples)
}
if not all([continuous,monotonic,endpoint,abs(chapter_vh-700)<1e-8]): results['status']='FAIL'

for label, rel in [('desktop','public/models/orb_faz8_web_desktop.glb'),('mobile','public/models/orb_faz8_web_mobile.glb')]:
    p = ROOT/rel
    j = glb_json(p)
    anims = {a.get('name',''):a for a in j.get('animations',[])}
    names = list(anims)
    required_anims = {'Orb_Main_Cinematic','Ring_Idle','Core_Pulse'}
    node_names = {n.get('name','') for n in j.get('nodes',[])}
    ok = required_anims.issubset(names) and {'ORB_ROOT','CORE_ROOT','SHELL_ROOT','RINGS_ROOT'}.issubset(node_names)
    results['checks'][f'{label}:glb_integrity'] = ok
    results['assets'][label] = {
        'bytes':p.stat().st_size,'sha256':sha256(p),'nodes':len(j.get('nodes',[])),
        'meshes':len(j.get('meshes',[])),'animations':names,
        'mainChannels':len(anims.get('Orb_Main_Cinematic',{}).get('channels',[]))
    }
    if not ok: results['status']='FAIL'

source_checks = {
    'central_mapper': ('components/experience/useCinematicScroll.ts','getScrollTimelineSample(self.progress)'),
    'scene_ref_write': ('components/experience/useCinematicScroll.ts','sceneProgressRef.current = sample.cinematicProgress'),
    'velocity_telemetry_only': ('components/experience/useCinematicScroll.ts','runtimeStateRef.current.scrollVelocity = self.getVelocity()'),
    'scrolltrigger': ('components/experience/useCinematicScroll.ts','ScrollTrigger.create'),
    'lenis': ('components/experience/useCinematicScroll.ts','new Lenis'),
    'main_clip_seek': ('components/scene/OrbModel.tsx','mixer.setTime(time)'),
    'main_clip_name': ('components/scene/OrbModel.tsx','Orb_Main_Cinematic'),
    'camera_same_ref': ('components/scene/CameraRig.tsx','rig.setProgress(progressRef.current)'),
    'weighted_chapters': ('components/ui/ScrollNarrative.tsx','getChapterViewportHeight(segment.id)'),
    'phase10_status': ('components/ui/ScrollNarrative.tsx','FAZ 10')
}
for key,(rel,needle) in source_checks.items():
    txt = (ROOT/rel).read_text(encoding='utf-8')
    ok = needle in txt
    results['checks'][key] = ok
    if not ok: results['status']='FAIL'

# No phase-10 autoplay is permitted for the main cinematic clip.
orb = (ROOT/'components/scene/OrbModel.tsx').read_text()
results['checks']['no_clock_driven_main_clip'] = 'mixer.update(' not in orb
if not results['checks']['no_clock_driven_main_clip']: results['status']='FAIL'

out = ROOT/'spec/validation_faz10.json'
out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
raise SystemExit(0 if results['status']=='PASS' else 1)
