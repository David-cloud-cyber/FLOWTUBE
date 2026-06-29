export type MediaType = "image" | "video" | "audio";
export type GenerationStatus = "pending" | "running" | "completed" | "failed";
export type MessageRole = "user" | "assistant";

export type User = {
  id: string;
  email: string;
  name: string;
  plan: "free" | "starter" | "pro" | "studio";
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

export type ModelEntry = {
  id: string;
  label: string;
  provider: string;
  type: string;
  default?: boolean;
  supports: Record<string, unknown>;
  pricingHint: string;
  credits: number;
};
