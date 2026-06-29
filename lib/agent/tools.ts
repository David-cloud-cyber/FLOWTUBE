import { estimateCredits } from "@/lib/pricing";
import { aspectRatios, getModel, listModels } from "@/lib/models";
import { saveGeneration } from "@/lib/db/repository";
import { submitFalJob } from "@/lib/fal";
import type { Generation, MediaType, ModelType } from "@/lib/types";

type ToolContext = {
  userId: string;
  messageId: string;
  preferredAspectRatio?: string;
  onGeneration?: (generation: Generation) => void | Promise<void>;
};

export const anthropicTools = [
  {
    name: "generate_image",
    description: "Lance une génération d'image via fal.ai et crée une carte média.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string", enum: aspectRatios },
        model: { type: "string" },
        reference_image_ids: { type: "array", items: { type: "string" } }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generate_video",
    description: "Lance une génération vidéo ou image-to-video. Demande confirmation si la demande n'est pas déjà confirmée.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string", enum: aspectRatios },
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
    description: "Retouche une image existante avec une instruction textuelle.",
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
    name: "video_to_video",
    description: "Transforme une vidéo existante en gardant sa structure.",
    input_schema: {
      type: "object",
      properties: {
        video_id: { type: "string" },
        instruction: { type: "string" },
        model: { type: "string" },
        duration: { type: "number" },
        confirmed: { type: "boolean" }
      },
      required: ["video_id", "instruction"]
    }
  },
  {
    name: "generate_voice",
    description: "Génère une voix off depuis un texte.",
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
    name: "create_character",
    description: "Crée une référence de personnage réutilisable.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        reference_image_ids: { type: "array", items: { type: "string" } }
      },
      required: ["name", "reference_image_ids"]
    }
  },
  {
    name: "list_available_models",
    description: "Liste les modèles disponibles par type.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["image", "image_edit", "video", "video_edit", "tts", "voice_clone", "lipsync"]
        }
      }
    }
  }
] as const;

function stringInput(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberInput(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolInput(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

async function createMediaGeneration(input: {
  context: ToolContext;
  type: MediaType;
  modelType: ModelType;
  prompt: string;
  aspectRatio?: string;
  modelId?: string;
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
    fal_job_id: generation.falJobId,
    message:
      generation.status === "running" || generation.status === "pending"
        ? "Job lancé. Le front suit la progression via /api/generations/:id."
        : "Génération terminée."
  };
}

export async function executeTool(name: string, input: Record<string, unknown>, context: ToolContext) {
  if (name === "list_available_models") {
    const type = stringInput(input.type) as ModelType | "";
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
    return createMediaGeneration({
      context,
      type: "image",
      modelType: "image",
      prompt: stringInput(input.prompt, "Image publicitaire cinématique"),
      aspectRatio: stringInput(input.aspect_ratio),
      modelId: stringInput(input.model),
      params: { reference_image_ids: input.reference_image_ids ?? [] }
    });
  }

  if (name === "generate_video") {
    const duration = numberInput(input.duration, 5);
    const model = getModel(stringInput(input.model), "video");
    const credits = estimateCredits(model, { durationSeconds: duration });
    if (!boolInput(input.confirmed) && credits >= 250) {
      return {
        needs_confirmation: true,
        model: model.label,
        duration,
        credits,
        message: `Cette vidéo coûtera ${credits} crédits. Demande confirmation avant de lancer.`
      };
    }

    return createMediaGeneration({
      context,
      type: "video",
      modelType: "video",
      prompt: stringInput(input.prompt, "Vidéo courte cinématique"),
      aspectRatio: stringInput(input.aspect_ratio),
      modelId: model.id,
      durationSeconds: duration,
      params: {
        start_image_id: input.start_image_id,
        end_image_id: input.end_image_id
      }
    });
  }

  if (name === "edit_image") {
    return createMediaGeneration({
      context,
      type: "image",
      modelType: "image_edit",
      prompt: stringInput(input.instruction, "Retouche l'image"),
      modelId: stringInput(input.model),
      params: { image_id: input.image_id }
    });
  }

  if (name === "video_to_video") {
    const duration = numberInput(input.duration, 5);
    return createMediaGeneration({
      context,
      type: "video",
      modelType: "video",
      prompt: stringInput(input.instruction, "Transformation vidéo"),
      modelId: stringInput(input.model),
      durationSeconds: duration,
      params: { video_id: input.video_id }
    });
  }

  if (name === "generate_voice") {
    const text = stringInput(input.text);
    return createMediaGeneration({
      context,
      type: "audio",
      modelType: "tts",
      prompt: text,
      modelId: stringInput(input.model),
      characters: text.length,
      params: { text, voice_id: input.voice_id }
    });
  }

  if (name === "lipsync") {
    const duration = numberInput(input.duration, 5);
    return createMediaGeneration({
      context,
      type: "video",
      modelType: "lipsync",
      prompt: "Synchronisation labiale",
      durationSeconds: duration,
      params: { video_id: input.video_id, audio_id: input.audio_id }
    });
  }

  if (name === "create_character") {
    return {
      status: "saved",
      name: stringInput(input.name, "Personnage"),
      reference_image_ids: input.reference_image_ids ?? [],
      message: "Personnage enregistré pour cohérence future."
    };
  }

  return { error: `Tool inconnu: ${name}` };
}
