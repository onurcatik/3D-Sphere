import * as THREE from 'three';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const safeCoreState={
  reveal:0.1,innerGain:0.18,vortexGain:0.12,membraneGain:0.08,haloGain:0.06,
  connectionGain:0,beamGain:0.1,particleGain:0.56,lightGain:0.32,whiteHot:0.08
};

const CORE_VERTEX = /* glsl */`
uniform float uFlowTime;
uniform float uSceneTime;
uniform float uEnergy;
uniform float uGain;
varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
vec3 safeNormalize(vec3 v){ return v * inversesqrt(max(dot(v,v), 1e-8)); }
void main(){
  vec3 p = position;
  float pulse = sin(uFlowTime*2.15 + position.y*7.0 + position.x*3.6) * 0.009 * uEnergy * uGain;
  p += normal * pulse;
  vec4 world = modelMatrix * vec4(p,1.0);
  vec4 mv = viewMatrix * world;
  vPos = p;
  vNormalW = safeNormalize(mat3(modelMatrix) * normal);
  vViewDir = safeNormalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const CORE_FRAGMENT = /* glsl */`
precision highp float;
uniform float uFlowTime;
uniform float uSceneTime;
uniform float uEnergy;
uniform float uGain;
uniform float uWhiteHot;
varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
vec3 safeNormalize(vec3 v){ return v * inversesqrt(max(dot(v,v), 1e-8)); }
float hash31(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float noise3(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  float n000=hash31(i+vec3(0,0,0)); float n100=hash31(i+vec3(1,0,0));
  float n010=hash31(i+vec3(0,1,0)); float n110=hash31(i+vec3(1,1,0));
  float n001=hash31(i+vec3(0,0,1)); float n101=hash31(i+vec3(1,0,1));
  float n011=hash31(i+vec3(0,1,1)); float n111=hash31(i+vec3(1,1,1));
  float nx00=mix(n000,n100,f.x), nx10=mix(n010,n110,f.x);
  float nx01=mix(n001,n101,f.x), nx11=mix(n011,n111,f.x);
  return mix(mix(nx00,nx10,f.y),mix(nx01,nx11,f.y),f.z);
}
float fbm(vec3 p){
  float v=0.0, a=.52;
  for(int i=0;i<5;i++){ v += a*noise3(p); p=p*2.03+vec3(1.7,-.9,1.1); a*=.5; }
  return v;
}
void main(){
  vec3 p=safeNormalize(vPos);
  float lon=atan(p.z,p.x);
  float lat=asin(clamp(p.y,-1.0,1.0));
  float n=fbm(p*3.3 + vec3(0.0,uFlowTime*.115,-uFlowTime*.082));
  float spiral=.5+.5*sin(lon*8.0 + lat*11.0 - uFlowTime*2.2 + n*5.6);
  float filament=pow(spiral,5.4);
  float crossFlow=.5+.5*sin(lon*3.0-lat*14.0+uFlowTime*1.35+n*2.8);
  crossFlow=pow(crossFlow,7.0)*.38;
  float fresnel=pow(1.0-max(dot(safeNormalize(vNormalW),safeNormalize(vViewDir)),0.0),2.45);
  float pulse=.90+.10*sin(uSceneTime*2.15);
  vec3 deep=vec3(0.012,0.055,0.22);
  vec3 blue=vec3(0.025,0.27,0.95);
  vec3 cyan=vec3(0.22,0.74,1.0);
  vec3 white=vec3(0.91,0.98,1.0);
  float energy=clamp((filament+crossFlow)*1.02 + n*.34 + fresnel*.48,0.0,1.45);
  vec3 col=mix(deep,blue,clamp(n+.12,0.0,1.0));
  col=mix(col,cyan,clamp(energy*.62,0.0,1.0));
  col=mix(col,white,clamp((energy-.84)*1.25*uWhiteHot,0.0,.72));
  col *= (0.72 + uEnergy*.72) * pulse * uGain;
  float alpha=clamp((0.40 + energy*.28 + fresnel*.22) * uGain,0.0,.86);
  gl_FragColor=vec4(col,alpha);
}`;

const MEMBRANE_VERTEX = /* glsl */`
uniform float uFlowTime;uniform float uGain;varying vec3 vN;varying vec3 vV;varying vec3 vP;
vec3 safeNormalize(vec3 v){return v*inversesqrt(max(dot(v,v),1e-8));}
void main(){
  vec3 p=position*(1.0+0.008*sin(uFlowTime*1.35+position.y*5.0)*uGain);
  vec4 w=modelMatrix*vec4(p,1.0);vN=safeNormalize(mat3(modelMatrix)*normal);vV=safeNormalize(cameraPosition-w.xyz);vP=p;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const MEMBRANE_FRAGMENT = /* glsl */`
uniform float uFlowTime;uniform float uGain;uniform float uWhiteHot;varying vec3 vN;varying vec3 vV;varying vec3 vP;
vec3 safeNormalize(vec3 v){return v*inversesqrt(max(dot(v,v),1e-8));}
void main(){
  float fresnel=pow(1.0-max(dot(safeNormalize(vN),safeNormalize(vV)),0.0),3.0);
  float band=.5+.5*sin((vP.x+vP.y*.7-vP.z*.4)*11.0-uFlowTime*1.2);
  band=pow(band,5.0);
  vec3 blue=vec3(.03,.22,.88), cyan=vec3(.22,.78,1.0), white=vec3(.92,.99,1.0);
  vec3 c=mix(blue,cyan,clamp(fresnel*.85+band*.32,0.0,1.0));
  c=mix(c,white,clamp(band*uWhiteHot*.30,0.0,.35));
  float a=clamp((.06+fresnel*.30+band*.12)*uGain,0.0,.42);
  gl_FragColor=vec4(c*(.82+uGain*.55),a);
}`;

const HALO_VERTEX = /* glsl */`
uniform float uSceneTime;uniform float uGain;varying vec3 vN;varying vec3 vV;
vec3 safeNormalize(vec3 v){return v*inversesqrt(max(dot(v,v),1e-8));}
void main(){
  vec3 p=position*(1.0+0.012*sin(uSceneTime*1.25)*uGain);
  vec4 w=modelMatrix*vec4(p,1.0);vN=safeNormalize(mat3(modelMatrix)*normal);vV=safeNormalize(cameraPosition-w.xyz);
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const HALO_FRAGMENT = /* glsl */`
uniform float uSceneTime;uniform float uGain;uniform float uWhiteHot;varying vec3 vN;varying vec3 vV;
vec3 safeNormalize(vec3 v){return v*inversesqrt(max(dot(v,v),1e-8));}
void main(){
  float f=pow(1.0-max(dot(safeNormalize(vN),safeNormalize(vV)),0.0),3.55);
  float p=.92+.08*sin(uSceneTime*1.55);
  vec3 c=mix(vec3(.025,.18,.80),vec3(.45,.86,1.0),f);
  c=mix(c,vec3(.96,.99,1.0),f*uWhiteHot*.16);
  float a=clamp(f*(.20+.34*uGain)*p*uGain,0.0,.56);
  gl_FragColor=vec4(c*(.78+uGain*.72),a);
}`;

const INNER_VERTEX = /* glsl */`
uniform float uSceneTime;uniform float uGain;varying vec3 vN;varying vec3 vV;
vec3 safeNormalize(vec3 v){return v*inversesqrt(max(dot(v,v),1e-8));}
void main(){
  vec3 p=position*(1.0+0.018*sin(uSceneTime*2.4)*uGain);
  vec4 w=modelMatrix*vec4(p,1.0);vN=safeNormalize(mat3(modelMatrix)*normal);vV=safeNormalize(cameraPosition-w.xyz);
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const INNER_FRAGMENT = /* glsl */`
uniform float uSceneTime;uniform float uGain;uniform float uWhiteHot;varying vec3 vN;varying vec3 vV;
vec3 safeNormalize(vec3 v){return v*inversesqrt(max(dot(v,v),1e-8));}
void main(){
  float fresnel=pow(1.0-max(dot(safeNormalize(vN),safeNormalize(vV)),0.0),2.0);
  float pulse=.93+.07*sin(uSceneTime*2.55);
  vec3 cyan=vec3(.25,.76,1.0), white=vec3(.96,.995,1.0);
  vec3 c=mix(cyan,white,clamp(.18+uWhiteHot*.48+fresnel*.18,0.0,.78));
  float a=clamp((.50+fresnel*.30)*uGain,0.0,.82);
  gl_FragColor=vec4(c*(.92+uGain*.75)*pulse,a);
}`;

const BEAM_VERTEX = /* glsl */`
varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const BEAM_FRAGMENT = /* glsl */`
uniform float uFlowTime;uniform float uGain;varying vec3 vP;
void main(){
  float bands=.5+.5*sin(vP.y*24.0-uFlowTime*4.0);
  float a=(.035+.065*bands)*uGain;
  vec3 c=mix(vec3(.035,.20,.78),vec3(.42,.83,1.0),bands);
  gl_FragColor=vec4(c*(.75+uGain*.85),a);
}`;

function makeParticles(count=1800){
  const g=new THREE.BufferGeometry();
  const radius=new Float32Array(count),angle=new Float32Array(count),height=new Float32Array(count),speed=new Float32Array(count),phase=new Float32Array(count),size=new Float32Array(count);
  let seed=73471;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<count;i++){
    radius[i]=.68+Math.pow(rand(),1.7)*1.9;angle[i]=rand()*Math.PI*2;height[i]=(rand()*2-1)*1.45;speed[i]=.22+rand()*.72;phase[i]=rand()*Math.PI*2;size[i]=.5+rand()*1.45;
  }
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
  g.setAttribute('aRadius',new THREE.BufferAttribute(radius,1));g.setAttribute('aAngle',new THREE.BufferAttribute(angle,1));g.setAttribute('aHeight',new THREE.BufferAttribute(height,1));g.setAttribute('aSpeed',new THREE.BufferAttribute(speed,1));g.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));g.setAttribute('aSize',new THREE.BufferAttribute(size,1));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),3.4);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uEnergy:{value:1},uGain:{value:.56}},vertexShader:/*glsl*/`
    uniform float uTime;uniform float uEnergy;uniform float uGain;attribute float aRadius,aAngle,aHeight,aSpeed,aPhase,aSize;varying float vAlpha;
    void main(){
      float ang=aAngle+uTime*aSpeed*(.26+.28*uEnergy)+sin(uTime*.32+aPhase)*.19;
      float r=aRadius*(1.0+.035*sin(uTime*1.15+aPhase));
      float y=aHeight+sin(ang*2.0+aPhase+uTime*.62)*.11;
      vec3 p=vec3(cos(ang)*r,y,sin(ang)*r);
      vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
      gl_PointSize=(1.7+4.0*aSize*uEnergy)*(145.0/max(1.0,-mv.z));
      vAlpha=clamp((2.75-r)/2.2,.12,1.0)*(.70+.30*sin(aPhase+uTime*aSpeed))*uGain;
    }`,fragmentShader:/*glsl*/`
    varying float vAlpha;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float a=(1.0-smoothstep(.04,.5,d))*vAlpha;vec3 c=mix(vec3(.08,.36,.95),vec3(.65,.91,1.0),1.0-smoothstep(0.0,.36,d));gl_FragColor=vec4(c,a);}`});
  return new THREE.Points(g,m);
}

function makeArc(target,index){
  const segments=28;
  const positions=new Float32Array((segments+1)*3);
  const geometry=new THREE.BufferGeometry();
  const attr=new THREE.BufferAttribute(positions,3);attr.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',attr);
  const material=new THREE.LineBasicMaterial({color:0x65c7ff,transparent:true,opacity:0,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false});
  const line=new THREE.Line(geometry,material);line.name=`Runtime_CoreConnection_${String(index+1).padStart(2,'0')}`;line.frustumCulled=false;line.renderOrder=7;
  return {target,line,geometry,material,positions,segments,index};
}

function updateArc(arc,start,end,sceneTime,gain,whiteHot){
  const tangent=new THREE.Vector3().subVectors(end,start);
  const distance=Math.max(.001,tangent.length());
  const dir=tangent.clone().normalize();
  const up=Math.abs(dir.y)<.88?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const side=new THREE.Vector3().crossVectors(dir,up).normalize();
  const normal=new THREE.Vector3().crossVectors(side,dir).normalize();
  const phase=arc.index*1.731;
  const bend=.12+.055*(arc.index%3);
  for(let i=0;i<=arc.segments;i++){
    const u=i/arc.segments;
    const envelope=Math.sin(Math.PI*u);
    const base=new THREE.Vector3().lerpVectors(start,end,u);
    const waveA=Math.sin(sceneTime*(2.1+arc.index*.11)+phase+u*10.5)*bend*distance*envelope;
    const waveB=Math.sin(sceneTime*(1.35+arc.index*.07)+phase*.7+u*6.2)*bend*.42*distance*envelope;
    base.addScaledVector(side,waveA).addScaledVector(normal,waveB);
    const offset=i*3;arc.positions[offset]=base.x;arc.positions[offset+1]=base.y;arc.positions[offset+2]=base.z;
  }
  arc.geometry.attributes.position.needsUpdate=true;
  arc.geometry.computeBoundingSphere();
  const pulse=.80+.20*Math.sin(sceneTime*(2.7+arc.index*.13)+phase);
  arc.material.opacity=clamp(gain*pulse*(.24+Math.min(1,distance/3.5)*.18),0,.42);
  arc.material.color.setRGB(.20+.28*whiteHot,.64+.22*whiteHot,1.0);
  arc.line.visible=gain>.015;
}

export function createCoreEnergyRuntime(root,scene,options={}){
  const state={energy:options.energy??1.0,speed:options.speed??1.0,crystalTransmission:options.crystalTransmission??.72,lightningGain:1.0,visualGain:1.0,particleBudgetGain:1.0,shaftBudgetGain:1.0,core:{...safeCoreState}};
  const vortexUniforms={uFlowTime:{value:0},uSceneTime:{value:0},uEnergy:{value:state.energy},uGain:{value:.12},uWhiteHot:{value:.08}};
  const membraneUniforms={uFlowTime:{value:0},uGain:{value:.08},uWhiteHot:{value:.08}};
  const haloUniforms={uSceneTime:{value:0},uGain:{value:.06},uWhiteHot:{value:.08}};
  const innerUniforms={uSceneTime:{value:0},uGain:{value:.18},uWhiteHot:{value:.08}};
  const beamUniforms={uFlowTime:{value:0},uGain:{value:.10}};
  const vortexMat=new THREE.ShaderMaterial({uniforms:vortexUniforms,vertexShader:CORE_VERTEX,fragmentShader:CORE_FRAGMENT,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const membraneMat=new THREE.ShaderMaterial({uniforms:membraneUniforms,vertexShader:MEMBRANE_VERTEX,fragmentShader:MEMBRANE_FRAGMENT,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const haloMat=new THREE.ShaderMaterial({uniforms:haloUniforms,vertexShader:HALO_VERTEX,fragmentShader:HALO_FRAGMENT,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const innerMat=new THREE.ShaderMaterial({uniforms:innerUniforms,vertexShader:INNER_VERTEX,fragmentShader:INNER_FRAGMENT,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.FrontSide});
  const beamMat=new THREE.ShaderMaterial({uniforms:beamUniforms,vertexShader:BEAM_VERTEX,fragmentShader:BEAM_FRAGMENT,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});

  const vortexTargets=[],membraneTargets=[],haloTargets=[],beamTargets=[],ribbons=[],energyRings=[],lightning=[],runes=[],crystalTargets=[];
  const shellTargets=[];let coreAnchor=null;
  const materialRestorations=[];const ownedMaterials=new Set();
  const replaceMaterial=(mesh,replacement,owned=false)=>{materialRestorations.push({mesh,original:mesh.material,replacement});mesh.material=replacement;if(owned)ownedMaterials.add(replacement);return replacement};
  const cloneRuntimeMaterial=(mesh)=>replaceMaterial(mesh,mesh.material.clone(),true);

  root.traverse(o=>{
    if(/^Shell_\d\d$/.test(o.name))shellTargets.push(o);
    if(!o.isMesh)return;
    if(o.name==='Core_Vortex_GEO'){replaceMaterial(o,vortexMat);vortexTargets.push(o);coreAnchor=o}
    if(o.name==='Core_EnergyShell_GEO'){replaceMaterial(o,membraneMat);membraneTargets.push(o);if(!coreAnchor)coreAnchor=o}
    if(o.name==='Core_Halo_GEO'){replaceMaterial(o,haloMat);haloTargets.push(o)}
    if(o.name==='Core_PlatformBeam_GEO'){replaceMaterial(o,beamMat);beamTargets.push(o)}
    if(o.name.startsWith('Core_VortexRibbon_')){const material=cloneRuntimeMaterial(o);material.transparent=true;material.blending=THREE.AdditiveBlending;material.depthWrite=false;ribbons.push(o)}
    if(o.name.startsWith('Core_EnergyRing_')){const material=cloneRuntimeMaterial(o);material.transparent=true;material.blending=THREE.AdditiveBlending;material.depthWrite=false;energyRings.push(o)}
    if(o.name.startsWith('Core_Lightning_')){const material=cloneRuntimeMaterial(o);material.transparent=true;material.blending=THREE.AdditiveBlending;material.depthWrite=false;lightning.push(o)}
    if(o.material?.name==='MAT_Rune_Emissive'){const material=cloneRuntimeMaterial(o);material.emissiveIntensity=2.0;runes.push(o)}
    if(o.material?.name==='MAT_Crystal_Ice'){
      const material=cloneRuntimeMaterial(o);if(material.isMeshPhysicalMaterial){material.transmission=state.crystalTransmission;material.opacity=1;material.transparent=false;material.depthWrite=true;material.side=THREE.DoubleSide;material.needsUpdate=true}crystalTargets.push(o);
    }
  });
  shellTargets.sort((a,b)=>a.name.localeCompare(b.name));
  if(!coreAnchor)coreAnchor=root;

  const ribbonsBase=ribbons.map(o=>({x:o.rotation.x,y:o.rotation.y,z:o.rotation.z}));
  const ringsBase=energyRings.map(o=>({x:o.rotation.x,y:o.rotation.y,z:o.rotation.z}));

  const innerGeometry=new THREE.SphereGeometry(.42,options.profile==='mobile'?20:32,options.profile==='mobile'?12:20);
  const innerCore=new THREE.Mesh(innerGeometry,innerMat);innerCore.name='Runtime_InnerCore';innerCore.renderOrder=4;innerCore.frustumCulled=false;coreAnchor.add(innerCore);

  const particles=makeParticles(options.particleCount??1800);particles.name='Runtime_GPU_EnergyParticles';particles.frustumCulled=true;scene.add(particles);
  const pointLight=new THREE.PointLight(0x58aaff,0,8.2,2.0);pointLight.name='Runtime_CoreLight';scene.add(pointLight);
  const whiteLight=new THREE.PointLight(0xdff8ff,0,3.0,2.0);whiteLight.name='Runtime_InnerLight';scene.add(whiteLight);

  const arcCount=Math.max(0,Math.min(shellTargets.length,options.arcCount??(options.profile==='mobile'?3:5)));
  const preferred=[1,4,8,11,13,2,6,9,12,0];
  const selected=[];for(const idx of preferred){if(selected.length>=arcCount)break;if(shellTargets[idx])selected.push(shellTargets[idx])}
  const arcs=selected.map((target,index)=>makeArc(target,index));arcs.forEach(arc=>scene.add(arc.line));

  const coreWorld=new THREE.Vector3();const targetWorld=new THREE.Vector3();
  function setEnergy(v){state.energy=clamp(v,0,2.25);vortexUniforms.uEnergy.value=state.energy;particles.material.uniforms.uEnergy.value=state.energy}
  function setSpeed(v){state.speed=clamp(v,.05,4)}
  function setLightningGain(v){state.lightningGain=clamp(v,0,2.5)}
  function setCrystalTransmission(v){state.crystalTransmission=clamp(v,0,1);crystalTargets.forEach(o=>{if(o.material?.isMeshPhysicalMaterial)o.material.transmission=state.crystalTransmission})}
  function applyVisualBudget(){
    const visual=state.visualGain, particle=state.particleBudgetGain, shaft=state.shaftBudgetGain;
    vortexUniforms.uGain.value=state.core.vortexGain*visual;vortexUniforms.uWhiteHot.value=state.core.whiteHot*visual;
    membraneUniforms.uGain.value=state.core.membraneGain*visual;membraneUniforms.uWhiteHot.value=state.core.whiteHot*visual;
    haloUniforms.uGain.value=state.core.haloGain*visual;haloUniforms.uWhiteHot.value=state.core.whiteHot*visual;
    innerUniforms.uGain.value=state.core.innerGain*visual;innerUniforms.uWhiteHot.value=state.core.whiteHot*visual;
    beamUniforms.uGain.value=state.core.beamGain*shaft;particles.material.uniforms.uGain.value=state.core.particleGain*particle;
  }
  function setVisualBudget(visual=1,particle=1,shaft=1){
    state.visualGain=clamp(visual,.45,1);state.particleBudgetGain=clamp(particle,.45,1);state.shaftBudgetGain=clamp(shaft,.45,1);applyVisualBudget();
  }
  function setCoreState(next){
    if(!next)return;
    for(const key of Object.keys(safeCoreState))state.core[key]=clamp(next[key]??safeCoreState[key],0,1);
    applyVisualBudget();
  }
  function update(flowTime,sceneTime=0){
    const t=Number.isFinite(flowTime)?Math.max(0,flowTime):0;const s=Number.isFinite(sceneTime)?Math.max(0,sceneTime):0;const core=state.core;
    vortexUniforms.uFlowTime.value=t;vortexUniforms.uSceneTime.value=s;membraneUniforms.uFlowTime.value=t;haloUniforms.uSceneTime.value=s;innerUniforms.uSceneTime.value=s;beamUniforms.uFlowTime.value=t;particles.material.uniforms.uTime.value=t;
    root.updateMatrixWorld(true);coreAnchor.getWorldPosition(coreWorld);particles.position.copy(coreWorld);pointLight.position.copy(coreWorld);whiteLight.position.copy(coreWorld);
    const pulse=.92+.08*Math.sin(s*2.2);pointLight.intensity=(18+46*state.energy)*core.lightGain*state.visualGain*pulse;whiteLight.intensity=(7+18*state.energy)*core.innerGain*state.visualGain*(.94+.06*Math.sin(s*2.65));
    innerCore.scale.setScalar(.88+core.reveal*.16+Math.sin(s*2.35)*.012*core.innerGain);innerCore.rotation.y=t*.08;innerCore.rotation.x=Math.sin(s*.44)*.04;
    ribbons.forEach((o,i)=>{const base=ribbonsBase[i];o.rotation.y=base.y+t*.092*(i%2?1:-1);o.rotation.x=base.x+Math.sin(t*.24+i)*.018;o.rotation.z=base.z;o.material.opacity=clamp((.22+.42*core.vortexGain)*state.visualGain,0,.62);o.material.emissiveIntensity=(1.0+2.0*core.vortexGain*(.86+.14*Math.sin(s*1.8+i)))*state.visualGain});
    energyRings.forEach((o,i)=>{const base=ringsBase[i];o.rotation.x=base.x;o.rotation.y=base.y+t*(i?-.155:.198);o.rotation.z=base.z+t*(i?.086:-.058);o.material.opacity=clamp((.18+.34*core.membraneGain)*state.visualGain,0,.52);o.material.emissiveIntensity=(1.1+1.8*core.membraneGain*pulse)*state.visualGain});
    lightning.forEach((o,i)=>{const wave=.78+.22*Math.sin(s*(3.0+i*.09)+i*1.3);o.visible=core.connectionGain>.025;o.material.opacity=clamp((.05+.13*wave)*core.connectionGain*state.lightningGain*state.visualGain,0,.28);o.material.emissiveIntensity=(1.0+2.4*wave*core.connectionGain*state.lightningGain)*state.visualGain});
    runes.forEach((o,i)=>{o.material.emissiveIntensity=(1.05+1.55*core.reveal*(.90+.10*Math.sin(s*1.55+i*.21)))*state.visualGain});
    arcs.forEach(arc=>{arc.target.getWorldPosition(targetWorld);updateArc(arc,coreWorld,targetWorld,s,core.connectionGain*state.lightningGain*state.visualGain,core.whiteHot*state.visualGain)});
  }
  function dispose(){
    scene.remove(particles,pointLight,whiteLight);arcs.forEach(arc=>{scene.remove(arc.line);arc.geometry.dispose();arc.material.dispose()});coreAnchor.remove(innerCore);
    for(let i=materialRestorations.length-1;i>=0;i-=1){const {mesh,original,replacement}=materialRestorations[i];if(mesh.material===replacement)mesh.material=original}
    ownedMaterials.forEach(material=>material.dispose());particles.geometry.dispose();particles.material.dispose();innerGeometry.dispose();vortexMat.dispose();membraneMat.dispose();haloMat.dispose();innerMat.dispose();beamMat.dispose();
  }
  return {state,update,setEnergy,setSpeed,setLightningGain,setCrystalTransmission,setVisualBudget,setCoreState,dispose,particles,pointLight,whiteLight,arcs,innerCore};
}
