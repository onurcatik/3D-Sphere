# 🪐 3D Cinematic Sphere — Immersive WebGL Experience

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r181-000000?style=flat-square&logo=three.js)](https://threejs.org/)
[![R3F](https://img.shields.io/badge/R3F-v9.4-black?style=flat-square)](https://docs.pmnd.rs/react-three-fiber/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![GSAP](https://img.shields.io/badge/GSAP-3.13-88CE02?style=flat-square&logo=greensock)](https://greensock.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

An interactive, scrollytelling WebGL showcase delivering a high-fidelity 3D cinematic journey. Built upon **Next.js 16**, **React Three Fiber (R3F)**, **Three.js**, and custom procedural shaders, the project orchestrates an 11-second deterministic physics, lighting, and mechanical transformation of an articulated crystalline core and multi-segment outer sphere.

---

## 🌟 Key Architectural Pillars

### 1. Deterministic Scrollytelling Engine
* **Single Scene Sampler (`sampleScene`)**: Unifies the entire render loop across camera, materials, lighting, particle fields, and post-processing from a central `sceneTime` tick.
* **Monotone Cubic Hermite Spline Mapping**: Eliminates abrupt velocity steps across chapter boundaries by interpolating $700\,\text{vh}$ of scroll distance to an exact $11.00\,\text{s}$ timeline with strict $C^1$ velocity continuity.
* **Dual Scroll Pipeline**: Employs **Lenis** smooth inertial scrolling on desktop workstations while seamlessly reverting to native momentum scroll on touch devices to eliminate input lag.

### 2. Articulated Mechanical Geometry & PBR Materials
* **14-Piece Shell Delamination**: Precise GLTF node choreography (`Shell_01` through `Shell_14`) driven by authored translations and rotations baked directly into the asset pipeline.
* **Multi-Layered Volumetric Core**: Features a dynamic four-tier inner nucleus—`Runtime_InnerCore`, `Core_Vortex_GEO`, `Core_EnergyShell_GEO`, and `Core_Halo_GEO`.
* **Advanced Material Extensions**: Leverages Khronos PBR extensions (`KHR_materials_clearcoat`, `KHR_materials_transmission`, `KHR_materials_volume`, `KHR_materials_ior`, and `KHR_materials_emissive_strength`) for realistic refraction, dispersion, and energy conduits.

### 3. Dynamic Director & Responsive Camera Rig
* **Framing Safeguards Across 5 Device Profiles**: Automated camera positioning for *Desktop Ultra/High*, *Desktop Balanced*, *Tablet Portrait*, *Mobile Portrait*, and *Mobile Landscape*.
* **Narrative Anti-Collision Offset**: Dynamically shifts framing and perspective away from editorial copy to ensure unhindered visibility of the orb's internal mechanics.
* **Conservative Bounds Tracking**: Projects 3D boundary boxes across 661 temporal steps to verify zero frustum clipping at extreme aspect ratios.

### 4. Atmospheric Depth & Restrained Lighting
* **Hierarchical Illumination**: Keyed direct shadows, high-temperature rear rim lights, cool fill gradients, and localized nucleus light sources.
* **PMREM Dynamic Environment**: Real-time roughness reflections synchronized to the timeline, avoiding excessive bloom reliance.
* **Volumetric Light Shafts & Temple Acoustics**: Procedurally rendered light rays, ambient dust particles, and analytical contact shadows grounded in 3D space.

### 5. Runtime Performance Governor
* **Adaptive DPR & Framerate Sentinel**: Dynamically balances resolution scale between $0.75\times$ and $2.0\times$ targeting steady 60 FPS across low-tier and mobile GPUs.
* **Shared Particle Budgets**: Global hardware limits constrain total simulation instances ($\le 3{,}000$ particles on desktop; $\le 1{,}000$ on mobile) across energy streams, fractured debris, and dust.
* **Highlight Pressure & Post-FX Restraint**: Shared luminance caps prevent optical bloom blowouts and preserve crystal faceting during core detonation.

---

## ⏱️ Cinematic Timeline & Choreography

The narrative unfolds along an exact $11.00$-second lifecycle divided into distinct choreographic phases:

| Keyframe (s) | Progress | Movement Phase | Scene State & Visual Characteristics |
| :---: | :---: | :--- | :--- |
| **0.00 s** | `0.00` | **Dormant Core** | Outer shell sealed; sub-surface luminescent pulse; deep cold ambient fog. |
| **1.54 s** | `0.14` | **Awakening & Tension** | Internal core excitation; mechanical seams breach with high-intensity light. |
| **3.08 s** | `0.28` | **Shell Delamination** | Groups A, B, and C peel outwards with calibrated delay; micro-debris ejection. |
| **5.50 s** | `0.50` | **Core Reveal (Peak)** | Shell reaches maximum stable expansion; crystal vortex unshielded; light shaft focus. |
| **6.93 s** | `0.63` | **Equilibrium** | Gravitational suspension; magnetic arcs stabilize between core and orbiting segments. |
| **7.92 s** | `0.72` | **Magnetic Recall** | Inversion wave; rotational alignment triggers opposite-pair return trajectories. |
| **10.34 s** | `0.94` | **Hermetic Sealing** | Micro-latches dock; sealing ring collapses; energy arcs dissipate. |
| **11.00 s** | `1.00` | **Latent State** | Complete mechanical lock; resting thermal glow; seamless loop cycle. |

---

## 🛠️ Technology Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React Server Components & Turbopack architecture)
* **View Layer**: [React 19](https://react.dev/)
* **3D & Graphics Engine**: [Three.js](https://threejs.org/) (r181) & [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) (v9)
* **3D Helpers & Shaders**: [@react-three/drei](https://github.com/pmndrs/drei) & [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing)
* **Animation & Smooth Scroll**: [GSAP](https://greensock.com/gsap/) (v3) & [Lenis](https://lenis.darkroom.engineering/) (v1.3)
* **Typing & Linting**: TypeScript 5.8, ESLint 10, typescript-eslint
* **Asset Pipeline**: Python 3 (Trimesh, PyGLTFLib, NumPy, Pillow)
* **Testing & QA**: Playwright, Pixelmatch, Lighthouse

---

## 📂 Repository Structure

```
.
├── app/                        # Next.js App Router root, metadata, & global stylesheets
│   ├── globals.css             # Fluid layout, safe areas, cinematic design tokens
│   ├── layout.tsx              # Root HTML layout and viewport configuration
│   └── page.tsx                # Primary experience entry point
├── components/
│   ├── experience/             # Orchestration hooks, scrollytelling listeners & canvas wrapper
│   │   ├── CinematicExperience.tsx
│   │   └── useCinematicScroll.ts
│   ├── scene/                  # R3F components (Canvas, Lighting, Camera, Geometry, PostFX)
│   │   ├── AdaptiveQualityController.tsx
│   │   ├── CameraRig.tsx
│   │   ├── CinematicAtmosphere.tsx
│   │   ├── CinematicCanvas.tsx
│   │   ├── CinematicPostFX.tsx
│   │   ├── MaterialEnvironment.tsx
│   │   ├── OrbModel.tsx
│   │   ├── ParticleEnergyField.tsx
│   │   ├── SceneLighting.tsx
│   │   ├── ShellFractureFX.tsx
│   │   ├── TempleEnvironment.tsx
│   │   └── VolumetricLightShaft.tsx
│   └── ui/                     # HUD, telemetry overlays, and scrollytelling narrative panels
│       ├── ChapterRail.tsx
│       ├── SceneHUD.tsx
│       └── ScrollNarrative.tsx
├── lib/                        # Core mathematical timelines, shaders, and state contracts
│   ├── assetProfile.ts         # Device detection & tier capability matrix
│   ├── cameraTimeline.ts       # 661-sample camera trajectory & FOV spline
│   ├── cinematicLook.ts        # Look LUTs, grading tokens, and color balancing
│   ├── coreEnergyTimeline.ts   # Core vortex, ribbon, and halo parameters
│   ├── lightingTimeline.ts     # Key/rim/fill intensity and shadow map budgets
│   ├── orbBreakupTimeline.ts   # 14-piece shell delamination formulas
│   ├── orbMaterialSystem.ts    # PBR material overrides & shader injection
│   ├── orbReassemblyTimeline.ts# Magnetic return curves and sealing rings
│   ├── particleBudget.ts       # Global simulation quotas per hardware tier
│   ├── postProcessingBudget.ts # Highlight pressure and bloom attenuators
│   └── scrollTimeline.ts       # Hermite spline mapping & C1 continuity drivers
├── public/
│   └── models/                 # Optimized desktop & mobile GLB models
├── spec/                       # Formal specification contracts (v3 architecture)
├── tools/                      # Offline Python GLTF authoring & QA validation scripts
└── visual-baseline/            # Reference renders for visual regression verification
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v20.x` or later (LTS recommended)
* **npm**: `v10.x` or later
* **Python**: `3.10+` (optional, for asset pipeline authoring & validation tools)

### Installation
```bash
# Clone repository
git clone https://github.com/onurcatik/3D-Sphere.git
cd 3D-Sphere

# Install package dependencies
npm install
```

### Development Server
Start the local Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to experience the real-time render.

### Production Build
Validate types and compile the optimized bundle:
```bash
# Typecheck
npm run typecheck

# Production build
npm run build

# Start production server
npm run start
```

---

## 🧪 Pipeline Scripts & Quality Assurance

The repository includes a comprehensive toolchain for validating GLTF binary integrity, mathematical continuity, and render constraints.

| Command | Description |
| :--- | :--- |
| `npm run validate` | Runs master validation suite ensuring asset parity and runtime syntax. |
| `npm run validate:v3:faz8` | Verifies camera framing bounding boxes across 661 temporal samples. |
| `npm run validate:v3:faz9` | Checks lighting hierarchy, shadow budget constraints, and PMREM integrity. |
| `npm run validate:v3:faz10` | Enforces global particle caps and post-processing highlight thresholds. |
| `npm run qa:saturation` | Analyzes visual baseline frames against near-white pixel blowout thresholds. |
| `npm run models:v3` | Rebuilds active desktop and mobile GLBs via the offline Python pipeline. |

---

## 📱 Mobile & Low-Power Optimization

* **Responsive Viewport Support**: Standardizes dynamic viewport heights with `dvh` / `svh` fallbacks, accommodating iOS navigation bars.
* **Touch Device Parallax Disabling**: Disables pointer gyro/mouse parallax on touch-enabled devices to reduce GPU thrashing.
* **Automated Shadow Disabling**: Automatically drops contact shadow resolution or falls back to baked ambient planes on Tier 1 (Low-Power) hardware.
* **Asset Specialization**: Transmits lighter polygon topologies and stripped secondary anim channels specifically to mobile targets (`orb_v3_faz7_mobile.glb`).

