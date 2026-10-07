#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, pathlib, struct, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
REQUIRED_EXT={"KHR_materials_clearcoat","KHR_materials_transmission","KHR_materials_volume","KHR_materials_ior","KHR_materials_emissive_strength"}

def read_glb(rel):
    p=ROOT/rel; raw=p.read_bytes(); magic,ver,total=struct.unpack_from('<4sII',raw,0)
    assert magic==b'glTF' and ver==2 and total==len(raw)
    off=12; jl,jt=struct.unpack_from('<II',raw,off); off+=8; assert jt==0x4E4F534A
    doc=json.loads(raw[off:off+jl].decode('utf-8').rstrip(' \x00')); off+=jl
    bl,bt=struct.unpack_from('<II',raw,off); off+=8; assert bt==0x004E4942
    return p,raw,doc,raw[off:off+bl]

def sha(b): return hashlib.sha256(b).hexdigest()

def anim_sig(doc, binary):
    # Accessors reference the same BIN payload; a stable JSON sampler/channel signature plus identical BIN proves key data preservation.
    out=[]
    for a in doc.get('animations',[]):
        out.append({
          'name':a.get('name'),
          'samplers':[(s.get('input'),s.get('output'),s.get('interpolation','LINEAR')) for s in a.get('samplers',[])],
          'channels':[(c.get('sampler'),c.get('target',{}).get('node'),c.get('target',{}).get('path')) for c in a.get('channels',[])]
        })
    return out

def material_map(doc): return {m.get('name'):m for m in doc.get('materials',[])}

def run(profile, src_rel, dst_rel, budget):
    sp,sraw,sdoc,sbin=read_glb(src_rel); dp,draw,ddoc,dbin=read_glb(dst_rel)
    mats=material_map(ddoc); checks={}
    checks['budget']=len(draw)<=budget
    checks['binary_payload_identical']=sbin==dbin
    checks['node_mesh_accessor_counts_preserved']=(len(sdoc.get('nodes',[])),len(sdoc.get('meshes',[])),len(sdoc.get('accessors',[])))==(len(ddoc.get('nodes',[])),len(ddoc.get('meshes',[])),len(ddoc.get('accessors',[])))
    checks['animations_preserved']=anim_sig(sdoc,sbin)==anim_sig(ddoc,dbin)
    checks['required_extensions_used']=REQUIRED_EXT.issubset(set(ddoc.get('extensionsUsed',[])))
    checks['phase4_asset_metadata']=ddoc.get('asset',{}).get('extras',{}).get('chatgptV3',{}).get('phase')==4
    checks['no_textures_or_images']=not ddoc.get('textures') and not ddoc.get('images')
    prims=[p for m in ddoc.get('meshes',[]) for p in m.get('primitives',[])]
    checks['normals_preserved']=all('NORMAL' in p.get('attributes',{}) for p in prims)
    checks['no_uv_or_tangent_invented']=all('TEXCOORD_0' not in p.get('attributes',{}) and 'TANGENT' not in p.get('attributes',{}) for p in prims)
    checks['fourteen_inner_shell_nodes']=sum(1 for n in ddoc.get('nodes',[]) if n.get('name','').startswith('Shell_') and n.get('name','').endswith('_Inner_GEO'))==14
    checks['all_fourteen_materials_present']=len(mats)==14
    checks['shell_physical_values']=mats['MAT_Shell_Graphite']['pbrMetallicRoughness']['metallicFactor']>=.8 and .28<=mats['MAT_Shell_Graphite']['pbrMetallicRoughness']['roughnessFactor']<=.38 and 'KHR_materials_clearcoat' in mats['MAT_Shell_Graphite'].get('extensions',{})
    checks['gold_physical_values']=mats['MAT_Antique_Gold']['pbrMetallicRoughness']['metallicFactor']==1 and mats['MAT_Antique_Gold']['pbrMetallicRoughness']['roughnessFactor']<=.28
    crystal=mats['MAT_Crystal_Ice']; ce=crystal.get('extensions',{})
    checks['crystal_physical_extensions']=all(x in ce for x in ['KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_clearcoat']) and crystal.get('alphaMode','OPAQUE')=='OPAQUE' and crystal.get('doubleSided') is True
    checks['crystal_profile_budget']=abs(ce['KHR_materials_transmission']['transmissionFactor']-(.72 if profile=='desktop' else .52))<1e-9
    checks['rune_emissive_strength']='KHR_materials_emissive_strength' in mats['MAT_Rune_Emissive'].get('extensions',{})
    return {'profile':profile,'source':src_rel,'output':dst_rel,'sourceBytes':len(sraw),'outputBytes':len(draw),'sourceBinSha256':sha(sbin),'outputBinSha256':sha(dbin),'checks':checks,'pass':all(checks.values())}

models=[run('desktop','public/models/orb_v3_faz3_desktop.glb','public/models/orb_v3_faz4_desktop.glb',4*1024*1024),run('mobile','public/models/orb_v3_faz3_mobile.glb','public/models/orb_v3_faz4_mobile.glb',2*1024*1024)]
asset=(ROOT/'lib/assetProfile.ts').read_text(); material=(ROOT/'lib/orbMaterialSystem.ts').read_text(); runtime=(ROOT/'lib/runtime/coreEnergyRuntime.js').read_text(); render=(ROOT/'lib/renderPolicy.ts').read_text(); post=(ROOT/'components/scene/CinematicPostFX.tsx').read_text(); env=(ROOT/'components/scene/MaterialEnvironment.tsx').read_text()
project={
 'active_assets_phase4':'orb_v3_faz4_desktop.glb' in asset and 'orb_v3_faz4_mobile.glb' in asset,
 'premium_material_system_exists':(ROOT/'lib/orbMaterialSystem.ts').exists(),
 'premium_roles_present':all(x in material for x in ['shell-graphite','antique-gold','crystal-ice','shell-inner','platform-obsidian','rune-emissive']),
 'crystal_runtime_preserves_premium_material':"const material=cloneRuntimeMaterial(o)" in runtime and "new THREE.MeshPhysicalMaterial({color:0x83caff" not in runtime,
 'tiered_environment_intensity':'intensityByTier' in env,
 'single_tonemap_policy':'NoToneMapping' in render and 'ToneMappingMode.ACES_FILMIC' in post,
 'no_texture_mapping_in_material_system':'.map =' not in material and 'normalMap:' not in material and 'roughnessMap:' not in material,
 'material_pipeline_exists':(ROOT/'tools/glb_v3_materials.py').exists(),
 'contract_exists':(ROOT/'spec/v3/FAZ4_MATERIAL_SURFACE_CONTRACT.md').exists(),
}
report={'phase':4,'models':models,'projectChecks':project,'pass':all(x['pass'] for x in models) and all(project.values())}
(ROOT/'qa/faz-4/validation_v3_faz4.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2)); sys.exit(0 if report['pass'] else 1)
