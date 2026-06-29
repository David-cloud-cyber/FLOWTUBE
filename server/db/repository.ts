import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import {
  conversations as conversationsTable,
  generations as generationsTable,
  messages as messagesTable,
  projects as projectsTable,
  users as usersTable
} from "./schema";
import type {
  Conversation,
  Generation,
  GenerationStatus,
  MediaType,
  Message,
  MessageRole,
  Project,
  User
} from "../types";

const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;

export const demoUser: User = {
  id: "demo-user",
  email: "studio@flowtube.ai",
  name: "FlowTube Studio",
  plan: "pro",
  credits: 4500
};

const memory = {
  seeded: false,
  users: new Map<string, User>(),
  projects: new Map<string, Project>(),
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, Message>(),
  generations: new Map<string, Generation>()
};

function seed() {
  if (memory.seeded) return;
  memory.seeded = true;
  memory.users.set(demoUser.id, demoUser);
  const project: Project = {
    id: "proj_demo",
    userId: demoUser.id,
    title: "Campagne lancement",
    archived: false,
    createdAt: now()
  };
  const conversation: Conversation = {
    id: "conv_demo",
    projectId: project.id,
    createdAt: now()
  };
  const message: Message = {
    id: "msg_welcome",
    conversationId: conversation.id,
    role: "assistant",
    content:
      "Bonjour. Décris ton image, ta vidéo, ta voix off ou ton storyboard. Je garde le coût visible avant les actions lourdes.",
    createdAt: now()
  };
  memory.projects.set(project.id, project);
  memory.conversations.set(conversation.id, conversation);
  memory.messages.set(message.id, message);
}

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

export async function getCurrentUser(): Promise<User> {
  seed();
  const db = getDb();
  if (!db) return demoUser;

  await db.insert(usersTable).values(demoUser).onConflictDoNothing({ target: usersTable.id });
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, demoUser.id)).limit(1);
  return row ? { id: row.id, email: row.email, name: row.name, plan: row.plan, credits: row.credits } : demoUser;
}

function mapProject(row: typeof projectsTable.$inferSelect): Project {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    archived: row.archived,
    createdAt: toIso(row.createdAt)
  };
}

function mapConversation(row: typeof conversationsTable.$inferSelect): Conversation {
  return {
    id: row.id,
    projectId: row.projectId,
    createdAt: toIso(row.createdAt)
  };
}

function mapMessage(row: typeof messagesTable.$inferSelect): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: toIso(row.createdAt)
  };
}

function mapGeneration(row: typeof generationsTable.$inferSelect): Generation {
  return {
    id: row.id,
    messageId: row.messageId,
    userId: row.userId,
    type: row.type,
    model: row.model,
    prompt: row.prompt,
    aspectRatio: row.aspectRatio,
    status: row.status,
    falJobId: row.falJobId,
    resultUrl: row.resultUrl,
    progress: row.progress,
    credits: row.credits,
    params: row.params,
    error: row.error,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

export async function listProjects(userId: string): Promise<Project[]> {
  seed();
  const db = getDb();
  if (!db) return [...memory.projects.values()].filter((project) => project.userId === userId);

  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.userId, userId), eq(projectsTable.archived, false)))
    .orderBy(desc(projectsTable.createdAt));
  return rows.map(mapProject);
}

export async function createProject(userId: string, title = "Nouveau projet") {
  seed();
  const project: Project = { id: makeId("proj"), userId, title, archived: false, createdAt: now() };
  const conversation: Conversation = { id: makeId("conv"), projectId: project.id, createdAt: now() };
  const db = getDb();
  if (!db) {
    memory.projects.set(project.id, project);
    memory.conversations.set(conversation.id, conversation);
    return { project, conversation };
  }
  await db.insert(projectsTable).values({ id: project.id, userId, title, archived: false });
  await db.insert(conversationsTable).values({ id: conversation.id, projectId: project.id });
  return { project, conversation };
}

export async function getOrCreateConversation(userId: string, projectId?: string, conversationId?: string) {
  seed();
  const db = getDb();
  if (!db) {
    if (conversationId && memory.conversations.has(conversationId)) {
      const conversation = memory.conversations.get(conversationId)!;
      return { project: memory.projects.get(conversation.projectId)!, conversation };
    }
    if (projectId && memory.projects.has(projectId)) {
      const conversation = [...memory.conversations.values()].find((item) => item.projectId === projectId);
      if (conversation) return { project: memory.projects.get(projectId)!, conversation };
    }
    const project = [...memory.projects.values()].find((item) => item.userId === userId);
    if (project) {
      const conversation = [...memory.conversations.values()].find((item) => item.projectId === project.id)!;
      return { project, conversation };
    }
    return createProject(userId);
  }

  if (conversationId) {
    const [conversationRow] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);
    if (conversationRow) {
      const [projectRow] = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, conversationRow.projectId), eq(projectsTable.userId, userId)))
        .limit(1);
      if (projectRow) return { project: mapProject(projectRow), conversation: mapConversation(conversationRow) };
    }
  }

  const projects = await listProjects(userId);
  if (!projects.length) return createProject(userId);
  const project = projectId ? projects.find((item) => item.id === projectId) ?? projects[0] : projects[0];
  const [conversationRow] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.projectId, project.id))
    .limit(1);

  if (conversationRow) return { project, conversation: mapConversation(conversationRow) };

  const conversation: Conversation = { id: makeId("conv"), projectId: project.id, createdAt: now() };
  await db.insert(conversationsTable).values({ id: conversation.id, projectId: project.id });
  return { project, conversation };
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  seed();
  const db = getDb();
  if (!db) {
    return [...memory.messages.values()]
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));
  return rows.map(mapMessage);
}

export async function saveMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
}): Promise<Message> {
  seed();
  const message: Message = {
    id: makeId("msg"),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    createdAt: now()
  };
  const db = getDb();
  if (!db) {
    memory.messages.set(message.id, message);
    return message;
  }
  await db.insert(messagesTable).values({
    id: message.id,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content
  });
  return message;
}

export async function saveGeneration(input: {
  messageId: string;
  userId: string;
  type: MediaType;
  model: string;
  prompt: string;
  aspectRatio: string;
  status: GenerationStatus;
  falJobId: string | null;
  credits: number;
  params?: Record<string, unknown>;
}): Promise<Generation> {
  seed();
  const generation: Generation = {
    id: makeId(`gen_${input.type}`),
    messageId: input.messageId,
    userId: input.userId,
    type: input.type,
    model: input.model,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    status: input.status,
    falJobId: input.falJobId,
    resultUrl: null,
    progress: 8,
    credits: input.credits,
    params: input.params ?? {},
    error: null,
    createdAt: now(),
    updatedAt: now()
  };
  const db = getDb();
  if (!db) {
    memory.generations.set(generation.id, generation);
    return generation;
  }
  await db.insert(generationsTable).values({
    id: generation.id,
    messageId: input.messageId,
    userId: input.userId,
    type: input.type,
    model: input.model,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    status: input.status,
    falJobId: input.falJobId,
    credits: input.credits,
    params: input.params ?? {}
  });
  return generation;
}

export async function getGeneration(id: string): Promise<Generation | null> {
  seed();
  const db = getDb();
  if (!db) return memory.generations.get(id) ?? null;
  const [row] = await db.select().from(generationsTable).where(eq(generationsTable.id, id)).limit(1);
  return row ? mapGeneration(row) : null;
}

export async function updateGeneration(id: string, patch: Partial<Generation>) {
  const existing = await getGeneration(id);
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: now() };
  const db = getDb();
  if (!db) {
    memory.generations.set(id, next);
    return next;
  }
  await db
    .update(generationsTable)
    .set({
      status: patch.status,
      resultUrl: patch.resultUrl,
      progress: patch.progress,
      error: patch.error,
      updatedAt: new Date()
    })
    .where(eq(generationsTable.id, id));
  return next;
}
