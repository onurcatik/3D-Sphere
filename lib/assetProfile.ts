export type DeviceTier = "desktop-high" | "desktop-balanced" | "tablet" | "mobile" | "low-power";
export type InputMode = "mouse" | "touch";
export type ScreenOrientation = "portrait" | "landscape";

export type OrbQualityProfile = {
  profile: "desktop" | "mobile";
  tier: DeviceTier;
  inputMode: InputMode;
  orientation: ScreenOrientation;
  url: string;
  minDpr: number;
  maxDpr: number;
  particleCount: number;
  particleScale: number;
  environmentDustCount: number;
  environmentDetail: "full" | "reduced" | "minimal";
  beamSegments: number;
  dof: boolean;
  shadows: "medium" | "high";
  shadowMapSize: number;
  antialias: boolean;
  pointerParallax: number;
  cameraDistanceScale: number;
  cameraOrbitScale: number;
  cameraCompositionScale: number;
  cameraFovOffset: number;
  cameraTargetYOffset: number;
  nativeTouchScroll: boolean;
  reasons: Record<string, string | number | boolean>;
};

type NavigatorWithDeviceInfo = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
  mozConnection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
  webkitConnection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

const DESKTOP_URL = "/models/orb_v3_faz7_desktop.glb";
const MOBILE_URL = "/models/orb_v3_faz7_mobile.glb";

function serverProfile(): OrbQualityProfile {
  return {
    profile: "desktop",
    tier: "desktop-balanced",
    inputMode: "mouse",
    orientation: "landscape",
    url: DESKTOP_URL,
    minDpr: 0.9,
    maxDpr: 1.5,
    particleCount: 1500,
    particleScale: 0.92,
    environmentDustCount: 220,
    environmentDetail: "full",
    beamSegments: 40,
    dof: true,
    shadows: "high",
    shadowMapSize: 1536,
    antialias: true,
    pointerParallax: 0.85,
    cameraDistanceScale: 1,
    cameraOrbitScale: 1,
    cameraCompositionScale: 1,
    cameraFovOffset: 0,
    cameraTargetYOffset: 0,
    nativeTouchScroll: false,
    reasons: { ssr: true }
  };
}

export function chooseOrbProfile(): OrbQualityProfile {
  if (typeof window === "undefined") return serverProfile();

  const nav = navigator as NavigatorWithDeviceInfo;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const orientation: ScreenOrientation = width >= height ? "landscape" : "portrait";
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hoverNone = window.matchMedia("(hover: none)").matches;
  const inputMode: InputMode = coarsePointer || hoverNone ? "touch" : "mouse";
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || "");
  const memory = Number(nav.deviceMemory || 8);
  const cores = Number(nav.hardwareConcurrency || 8);
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const saveData = Boolean(conn?.saveData);
  const effectiveType = conn?.effectiveType || "unknown";
  const slowNetwork = /(^|-)2g$/.test(effectiveType);
  const compact = width <= 430 || Math.min(width, height) <= 390;
  const lowPower = memory <= 2 || cores <= 2 || saveData || slowNetwork;
  const mobileLayout = mobileUA || width <= 780 || (coarsePointer && width <= 900);
  const tabletLayout = !mobileLayout && (width <= 1180 || coarsePointer);

  let tier: DeviceTier;
  if (lowPower) tier = "low-power";
  else if (mobileLayout) tier = "mobile";
  else if (tabletLayout) tier = "tablet";
  else if (memory >= 8 && cores >= 8 && width >= 1440) tier = "desktop-high";
  else tier = "desktop-balanced";

  const usesMobileAsset = tier === "mobile" || tier === "low-power" || (tier === "tablet" && width < 920);
  const portraitMobile = usesMobileAsset && orientation === "portrait";

  const presets: Record<DeviceTier, Omit<OrbQualityProfile, "profile" | "tier" | "inputMode" | "orientation" | "url" | "reasons">> = {
    "desktop-high": {
      minDpr: 1,
      maxDpr: Math.min(1.8, dpr),
      particleCount: 1800,
      particleScale: 1,
      environmentDustCount: 260,
      environmentDetail: "full",
      beamSegments: 48,
      dof: true,
      shadows: "high",
      shadowMapSize: 1536,
      antialias: true,
      pointerParallax: 1,
      cameraDistanceScale: 1,
      cameraOrbitScale: 1,
      cameraCompositionScale: 1,
      cameraFovOffset: 0,
      cameraTargetYOffset: 0,
      nativeTouchScroll: false
    },
    "desktop-balanced": {
      minDpr: 0.9,
      maxDpr: Math.min(1.55, dpr),
      particleCount: 1450,
      particleScale: 0.9,
      environmentDustCount: 210,
      environmentDetail: "full",
      beamSegments: 40,
      dof: true,
      shadows: "high",
      shadowMapSize: 1280,
      antialias: true,
      pointerParallax: 0.82,
      cameraDistanceScale: 1,
      cameraOrbitScale: 1,
      cameraCompositionScale: 1,
      cameraFovOffset: 0,
      cameraTargetYOffset: 0,
      nativeTouchScroll: false
    },
    tablet: {
      minDpr: 0.85,
      maxDpr: Math.min(1.35, dpr),
      particleCount: 1050,
      particleScale: 0.72,
      environmentDustCount: 150,
      environmentDetail: "reduced",
      beamSegments: 32,
      dof: false,
      shadows: "medium",
      shadowMapSize: 768,
      antialias: true,
      pointerParallax: inputMode === "touch" ? 0 : 0.45,
      cameraDistanceScale: 1.24,
      cameraOrbitScale: 0.82,
      cameraCompositionScale: 0.24,
      cameraFovOffset: 4.5,
      cameraTargetYOffset: orientation === "portrait" ? -0.14 : -0.08,
      nativeTouchScroll: inputMode === "touch"
    },
    mobile: {
      minDpr: compact ? 0.7 : 0.78,
      maxDpr: Math.min(compact ? 1.08 : 1.18, dpr),
      particleCount: compact ? 560 : 720,
      particleScale: compact ? 0.48 : 0.56,
      environmentDustCount: compact ? 62 : 86,
      environmentDetail: "minimal",
      beamSegments: compact ? 18 : 24,
      dof: false,
      shadows: "medium",
      shadowMapSize: 512,
      antialias: !compact,
      pointerParallax: 0,
      cameraDistanceScale: portraitMobile ? 1.52 : 1.16,
      cameraOrbitScale: portraitMobile ? 0.50 : 0.76,
      cameraCompositionScale: portraitMobile ? 0.04 : 0.28,
      cameraFovOffset: portraitMobile ? 10 : 3.5,
      cameraTargetYOffset: portraitMobile ? -0.78 : -0.22,
      nativeTouchScroll: true
    },
    "low-power": {
      minDpr: 0.65,
      maxDpr: Math.min(0.95, dpr),
      particleCount: 420,
      particleScale: 0.42,
      environmentDustCount: 44,
      environmentDetail: "minimal",
      beamSegments: 16,
      dof: false,
      shadows: "medium",
      shadowMapSize: 384,
      antialias: false,
      pointerParallax: 0,
      cameraDistanceScale: portraitMobile ? 1.54 : 1.20,
      cameraOrbitScale: portraitMobile ? 0.48 : 0.72,
      cameraCompositionScale: portraitMobile ? 0.05 : 0.24,
      cameraFovOffset: portraitMobile ? 10 : 4,
      cameraTargetYOffset: portraitMobile ? -0.80 : -0.24,
      nativeTouchScroll: true
    }
  };

  return {
    profile: usesMobileAsset ? "mobile" : "desktop",
    tier,
    inputMode,
    orientation,
    url: usesMobileAsset ? MOBILE_URL : DESKTOP_URL,
    ...presets[tier],
    reasons: {
      width,
      height,
      dpr,
      orientation,
      inputMode,
      mobileUA,
      coarsePointer,
      memory,
      cores,
      saveData,
      effectiveType,
      compact,
      lowPower
    }
  };
}

export function profileIdentity(profile: OrbQualityProfile): string {
  return [profile.tier, profile.inputMode, profile.orientation, profile.url, profile.maxDpr].join(":");
}
