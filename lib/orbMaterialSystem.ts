import * as THREE from "three";
import type { OrbQualityProfile } from "./assetProfile";

export type PremiumMaterialRole =
  | "shell-graphite"
  | "antique-gold"
  | "crystal-ice"
  | "shell-inner"
  | "platform-obsidian"
  | "energy-well"
  | "rune-emissive"
  | "core-inner"
  | "core-energy"
  | "energy-filament"
  | "energy-lightning"
  | "energy-beam"
  | "core-vortex"
  | "core-halo"
  | "fallback";

export type PremiumMaterialAudit = {
  created: Set<THREE.Material>;
  materialNames: Set<string>;
  roleCounts: Record<string, number>;
};

type MaterialFactoryContext = {
  profile: OrbQualityProfile;
  source: THREE.Material;
};

const css = (value: string) => new THREE.Color(value);

function finalize<T extends THREE.Material>(material: T, name: string, role: PremiumMaterialRole): T {
  material.name = name;
  material.toneMapped = true;
  material.userData = {
    ...material.userData,
    premiumRole: role,
    premiumMaterialPhase: 4
  };
  if ("dithering" in material) material.dithering = true;
  return material;
}

function physical(
  source: THREE.Material,
  role: PremiumMaterialRole,
  parameters: THREE.MeshPhysicalMaterialParameters
) {
  const material = new THREE.MeshPhysicalMaterial(parameters);
  return finalize(material, source.name, role);
}

function standard(
  source: THREE.Material,
  role: PremiumMaterialRole,
  parameters: THREE.MeshStandardMaterialParameters
) {
  const material = new THREE.MeshStandardMaterial(parameters);
  return finalize(material, source.name, role);
}

function makeMaterial({ profile, source }: MaterialFactoryContext): THREE.Material {
  const mobile = profile.profile === "mobile";
  const lowPower = profile.tier === "low-power";

  switch (source.name) {
    case "MAT_Shell_Graphite":
      return physical(source, "shell-graphite", {
        color: css("#111722"),
        metalness: 0.82,
        roughness: 0.33,
        clearcoat: lowPower ? 0.08 : 0.20,
        clearcoatRoughness: 0.31,
        envMapIntensity: mobile ? 1.12 : 1.42
      });

    case "MAT_Antique_Gold":
      return physical(source, "antique-gold", {
        color: css("#c18a3d"),
        metalness: 1,
        roughness: 0.24,
        clearcoat: lowPower ? 0.06 : 0.16,
        clearcoatRoughness: 0.22,
        envMapIntensity: mobile ? 1.28 : 1.65
      });

    case "MAT_Crystal_Ice":
      return physical(source, "crystal-ice", {
        color: css("#79c9ff"),
        metalness: 0,
        roughness: mobile ? 0.095 : 0.065,
        transmission: lowPower ? 0.36 : mobile ? 0.52 : 0.72,
        thickness: mobile ? 0.24 : 0.34,
        ior: 1.46,
        attenuationColor: css("#4e8fcb"),
        attenuationDistance: 1.75,
        envMapIntensity: mobile ? 1.25 : 1.72,
        clearcoat: lowPower ? 0.16 : 0.36,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide
      });

    case "MAT_Shell_Inner":
      return physical(source, "shell-inner", {
        color: css("#0b1018"),
        metalness: 0.63,
        roughness: 0.52,
        clearcoat: lowPower ? 0 : 0.08,
        clearcoatRoughness: 0.46,
        envMapIntensity: mobile ? 0.72 : 0.94,
        emissive: css("#02101c"),
        emissiveIntensity: 0.12,
        side: THREE.FrontSide
      });

    case "MAT_Platform_Obsidian":
      return physical(source, "platform-obsidian", {
        color: css("#080b11"),
        metalness: 0.66,
        roughness: 0.30,
        clearcoat: lowPower ? 0.08 : 0.32,
        clearcoatRoughness: 0.21,
        envMapIntensity: mobile ? 0.82 : 1.14
      });

    case "MAT_Rune_Emissive":
      return standard(source, "rune-emissive", {
        color: css("#8c4318"),
        metalness: 0.32,
        roughness: 0.30,
        emissive: css("#ff862b"),
        emissiveIntensity: 1.12
      });

    case "MAT_Core_InnerWhite":
      return standard(source, "core-inner", {
        color: css("#bdeeff"),
        metalness: 0,
        roughness: 0.12,
        emissive: css("#d8f7ff"),
        emissiveIntensity: 1.32
      });

    case "MAT_EnergyWell_Blue":
      return standard(source, "energy-well", {
        color: css("#0c4da0"),
        metalness: 0,
        roughness: 0.18,
        emissive: css("#176dd8"),
        emissiveIntensity: 1.02,
        transparent: true,
        opacity: 0.68,
        depthWrite: false
      });

    case "MAT_Core_EnergyShell":
      return standard(source, "core-energy", {
        color: css("#1668d8"),
        metalness: 0,
        roughness: 0.12,
        emissive: css("#2898ff"),
        emissiveIntensity: 1.20,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        side: THREE.DoubleSide
      });

    case "MAT_Energy_Filament":
      return standard(source, "energy-filament", {
        color: css("#4fbaff"),
        metalness: 0,
        roughness: 0.10,
        emissive: css("#4fc8ff"),
        emissiveIntensity: 1.35,
        transparent: true,
        opacity: 0.80,
        depthWrite: false
      });

    case "MAT_Energy_Lightning":
      return standard(source, "energy-lightning", {
        color: css("#b8edff"),
        metalness: 0,
        roughness: 0.08,
        emissive: css("#9fe8ff"),
        emissiveIntensity: 1.55,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      });

    case "MAT_Energy_Beam":
      return standard(source, "energy-beam", {
        color: css("#2e96ff"),
        metalness: 0,
        roughness: 0.12,
        emissive: css("#3fb8ff"),
        emissiveIntensity: 1.10,
        transparent: true,
        opacity: 0.27,
        depthWrite: false,
        side: THREE.DoubleSide
      });

    case "MAT_Core_BlueWhite":
      return standard(source, "core-vortex", {
        color: css("#4a9cff"),
        metalness: 0,
        roughness: 0.12,
        emissive: css("#8edbff"),
        emissiveIntensity: 1.05
      });

    case "MAT_Core_Halo":
      return standard(source, "core-halo", {
        color: css("#5fb9ff"),
        metalness: 0,
        roughness: 0.15,
        emissive: css("#4ba7ff"),
        emissiveIntensity: 0.82,
        transparent: true,
        opacity: 0.17,
        depthWrite: false,
        side: THREE.DoubleSide
      });

    default: {
      const clone = source.clone();
      return finalize(clone, source.name || "MAT_Fallback", "fallback");
    }
  }
}

export function applyPremiumOrbMaterials(root: THREE.Object3D, profile: OrbQualityProfile): PremiumMaterialAudit {
  const created = new Set<THREE.Material>();
  const materialNames = new Set<string>();
  const roleCounts: Record<string, number> = {};
  const cache = new Map<string, THREE.Material>();

  const resolve = (source: THREE.Material) => {
    const cacheKey = `${source.uuid}:${profile.profile}:${profile.tier}`;
    let material = cache.get(cacheKey);
    if (!material) {
      material = makeMaterial({ source, profile });
      cache.set(cacheKey, material);
      created.add(material);
    }
    const role = String(material.userData.premiumRole || "fallback");
    materialNames.add(material.name);
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    return material;
  };

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (Array.isArray(node.material)) node.material = node.material.map(resolve);
    else if (node.material) node.material = resolve(node.material);
  });

  return { created, materialNames, roleCounts };
}
