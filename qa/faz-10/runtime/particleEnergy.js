"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTICLE_ENERGY_KEYFRAMES = void 0;
exports.sampleParticleEnergy = sampleParticleEnergy;
exports.integrateParticleFlowProgress = integrateParticleFlowProgress;
exports.PARTICLE_ENERGY_KEYFRAMES = [
    { id: "hero", progress: 0.00, density: 0.34, opacity: 0.34, expansion: 0.05, spiral: 0.20, turbulence: 0.14, magneticPull: 0.00, burst: 0.00, coreBias: 0.54, goldMix: 0.08, pointScale: 0.72, flowSpeed: 0.42, lightningGain: 0.32 },
    { id: "wake", progress: 0.14, density: 0.42, opacity: 0.42, expansion: 0.08, spiral: 0.30, turbulence: 0.18, magneticPull: 0.00, burst: 0.05, coreBias: 0.58, goldMix: 0.10, pointScale: 0.82, flowSpeed: 0.52, lightningGain: 0.42 },
    { id: "unlock", progress: 0.28, density: 0.55, opacity: 0.56, expansion: 0.18, spiral: 0.48, turbulence: 0.26, magneticPull: 0.00, burst: 0.20, coreBias: 0.62, goldMix: 0.12, pointScale: 0.94, flowSpeed: 0.68, lightningGain: 0.58 },
    { id: "fragment", progress: 0.42, density: 0.78, opacity: 0.74, expansion: 0.55, spiral: 0.78, turbulence: 0.46, magneticPull: 0.00, burst: 0.68, coreBias: 0.70, goldMix: 0.14, pointScale: 1.12, flowSpeed: 0.92, lightningGain: 0.82 },
    { id: "core_approach", progress: 0.55, density: 0.95, opacity: 0.92, expansion: 0.92, spiral: 1.00, turbulence: 0.62, magneticPull: 0.06, burst: 1.00, coreBias: 0.84, goldMix: 0.18, pointScale: 1.30, flowSpeed: 1.16, lightningGain: 1.00 },
    { id: "core_cross", progress: 0.63, density: 1.00, opacity: 1.00, expansion: 1.00, spiral: 1.00, turbulence: 0.70, magneticPull: 0.14, burst: 0.86, coreBias: 1.00, goldMix: 0.22, pointScale: 1.38, flowSpeed: 1.25, lightningGain: 1.18 },
    { id: "turn", progress: 0.72, density: 0.84, opacity: 0.82, expansion: 0.84, spiral: 0.86, turbulence: 0.54, magneticPull: 0.52, burst: 0.35, coreBias: 0.86, goldMix: 0.18, pointScale: 1.15, flowSpeed: 0.98, lightningGain: 0.80 },
    { id: "reassembly", progress: 0.84, density: 0.66, opacity: 0.64, expansion: 0.46, spiral: 0.64, turbulence: 0.34, magneticPull: 0.88, burst: 0.12, coreBias: 0.74, goldMix: 0.16, pointScale: 0.98, flowSpeed: 0.76, lightningGain: 0.58 },
    { id: "lock", progress: 0.94, density: 0.48, opacity: 0.46, expansion: 0.14, spiral: 0.36, turbulence: 0.20, magneticPull: 1.00, burst: 0.04, coreBias: 0.64, goldMix: 0.12, pointScale: 0.84, flowSpeed: 0.56, lightningGain: 0.42 },
    { id: "final", progress: 1.00, density: 0.52, opacity: 0.52, expansion: 0.08, spiral: 0.28, turbulence: 0.16, magneticPull: 0.18, burst: 0.18, coreBias: 0.68, goldMix: 0.18, pointScale: 0.90, flowSpeed: 0.50, lightningGain: 0.62 }
];
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoother = (value) => {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
};
// Exact integral of smootherstep(t) = 6t^5 - 15t^4 + 10t^3.
// Using the integral keeps phase continuous when flowSpeed changes between keyframes.
const smootherIntegral = (value) => {
    const t = clamp01(value);
    const t2 = t * t;
    const t4 = t2 * t2;
    const t5 = t4 * t;
    const t6 = t5 * t;
    return t6 - 3 * t5 + 2.5 * t4;
};
function findSegment(progress) {
    const p = clamp01(progress);
    for (let i = 0; i < exports.PARTICLE_ENERGY_KEYFRAMES.length - 1; i += 1) {
        const a = exports.PARTICLE_ENERGY_KEYFRAMES[i];
        const b = exports.PARTICLE_ENERGY_KEYFRAMES[i + 1];
        if (p >= a.progress && p <= b.progress)
            return { a, b, p };
    }
    return {
        a: exports.PARTICLE_ENERGY_KEYFRAMES[exports.PARTICLE_ENERGY_KEYFRAMES.length - 2],
        b: exports.PARTICLE_ENERGY_KEYFRAMES[exports.PARTICLE_ENERGY_KEYFRAMES.length - 1],
        p
    };
}
function sampleParticleEnergy(progress) {
    const { a, b, p } = findSegment(progress);
    const span = Math.max(1e-8, b.progress - a.progress);
    const t = smoother((p - a.progress) / span);
    const lerp = (x, y) => x + (y - x) * t;
    return {
        density: lerp(a.density, b.density),
        opacity: lerp(a.opacity, b.opacity),
        expansion: lerp(a.expansion, b.expansion),
        spiral: lerp(a.spiral, b.spiral),
        turbulence: lerp(a.turbulence, b.turbulence),
        magneticPull: lerp(a.magneticPull, b.magneticPull),
        burst: lerp(a.burst, b.burst),
        coreBias: lerp(a.coreBias, b.coreBias),
        goldMix: lerp(a.goldMix, b.goldMix),
        pointScale: lerp(a.pointScale, b.pointScale),
        flowSpeed: lerp(a.flowSpeed, b.flowSpeed),
        lightningGain: lerp(a.lightningGain, b.lightningGain)
    };
}
function integrateParticleFlowProgress(progress) {
    const p = clamp01(Number.isFinite(progress) ? progress : 0);
    let integral = 0;
    for (let i = 0; i < exports.PARTICLE_ENERGY_KEYFRAMES.length - 1; i += 1) {
        const a = exports.PARTICLE_ENERGY_KEYFRAMES[i];
        const b = exports.PARTICLE_ENERGY_KEYFRAMES[i + 1];
        if (p <= a.progress)
            break;
        const span = Math.max(1e-8, b.progress - a.progress);
        const local = clamp01((Math.min(p, b.progress) - a.progress) / span);
        const localIntegral = a.flowSpeed * local + (b.flowSpeed - a.flowSpeed) * smootherIntegral(local);
        integral += span * localIntegral;
        if (p <= b.progress)
            break;
    }
    return integral;
}
