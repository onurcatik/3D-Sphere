#!/usr/bin/env python3
import hashlib, json, re, subprocess, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def sha(path):
    h=hashlib.sha256();
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1<<20),b''):h.update(chunk)
    return h.hexdigest()

def run(cmd):
    p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True)
    return p.returncode,p.stdout,p.stderr

files={
    'timeline': ROOT/'lib/coreEnergyTimeline.ts',
    'scene': ROOT/'lib/sceneTimeline.ts',
    'runtime': ROOT/'lib/runtime/coreEnergyRuntime.js',
    'orb': ROOT/'components/scene/OrbModel.tsx',
    'particles': ROOT/'components/scene/ParticleEnergyField.tsx',
    'beam': ROOT/'components/scene/VolumetricLightShaft.tsx',
    'lighting': ROOT/'components/scene/SceneLighting.tsx',
    'postfx': ROOT/'components/scene/CinematicPostFX.tsx',
}
text={k:v.read_text() for k,v in files.items()}
checks={}
checks['coreEnergyTimelineExists']=files['timeline'].exists()
checks['sceneSampleIncludesCoreEnergy']='coreEnergy: CoreEnergyState' in text['scene'] and 'sampleCoreEnergy(clampedTime)' in text['scene']
checks['orbFeedsCoreState']='runtime.setCoreState(sample?.coreEnergy)' in text['orb'] and 'runtime.update(sample?.flowTime ?? 0, sample?.sceneTime ?? 0)' in text['orb']
checks['threeLayerCore']=all(token in text['runtime'] for token in ['Runtime_InnerCore','Core_Vortex_GEO','Core_EnergyShell_GEO'])
checks['separateHalo']='Core_Halo_GEO' in text['runtime'] and 'haloGain' in text['runtime']
checks['semanticShellConnections']=all(token in text['runtime'] for token in ['Runtime_CoreConnection_','getWorldPosition(targetWorld)','connectionGain'])
checks['mobileArcBudget']='profile.profile === "mobile" ? 3 : 5' in text['orb']
checks['particleGainLinked']='sceneSample.coreEnergy.particleGain' in text['particles']
checks['beamGainLinked']='sample.coreEnergy.beamGain' in text['beam']
checks['coreLightGainLinked']='sample.coreEnergy.lightGain' in text['lighting']
checks['bloomDetailGuard']=(('coreDetailGuard' in text['postfx'] and 'sample.coreEnergy.reveal' in text['postfx']) or ('sample.postFx' in text['postfx'] and 'bloomIntensity' in text['postfx'] and 'postFxSaturationRisk' in text['postfx']))
combined='\n'.join(text.values())
checks['noIndependentClockSources']=not any(token in combined for token in ['elapsedTime','Date.now','Math.random'])

reverse=[]
for key,src in text.items():
    for m in re.finditer(r'smoothstep\(\s*([0-9.]+)\s*,\s*([0-9.]+)',src):
        a,b=float(m.group(1)),float(m.group(2))
        if a>=b:reverse.append({'file':key,'expr':m.group(0)})
checks['noNumericReverseSmoothstep']=not reverse

changed_ts=[str(files[k].relative_to(ROOT)) for k in ['timeline','scene','orb','particles','beam','lighting','postfx']]
code,out,err=run(['tsc','--noEmit','--noCheck','--jsx','preserve','--target','ES2020','--module','ESNext','--moduleResolution','bundler',*changed_ts])
checks['changedTsTsxSyntax']=code==0
code_js,out_js,err_js=run(['node','--check',str(files['runtime'].relative_to(ROOT))])
checks['coreRuntimeJsSyntax']=code_js==0

with tempfile.TemporaryDirectory(prefix='faz6_timeline_') as td:
    code_c,out_c,err_c=run(['tsc','lib/coreEnergyTimeline.ts','--target','ES2020','--module','commonjs','--moduleResolution','node','--lib','ES2020,DOM','--outDir',td,'--skipLibCheck'])
    timeline_diag={}
    if code_c==0:
        js=Path(td)/'coreEnergyTimeline.js'
        node_script=f"""
const m=require({json.dumps(str(js))});
let finite=true,bounded=true,maxStep=0,prev=null;
for(let i=0;i<=10000;i++){{
 const s=m.sampleCoreEnergy(11*i/10000);
 for(const v of Object.values(s)){{ if(!Number.isFinite(v))finite=false; if(v<0||v>1)bounded=false; }}
 if(prev)for(const k of Object.keys(s))maxStep=Math.max(maxStep,Math.abs(s[k]-prev[k]));
 prev=s;
}}
const times=[0,1.54,3.08,4.2,5.5,6.93,7.92,10.34,11];
console.log(JSON.stringify({{finite,bounded,maxStep,keyframeTimes:m.CORE_ENERGY_KEYFRAMES.map(k=>k.time),samples:Object.fromEntries(times.map(t=>[t,m.sampleCoreEnergy(t)]))}}));
"""
        p=subprocess.run(['node','-e',node_script],cwd=ROOT,text=True,capture_output=True)
        if p.returncode==0:
            timeline_diag=json.loads(p.stdout)
    checks['timelineCompiles']=code_c==0
    checks['timeline10001Finite']=bool(timeline_diag.get('finite'))
    checks['timeline10001Bounded']=bool(timeline_diag.get('bounded'))
    checks['timelineCriticalTimes']=timeline_diag.get('keyframeTimes')==[0,1.54,3.08,4.2,5.5,6.93,7.92,10.34,11]
    checks['connectionPeaksAtCoreReveal']=abs(timeline_diag.get('samples',{}).get('5.5',{}).get('connectionGain',-1)-1)<1e-9
    checks['connectionsOffAtFinal']=abs(timeline_diag.get('samples',{}).get('11',{}).get('connectionGain',-1)-0)<1e-9

expected={
 'public/models/orb_v3_faz5_desktop.glb':'498e2cb4fb5198ebd5564614e5b085b7ea81ba64f23f439cfb47017e4028ee8e',
 'public/models/orb_v3_faz5_mobile.glb':'6638b24a83395856f4b6752d284c41cbeb42d8df425c00721ff77c8b0a0d7cf9'
}
for rel,digest in expected.items():checks[f'{Path(rel).name}:unchanged']=sha(ROOT/rel)==digest

reg={}
for phase in (1,2,5):
    c,o,e=run(['python',f'tools/validate_v3_faz{phase}.py'])
    reg[f'faz{phase}']=c==0
checks['faz1Regression']=reg['faz1'];checks['faz2Regression']=reg['faz2'];checks['faz5Regression']=reg['faz5']

result={
 'phase':'CHATGPT V3 FAZ 6',
 'status':'PASS' if all(checks.values()) else 'FAIL',
 'checks':checks,
 'diagnostics':{
   'timeline':timeline_diag,
   'reverseSmoothsteps':reverse,
   'tsSyntaxStderr':err.strip(),
   'jsSyntaxStderr':err_js.strip(),
   'liveThreeRuntime':'BLOCKED_DEPENDENCIES'
 },
 'environmentBlockers':['Live Three.js/WebGL/browser validation remains blocked because node_modules is absent.']
}
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if result['status']=='PASS' else 1)
