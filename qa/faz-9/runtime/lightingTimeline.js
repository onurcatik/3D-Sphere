"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIGHTING_KEYFRAMES = void 0;
exports.sampleLighting = sampleLighting;
exports.LIGHTING_KEYFRAMES = [
    { id: "hero", time: 0.00, ambientGain: 0.86, keyGain: 0.92, fillGain: 0.70, rimGain: 0.88, coreGain: 0.54, environmentGain: 0.92, fogDensityScale: 1.05, fogBlueBias: 0.00, backgroundBlueMix: 0.02, exposureTrim: 0.98, floorRoughness: 0.38, floorMetalness: 0.26, contactShadowOpacity: 0.31, shaftGain: 0.58, dustGain: 0.82 },
    { id: "wake", time: 1.54, ambientGain: 0.88, keyGain: 0.98, fillGain: 0.76, rimGain: 0.94, coreGain: 0.62, environmentGain: 0.95, fogDensityScale: 1.00, fogBlueBias: 0.02, backgroundBlueMix: 0.04, exposureTrim: 0.99, floorRoughness: 0.37, floorMetalness: 0.27, contactShadowOpacity: 0.30, shaftGain: 0.66, dustGain: 0.88 },
    { id: "unlock", time: 3.08, ambientGain: 0.90, keyGain: 1.04, fillGain: 0.84, rimGain: 1.03, coreGain: 0.78, environmentGain: 0.98, fogDensityScale: 0.94, fogBlueBias: 0.05, backgroundBlueMix: 0.08, exposureTrim: 0.99, floorRoughness: 0.35, floorMetalness: 0.29, contactShadowOpacity: 0.28, shaftGain: 0.78, dustGain: 0.96 },
    { id: "fragment", time: 4.30, ambientGain: 0.92, keyGain: 1.08, fillGain: 0.92, rimGain: 1.10, coreGain: 0.92, environmentGain: 1.02, fogDensityScale: 0.86, fogBlueBias: 0.10, backgroundBlueMix: 0.13, exposureTrim: 0.98, floorRoughness: 0.33, floorMetalness: 0.31, contactShadowOpacity: 0.25, shaftGain: 0.90, dustGain: 1.04 },
    { id: "core", time: 5.50, ambientGain: 0.84, keyGain: 1.02, fillGain: 1.00, rimGain: 1.12, coreGain: 1.00, environmentGain: 1.04, fogDensityScale: 0.74, fogBlueBias: 0.17, backgroundBlueMix: 0.19, exposureTrim: 0.94, floorRoughness: 0.31, floorMetalness: 0.32, contactShadowOpacity: 0.20, shaftGain: 1.00, dustGain: 1.08 },
    { id: "core_hold", time: 6.93, ambientGain: 0.86, keyGain: 1.00, fillGain: 0.96, rimGain: 1.08, coreGain: 0.98, environmentGain: 1.03, fogDensityScale: 0.76, fogBlueBias: 0.15, backgroundBlueMix: 0.17, exposureTrim: 0.95, floorRoughness: 0.31, floorMetalness: 0.32, contactShadowOpacity: 0.21, shaftGain: 0.96, dustGain: 1.04 },
    { id: "recall", time: 7.92, ambientGain: 0.88, keyGain: 1.04, fillGain: 0.90, rimGain: 1.05, coreGain: 0.86, environmentGain: 1.00, fogDensityScale: 0.84, fogBlueBias: 0.10, backgroundBlueMix: 0.12, exposureTrim: 0.97, floorRoughness: 0.33, floorMetalness: 0.31, contactShadowOpacity: 0.24, shaftGain: 0.84, dustGain: 0.98 },
    { id: "reassembly", time: 9.20, ambientGain: 0.88, keyGain: 1.02, fillGain: 0.82, rimGain: 1.00, coreGain: 0.72, environmentGain: 0.97, fogDensityScale: 0.93, fogBlueBias: 0.06, backgroundBlueMix: 0.08, exposureTrim: 0.99, floorRoughness: 0.35, floorMetalness: 0.29, contactShadowOpacity: 0.27, shaftGain: 0.72, dustGain: 0.92 },
    { id: "seal", time: 10.34, ambientGain: 0.86, keyGain: 0.98, fillGain: 0.76, rimGain: 0.96, coreGain: 0.60, environmentGain: 0.94, fogDensityScale: 1.00, fogBlueBias: 0.03, backgroundBlueMix: 0.05, exposureTrim: 1.00, floorRoughness: 0.37, floorMetalness: 0.27, contactShadowOpacity: 0.30, shaftGain: 0.62, dustGain: 0.86 },
    { id: "final", time: 11.00, ambientGain: 0.88, keyGain: 1.02, fillGain: 0.78, rimGain: 1.02, coreGain: 0.66, environmentGain: 0.96, fogDensityScale: 0.98, fogBlueBias: 0.05, backgroundBlueMix: 0.07, exposureTrim: 0.99, floorRoughness: 0.36, floorMetalness: 0.28, contactShadowOpacity: 0.30, shaftGain: 0.68, dustGain: 0.88 }
];
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};
function sampleLighting(sceneTime) {
    const t = Number.isFinite(sceneTime) ? Math.max(0, Math.min(11, sceneTime)) : 0;
    let a = exports.LIGHTING_KEYFRAMES[0];
    let b = exports.LIGHTING_KEYFRAMES[exports.LIGHTING_KEYFRAMES.length - 1];
    for (let index = 0; index < exports.LIGHTING_KEYFRAMES.length - 1; index += 1) {
        const left = exports.LIGHTING_KEYFRAMES[index];
        const right = exports.LIGHTING_KEYFRAMES[index + 1];
        if (t >= left.time && t <= right.time) {
            a = left;
            b = right;
            break;
        }
    }
    const span = Math.max(1e-8, b.time - a.time);
    const k = smooth((t - a.time) / span);
    const lerp = (x, y) => x + (y - x) * k;
    return {
        ambientGain: lerp(a.ambientGain, b.ambientGain),
        keyGain: lerp(a.keyGain, b.keyGain),
        fillGain: lerp(a.fillGain, b.fillGain),
        rimGain: lerp(a.rimGain, b.rimGain),
        coreGain: lerp(a.coreGain, b.coreGain),
        environmentGain: lerp(a.environmentGain, b.environmentGain),
        fogDensityScale: lerp(a.fogDensityScale, b.fogDensityScale),
        fogBlueBias: lerp(a.fogBlueBias, b.fogBlueBias),
        backgroundBlueMix: lerp(a.backgroundBlueMix, b.backgroundBlueMix),
        exposureTrim: lerp(a.exposureTrim, b.exposureTrim),
        floorRoughness: lerp(a.floorRoughness, b.floorRoughness),
        floorMetalness: lerp(a.floorMetalness, b.floorMetalness),
        contactShadowOpacity: lerp(a.contactShadowOpacity, b.contactShadowOpacity),
        shaftGain: lerp(a.shaftGain, b.shaftGain),
        dustGain: lerp(a.dustGain, b.dustGain)
    };
}
