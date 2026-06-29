import type { ModelRegistryEntry } from "@/lib/types";

export const CREDIT_FLOOR_USD = 0.008;
export const MEDIA_MARGIN_MULTIPLIER = 3.5;
export const CREDIT_RETAIL_USD = 0.013;

export function creditsForUsd(costUsd: number) {
  return Math.ceil((costUsd * MEDIA_MARGIN_MULTIPLIER) / CREDIT_FLOOR_USD);
}

export function estimateCredits(
  model: ModelRegistryEntry,
  options: { durationSeconds?: number; characters?: number } = {}
) {
  if (model.costUnit === "second") {
    return creditsForUsd(model.costUsd * Math.max(1, options.durationSeconds ?? 5));
  }

  if (model.costUnit === "thousand_chars") {
    const units = Math.max(1, Math.ceil((options.characters ?? 1000) / 1000));
    return creditsForUsd(model.costUsd * units);
  }

  return creditsForUsd(model.costUsd);
}

export function revenueAtFloor(credits: number) {
  return credits * CREDIT_FLOOR_USD;
}

export function mediaMarginPercent(costUsd: number, credits: number) {
  const revenue = revenueAtFloor(credits);
  if (!revenue) return 0;
  return Math.round(((revenue - costUsd) / revenue) * 100);
}

export const plans = [
  {
    id: "free",
    label: "Free",
    priceUsd: 0,
    credits: 80,
    fairUseMessages: "20/jour",
    note: "Images économiques avec filigrane"
  },
  {
    id: "starter",
    label: "Starter",
    priceUsd: 15,
    credits: 1000,
    fairUseMessages: "300/mois",
    note: "Créateurs solo et réseaux sociaux"
  },
  {
    id: "pro",
    label: "Pro",
    priceUsd: 49,
    credits: 4500,
    fairUseMessages: "1500/mois",
    note: "Production régulière image et vidéo"
  },
  {
    id: "studio",
    label: "Studio",
    priceUsd: 129,
    credits: 12000,
    fairUseMessages: "4000/mois",
    note: "Agences, priorité file et gros volumes"
  }
] as const;
