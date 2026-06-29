import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 0
  }).format(value);
}

export function safeJson<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object") return fallback;
  return value as T;
}
