import { NoToneMapping, PCFSoftShadowMap, PCFShadowMap, SRGBColorSpace } from 'three';
import type { WebGLRenderer } from 'three';
import type { OrbQualityProfile } from './assetProfile';

export function configureRenderer(gl: WebGLRenderer, profile: OrbQualityProfile) {
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = NoToneMapping; // One ACES pass at the end of CinematicPostFX.
  gl.shadowMap.type = profile.tier === 'desktop-high' ? PCFSoftShadowMap : PCFShadowMap;
  gl.domElement.dataset.webgl = gl.getContext() instanceof WebGL2RenderingContext ? '2' : 'unsupported';
}
