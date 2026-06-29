import type { ModelRegistryEntry, ModelType } from "@/lib/types";

export const aspectRatios = ["1:1", "4:5", "9:16", "16:9", "3:4", "4:3"];

export const modelRegistry: ModelRegistryEntry[] = [
  {
    id: "seedream-lite",
    label: "Seedream Lite",
    provider: "ByteDance",
    type: "image",
    falEndpoint: process.env.FAL_SEEDREAM_ENDPOINT ?? "fal-ai/seedream/v4/text-to-image",
    costUsd: 0.035,
    costUnit: "image",
    default: true,
    supports: { aspectRatios, referenceImages: 4 },
    pricingHint: "Rapide et économique pour variantes et réseaux sociaux"
  },
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "Google",
    type: "image",
    falEndpoint: process.env.FAL_NANO_BANANA_PRO_ENDPOINT ?? "fal-ai/nano-banana-pro",
    costUsd: 0.15,
    costUnit: "image",
    supports: { aspectRatios, referenceImages: 5 },
    pricingHint: "Premium, meilleure adhérence au prompt"
  },
  {
    id: "flux-kontext",
    label: "FLUX Kontext Pro",
    provider: "Black Forest Labs",
    type: "image_edit",
    falEndpoint: process.env.FAL_FLUX_KONTEXT_ENDPOINT ?? "fal-ai/flux-pro/kontext",
    costUsd: 0.04,
    costUnit: "image",
    default: true,
    supports: { aspectRatios, referenceImages: 4 },
    pricingHint: "Retouche et transfert de style de production"
  },
  {
    id: "seedream-edit",
    label: "Seedream Edit Lite",
    provider: "ByteDance",
    type: "image_edit",
    falEndpoint: process.env.FAL_SEEDREAM_EDIT_ENDPOINT ?? "fal-ai/seedream/v4/edit",
    costUsd: 0.035,
    costUnit: "image",
    supports: { aspectRatios, referenceImages: 6 },
    pricingHint: "Retouche économique et batch"
  },
  {
    id: "kling-turbo",
    label: "Kling Turbo",
    provider: "Kuaishou",
    type: "video",
    falEndpoint: process.env.FAL_KLING_VIDEO_ENDPOINT ?? "fal-ai/kling-video/v2.1/master/image-to-video",
    costUsd: 0.12,
    costUnit: "second",
    default: true,
    supports: { aspectRatios, startEndFrame: true, referenceImages: 2, durations: [5, 10] },
    pricingHint: "Bon mouvement, coût maîtrisé"
  },
  {
    id: "veo-cinema",
    label: "Veo Cinema",
    provider: "Google",
    type: "video",
    falEndpoint: process.env.FAL_VEO_ENDPOINT ?? "fal-ai/veo3",
    costUsd: 0.2,
    costUnit: "second",
    supports: { aspectRatios, audio: false, startEndFrame: true, referenceImages: 3, durations: [5, 8] },
    pricingHint: "Cinéma, physique solide, premium"
  },
  {
    id: "minimax-tts",
    label: "MiniMax Speech HD",
    provider: "MiniMax",
    type: "tts",
    falEndpoint: process.env.FAL_MINIMAX_TTS_ENDPOINT ?? "fal-ai/minimax/speech-02-hd",
    costUsd: 0.1,
    costUnit: "thousand_chars",
    default: true,
    supports: {},
    pricingHint: "Voix complète, émotion et multilingue"
  },
  {
    id: "dia-tts",
    label: "Dia TTS",
    provider: "Nari Labs",
    type: "tts",
    falEndpoint: process.env.FAL_DIA_TTS_ENDPOINT ?? "fal-ai/dia-tts",
    costUsd: 0.04,
    costUnit: "thousand_chars",
    supports: {},
    pricingHint: "Dialogue et coût bas"
  },
  {
    id: "voice-clone",
    label: "MiniMax Voice Clone",
    provider: "MiniMax",
    type: "voice_clone",
    falEndpoint: process.env.FAL_VOICE_CLONE_ENDPOINT ?? "fal-ai/minimax/voice-clone",
    costUsd: 1.5,
    costUnit: "action",
    default: true,
    supports: {},
    pricingHint: "Clonage ponctuel, confirmation requise"
  },
  {
    id: "sync-lipsync",
    label: "Sync Lipsync",
    provider: "Sync Labs",
    type: "lipsync",
    falEndpoint: process.env.FAL_SYNC_LIPSYNC_ENDPOINT ?? "fal-ai/sync-lipsync",
    costUsd: 0.014,
    costUnit: "second",
    default: true,
    supports: { durations: [5, 10, 15] },
    pricingHint: "Synchronisation labiale de qualité"
  }
];

export function getModel(id: string | undefined, type?: ModelType) {
  if (id) {
    const exact = modelRegistry.find((model) => model.id === id);
    if (exact) return exact;
  }

  return (
    modelRegistry.find((model) => model.type === type && model.default) ??
    modelRegistry.find((model) => !type || model.type === type) ??
    modelRegistry[0]
  );
}

export function listModels(type?: ModelType) {
  return type ? modelRegistry.filter((model) => model.type === type) : modelRegistry;
}
