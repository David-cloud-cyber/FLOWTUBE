export type MediaType = "image" | "video" | "audio";
export type GenerationStatus = "pending" | "running" | "completed" | "failed";
export type MessageRole = "user" | "assistant";
export type Plan = "free" | "starter" | "pro" | "studio";

export type User = {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  credits: number;
};

export type Project = {
  id: string;
  userId: string;
  title: string;
  archived: boolean;
  createdAt: string;
};

export type Conversation = {
  id: string;
  projectId: string;
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type Generation = {
  id: string;
  messageId: string;
  userId: string;
  type: MediaType;
  model: string;
  prompt: string;
  aspectRatio: string;
  status: GenerationStatus;
  falJobId: string | null;
  resultUrl: string | null;
  progress: number;
  credits: number;
  params: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModelType =
  | "image"
  | "image_edit"
  | "video"
  | "video_edit"
  | "tts"
  | "voice_clone"
  | "lipsync";

export type ModelRegistryEntry = {
  id: string;
  label: string;
  provider: string;
  type: ModelType;
  falEndpoint: string;
  default?: boolean;
  costUsd: number;
  costUnit: "image" | "second" | "thousand_chars" | "action";
  supports: {
    audio?: boolean;
    startEndFrame?: boolean;
    referenceImages?: number;
    aspectRatios?: string[];
    durations?: number[];
  };
  pricingHint: string;
};

export type ChatPayload = {
  message: string;
  projectId?: string;
  conversationId?: string;
  aspectRatio?: string;
  modelId?: string;
};
