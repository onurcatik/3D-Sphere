import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AnimationMixer,LoopOnce,Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {configureSeekableAction,seekAnimationAction} from '../lib/runtime/seekAnimationAction.js';
for(const tier of ['desktop','mobile'])test(`${tier}: active V3 GLB timeline survives forward/reverse seeking`,async()=>{
 const b=fs.readFileSync(`public/models/orb_v3_faz3_${tier}.glb`);
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const clip=gltf.animations.find(a=>a.name==='Orb_Main_Cinematic');assert(clip);assert.equal(clip.duration,11);
 const mixer=new AnimationMixer(gltf.scene);const action=mixer.clipAction(clip);configureSeekableAction(action,LoopOnce);
 const seek=p=>{seekAnimationAction(mixer,action,p*11,11);gltf.scene.updateMatrixWorld(true);const values=[];gltf.scene.traverse(o=>{values.push(...o.matrixWorld.elements)});return values};
 const initial=seek(.32);seek(1);seek(0);assert.deepEqual(seek(.32),initial);
 const bounds=new Box3().setFromObject(gltf.scene);assert(Number.isFinite(bounds.getSize(new Vector3()).length()));
});
