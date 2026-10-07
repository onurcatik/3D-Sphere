export type ParticleBudgetTier = "desktop-high" | "desktop-balanced" | "tablet" | "mobile" | "low-power";

export type ParticleBudget = {
  cap: number;
  field: number;
  core: number;
  debris: number;
  dust: number;
  total: number;
};

const PARTICLE_BUDGETS: Record<ParticleBudgetTier, Omit<ParticleBudget, "total">> = {
  "desktop-high": { cap: 3000, field: 1350, core: 760, debris: 300, dust: 240 },
  "desktop-balanced": { cap: 3000, field: 1150, core: 620, debris: 260, dust: 190 },
  tablet: { cap: 3000, field: 850, core: 450, debris: 190, dust: 130 },
  mobile: { cap: 1000, field: 430, core: 240, debris: 130, dust: 70 },
  "low-power": { cap: 1000, field: 280, core: 150, debris: 70, dust: 40 }
};

export function getParticleBudget(profile: { tier: ParticleBudgetTier }): ParticleBudget {
  const base = PARTICLE_BUDGETS[profile.tier];
  const total = base.field + base.core + base.debris + base.dust;
  if (total > base.cap) {
    throw new Error(`Particle budget exceeds cap for ${profile.tier}: ${total} > ${base.cap}`);
  }
  return { ...base, total };
}

export const PARTICLE_BUDGET_PRESETS = PARTICLE_BUDGETS;
