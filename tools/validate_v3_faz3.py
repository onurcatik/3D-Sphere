#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, pathlib, struct, sys
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
C={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
N={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}

def load(rel):
 p=ROOT/rel;b=p.read_bytes();magic,ver,total=struct.unpack_from('<4sII',b,0);assert magic==b'glTF' and ver==2 and total==len(b)
 o=12;jl,jt=struct.unpack_from('<II',b,o);o+=8;assert jt==0x4E4F534A;j=json.loads(b[o:o+jl]);o+=jl;bl,bt=struct.unpack_from('<II',b,o);o+=8;assert bt==0x004E4942;return p,b,j,b[o:o+bl]
def acc(j,bin,i):
 a=j['accessors'][i];assert 'sparse' not in a;v=j['bufferViews'][a['bufferView']];dt=np.dtype(C[a['componentType']]).newbyteorder('<');nc=N[a['type']];st=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*nc)
 if stride==dt.itemsize*nc:return np.frombuffer(bin,dtype=dt,count=a['count']*nc,offset=st).reshape(a['count'],nc).copy()
 return np.ndarray((a['count'],nc),dtype=dt,buffer=bin,offset=st,strides=(stride,dt.itemsize)).copy()
def h(a): return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()
def anim_signature(j,bin):
 out=[]
 for a in j.get('animations',[]):
  sam=[]
  for s in a.get('samplers',[]): sam.append((s.get('interpolation','LINEAR'),h(acc(j,bin,s['input'])),h(acc(j,bin,s['output']))))
  ch=[(c['sampler'],c['target'].get('node'),c['target'].get('path')) for c in a.get('channels',[])]
  out.append((a.get('name'),sam,ch))
 return out

def run(profile,src_rel,new_rel,budget):
 sp,sb,sj,sbin=load(src_rel);npth,nb,nj,nbin=load(new_rel)
 checks={}
 checks['budget']=len(nb)<=budget
 checks['source_bin_prefix_preserved']=nbin[:len(sbin)]==sbin
 checks['animation_payload_identical']=anim_signature(sj,sbin)==anim_signature(nj,nbin)
 checks['original_node_names_preserved']=[n.get('name') for n in nj['nodes'][:len(sj['nodes'])]]==[n.get('name') for n in sj['nodes']]
 transform_keys=('translation','rotation','scale','matrix')
 checks['original_transforms_preserved']=all(all(nj['nodes'][i].get(k)==sj['nodes'][i].get(k) for k in transform_keys) for i in range(len(sj['nodes'])))
 prims=[p for m in nj['meshes'] for p in m.get('primitives',[])]
 checks['all_primitives_have_normals']=all('NORMAL' in p.get('attributes',{}) for p in prims)
 norm_err=0.0;finite=True
 for p in prims:
  n=acc(nj,nbin,p['attributes']['NORMAL']).astype(np.float64);finite=finite and bool(np.isfinite(n).all());norm_err=max(norm_err,float(np.max(np.abs(np.linalg.norm(n,axis=1)-1))))
 checks['normals_finite']=finite;checks['normals_unit_error_lt_1e-4']=norm_err<1e-4
 inn=[(i,n) for i,n in enumerate(nj['nodes']) if n.get('extras',{}).get('generatedBy')=='CHATGPT_V3_FAZ3' and n.get('name','').endswith('_Inner_GEO')]
 checks['fourteen_inner_shell_nodes']=len(inn)==14
 roots=[]
 for s in range(1,15):
  rn=f'Shell_{s:02d}';ri=next(i for i,n in enumerate(nj['nodes']) if n.get('name')==rn);root=nj['nodes'][ri];roots.append(root.get('extras',{}).get('stableShellId')==f'shell-{s:02d}' and 'innerSurfaceNode' in root.get('extras',{}))
 checks['stable_shell_ids']=all(roots)
 checks['no_textures']=len(nj.get('textures',[]))==0 and len(nj.get('images',[]))==0
 checks['no_uv_or_tangent_invented']=all('TEXCOORD_0' not in p.get('attributes',{}) and 'TANGENT' not in p.get('attributes',{}) for p in prims)
 checks['asset_metadata']=nj.get('asset',{}).get('extras',{}).get('chatgptV3',{}).get('phase')==3
 return {'profile':profile,'sourceBytes':len(sb),'enhancedBytes':len(nb),'budgetBytes':budget,'normalMaxUnitError':norm_err,'counts':{'nodes':len(nj['nodes']),'meshes':len(nj['meshes']),'primitives':len(prims),'accessors':len(nj['accessors']),'innerShellNodes':len(inn)},'checks':checks,'pass':all(checks.values())}

results=[run('desktop','public/models/orb_faz8_web_desktop.glb','public/models/orb_v3_faz3_desktop.glb',4*1024*1024),run('mobile','public/models/orb_faz8_web_mobile.glb','public/models/orb_v3_faz3_mobile.glb',2*1024*1024)]
asset=(ROOT/'lib/assetProfile.ts').read_text()
extra={'asset_profile_uses_v3': 'orb_v3_faz3_desktop.glb' in asset and 'orb_v3_faz3_mobile.glb' in asset,
       'pipeline_exists':(ROOT/'tools/glb_v3_pipeline.py').exists(),
       'contract_exists':(ROOT/'spec/v3/FAZ3_GLB_ASSET_CONTRACT.md').exists()}
report={'phase':3,'models':results,'projectChecks':extra,'pass':all(r['pass'] for r in results) and all(extra.values())}
out=ROOT/'qa/faz-3/validation_v3_faz3.json';out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
sys.exit(0 if report['pass'] else 1)
