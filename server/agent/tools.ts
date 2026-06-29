import { estimateCredits } from "../pricing";
import { getModel, listModels } from "../models";
import { saveGeneration } from "../db/repository";
import { submitFalJob } from "../fal";
import type { Generation, MediaType, ModelType } from "../types";

export type ToolContext = {
  userId: string;
  messageId: string;
  preferredAspectRatio?: string;
  onGeneration?: (generation: Generation) => void | Promise<void>;
};

export const anthropicTools = [
  {
    name: "generate_image",
    description: "Lance une génération d'image via fal.ai.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string" },
        model: { type: "string" },
        reference_image_ids: { type: "array", items: { type: "string" } }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generate_video",
    description: "Lance une génération vidéo ou image-to-video après confirmation du coût.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string" },
        model: { type: "string" },
        start_image_id: { type: "string" },
        end_image_id: { type: "string" },
        duration: { type: "number" },
        confirmed: { type: "boolean" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "edit_image",
    description: "Retouche une image existante.",
    input_schema: {
      type: "object",
      properties: {
        image_id: { type: "string" },
        instruction: { type: "string" },
        model: { type: "string" }
      },
      required: ["image_id", "instruction"]
    }
  },
  {
    name: "generate_voice",
    description: "Génère une voix off.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        voice_id: { type: "string" },
        model: { type: "string" }
      },
      required: ["text"]
    }
  },
  {
    name: "lipsync",
    description: "Synchronise une vidéo avec un audio.",
    input_schema: {
      type: "object",
      properties: {
        video_id: { type: "string" },
        audio_id: { type: "string" },
        duration: { type: "number" },
        confirmed: { type: "boolean" }
      },
      required: ["video_id", "audio_id"]
    }
  },
  {
    name: "list_available_models",
    description: "Liste les modèles disponibles.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string" }
      }
    }
  }
] as const;

const str = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;
const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown) => (typeof value === "boolean" ? value : false);

async function createMedia(input: {
  context: ToolContext;
  type: MediaType;
  modelType: ModelType;
  prompt: string;
  modelId?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  characters?: number;
  params?: Record<string, unknown>;
}) {
  const model = getModel(input.modelId, input.modelType);
  const aspectRatio = input.aspectRatio || input.context.preferredAspectRatio || "4:5";
  const credits = estimateCredits(model, {
    durationSeconds: input.durationSeconds,
    characters: input.characters
  });
  const falInput = {
    prompt: input.prompt,
    aspect_ratio: aspectRatio,
    duration: input.durationSeconds,
    ...input.params
  };
  const job = await submitFalJob(model, input.type, falInput);
  const generation = await saveGeneration({
    messageId: input.context.messageId,
    userId: input.context.userId,
    type: input.type,
    model: model.id,
    prompt: input.prompt,
    aspectRatio,
    status: job.status,
    falJobId: job.jobId,
    credits,
    params: falInput
  });
  await input.context.onGeneration?.(generation);
  return {
    generation_id: generation.id,
    status: generation.status,
    type: generation.type,
    model: model.label,
    credits,
    fal_job_id: generation.falJobId
  };
}

export async function executeTool(name: string, input: Record<string, unknown>, context: ToolContext) {
  if (name === "list_available_models") {
    const type = str(input.type) as ModelType | "";
    return listModels(type || undefined).map((model) => ({
      id: model.id,
      label: model.label,
      provider: model.provider,
      type: model.type,
      credits: estimateCredits(model),
      supports: model.supports,
      pricing_hint: model.pricingHint
    }));
  }

  if (name === "generate_image") {
    return createMedia({
      context,
      type: "image",
      modelType: "image",
      prompt: str(input.prompt, "Image créative"),
      aspectRatio: str(input.aspect_ratio),
      modelId: str(input.model),
      params: { reference_image_ids: input.reference_image_ids ?? [] }
    });
  }

  if (name === "generate_video") {
    const duration = num(input.duration, 5);
    const model = getModel(str(input.model), "video");
    const credits = estimateCredits(model, { durationSeconds: duration });
    if (!bool(input.confirmed) && credits >= 250) {
      return {
        needs_confirmation: true,
        model: model.label,
        duration,
        credits,
        message: `Cette vidéo coûtera ${credits} crédits. Demande confirmation avant de lancer.`
      };
    }
    return createMedia({
      context,
      type: "video",
      modelType: "video",
      prompt: str(input.prompt, "Vidéo courte cinématique"),
      aspectRatio: str(input.aspect_ratio),
      modelId: model.id,
      durationSeconds: duration,
      params: {
        start_image_id: input.start_image_id,
        end_image_id: input.end_image_id
      }
    });
  }

  if (name === "edit_image") {
    return createMedia({
      context,
      type: "image",
      modelType: "image_edit",
      prompt: str(input.instruction, "Retouche ciblée"),
      modelId: str(input.model),
      params: { image_id: input.image_id }
    });
  }

  if (name === "generate_voice") {
    const text = str(input.text);
    return createMedia({
      context,
      type: "audio",
      modelType: "tts",
      prompt: text,
      modelId: str(input.model),
      characters: text.length,
      params: { text, voice_id: input.voice_id }
    });
  }

  if (name === "lipsync") {
    const duration = num(input.duration, 5);
    return createMedia({
      context,
      type: "video",
      modelType: "lipsync",
      prompt: "Synchronisation labiale",
      durationSeconds: duration,
      params: { video_id: input.video_id, audio_id: input.audio_id }
    });
  }

  return { error: `Tool inconnu: ${name}` };
}
