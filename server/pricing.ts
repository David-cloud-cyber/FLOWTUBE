import type { ModelRegistryEntry } from "./types";

export const CREDIT_FLOOR_USD = 0.008;
export const CREDIT_RETAIL_USD = 0.013;
export const MEDIA_MARGIN_MULTIPLIER = 3.5;

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

export function mediaMargin(costUsd: number, credits: number) {
  const revenue = credits * CREDIT_FLOOR_USD;
  return revenue ? Math.round(((revenue - costUsd) / revenue) * 100) : 0;
}

export const plans = [
  { id: "free", label: "Free", priceUsd: 0, credits: 80, fairUse: "20/jour" },
  { id: "starter", label: "Starter", priceUsd: 15, credits: 1000, fairUse: "300/mois" },
  { id: "pro", label: "Pro", priceUsd: 49, credits: 4500, fairUse: "1500/mois" },
  { id: "studio", label: "Studio", priceUsd: 129, credits: 12000, fairUse: "4000/mois" }
] as const;
