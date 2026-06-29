import { fal } from "@fal-ai/client";
import { getModel } from "@/lib/models";
import type { Generation, GenerationStatus, MediaType, ModelRegistryEntry } from "@/lib/types";

type FalSubmitResult = {
  jobId: string | null;
  status: GenerationStatus;
  raw?: unknown;
};

function configureFal() {
  if (!process.env.FAL_KEY) return false;
  fal.config({ credentials: process.env.FAL_KEY });
  return true;
}

function pickResultUrl(result: unknown): string | null {
  const data = result as Record<string, any>;
  const root = data?.data ?? data;
  return (
    root?.image?.url ??
    root?.images?.[0]?.url ??
    root?.video?.url ??
    root?.videos?.[0]?.url ??
    root?.audio?.url ??
    root?.audios?.[0]?.url ??
    root?.url ??
    null
  );
}

function mockUrl(type: MediaType, seed: string) {
  if (type === "image") return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/1500`;
  if (type === "video") return "https://samplelib.com/lib/preview/mp4/sample-5s.mp4";
  return null;
}

export async function submitFalJob(
  model: ModelRegistryEntry,
  type: MediaType,
  input: Record<string, unknown>
): Promise<FalSubmitResult> {
  if (!configureFal()) {
    return {
      jobId: `mock:${type}:${crypto.randomUUID()}`,
      status: "running",
      raw: { demo: true, input }
    };
  }

  const response = (await fal.queue.submit(model.falEndpoint, { input })) as unknown as Record<string, unknown>;
  const jobId = String(response.request_id ?? response.requestId ?? response.id ?? "");
  return {
    jobId,
    status: "pending",
    raw: response
  };
}

export async function refreshFalGeneration(generation: Generation) {
  if (!generation.falJobId) return generation;

  const model = getModel(generation.model);
  if (generation.falJobId.startsWith("mock:")) {
    const elapsed = Date.now() - new Date(generation.createdAt).getTime();
    if (elapsed > 4500) {
      return {
        status: "completed" as GenerationStatus,
        progress: 100,
        resultUrl: mockUrl(generation.type, generation.id),
        error: null
      };
    }

    return {
      status: "running" as GenerationStatus,
      progress: Math.min(92, 15 + Math.round(elapsed / 60)),
      resultUrl: null,
      error: null
    };
  }

  try {
    configureFal();
    const status = (await fal.queue.status(model.falEndpoint, {
      requestId: generation.falJobId,
      logs: true
    })) as Record<string, any>;

    const statusValue = String(status.status ?? "").toUpperCase();
    if (statusValue === "COMPLETED") {
      const result = await fal.queue.result(model.falEndpoint, {
        requestId: generation.falJobId
      });

      return {
        status: "completed" as GenerationStatus,
        progress: 100,
        resultUrl: pickResultUrl(result),
        error: null
      };
    }

    if (statusValue === "FAILED" || statusValue === "ERROR") {
      return {
        status: "failed" as GenerationStatus,
        progress: generation.progress,
        resultUrl: null,
        error: "Le job fal.ai a échoué. Aucun crédit ne doit être débité."
      };
    }

    return {
      status: "running" as GenerationStatus,
      progress: Math.min(95, Math.max(generation.progress, 20)),
      resultUrl: null,
      error: null
    };
  } catch (error) {
    return {
      status: "failed" as GenerationStatus,
      progress: generation.progress,
      resultUrl: null,
      error: error instanceof Error ? error.message : "Erreur fal.ai inconnue"
    };
  }
}
