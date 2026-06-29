import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  conversations as conversationsTable,
  generations as generationsTable,
  messages as messagesTable,
  projects as projectsTable,
  users as usersTable
} from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import type {
  Conversation,
  Generation,
  GenerationStatus,
  MediaType,
  Message,
  MessageRole,
  Project,
  User
} from "@/lib/types";

const demoUser: User = {
  id: "demo-user",
  email: "studio@flowtube.ai",
  name: "FlowTube Studio",
  plan: "pro",
  credits: 4500
};

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;

const memory = {
  seeded: false,
  users: new Map<string, User>(),
  projects: new Map<string, Project>(),
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, Message>(),
  generations: new Map<string, Generation>()
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
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

function seedMemory() {
  if (memory.seeded) return;
  memory.seeded = true;
  memory.users.set(demoUser.id, demoUser);

  const project: Project = {
    id: "proj_demo",
    userId: demoUser.id,
    title: "Campagne lancement",
    archived: false,
    createdAt: nowIso()
  };
  const conversation: Conversation = {
    id: "conv_demo",
    projectId: project.id,
    createdAt: nowIso()
  };
  const welcome: Message = {
    id: "msg_welcome",
    conversationId: conversation.id,
    role: "assistant",
    content:
      "Bonjour. Donne-moi une idée de visuel, de vidéo ou de storyboard, et je prépare une production avec format, modèle et coût en crédits.",
    createdAt: nowIso()
  };

  memory.projects.set(project.id, project);
  memory.conversations.set(conversation.id, conversation);
  memory.messages.set(welcome.id, welcome);
}

export async function getCurrentUser(): Promise<User> {
  seedMemory();
  const authenticatedUser = await getAuthUser();
  const activeUser = authenticatedUser ?? demoUser;
  memory.users.set(activeUser.id, activeUser);

  const db = getDb();
  if (!db) return activeUser;

  await db
    .insert(usersTable)
    .values(activeUser)
    .onConflictDoNothing({ target: usersTable.id });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, activeUser.id)).limit(1);
  return user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits
      }
    : activeUser;
}

export async function listProjects(userId: string): Promise<Project[]> {
  seedMemory();
  const db = getDb();
  if (!db) {
    return [...memory.projects.values()]
      .filter((project) => project.userId === userId && !project.archived)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.userId, userId), eq(projectsTable.archived, false)))
    .orderBy(desc(projectsTable.createdAt));

  return rows.map(mapProject);
}

export async function createProject(userId: string, title = "Nouveau projet") {
  seedMemory();
  const project: Project = {
    id: id("proj"),
    userId,
    title,
    archived: false,
    createdAt: nowIso()
  };
  const conversation: Conversation = {
    id: id("conv"),
    projectId: project.id,
    createdAt: nowIso()
  };

  const db = getDb();
  if (!db) {
    memory.projects.set(project.id, project);
    memory.conversations.set(conversation.id, conversation);
    return { project, conversation };
  }

  await db.insert(projectsTable).values({
    id: project.id,
    userId,
    title,
    archived: false
  });
  await db.insert(conversationsTable).values({
    id: conversation.id,
    projectId: project.id
  });

  return { project, conversation };
}

export async function getOrCreateConversation(userId: string, projectId?: string, conversationId?: string) {
  seedMemory();
  const db = getDb();

  if (!db) {
    if (conversationId && memory.conversations.has(conversationId)) {
      const conversation = memory.conversations.get(conversationId)!;
      const project = memory.projects.get(conversation.projectId)!;
      return { project, conversation };
    }

    if (projectId && memory.projects.has(projectId)) {
      const conversation = [...memory.conversations.values()].find((item) => item.projectId === projectId);
      if (conversation) return { project: memory.projects.get(projectId)!, conversation };
    }

    const existing = [...memory.projects.values()].find((project) => project.userId === userId);
    if (existing) {
      const conversation = [...memory.conversations.values()].find((item) => item.projectId === existing.id)!;
      return { project: existing, conversation };
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

  if (projectId) {
    const [projectRow] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
      .limit(1);
    if (projectRow) {
      const [conversationRow] = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.projectId, projectId))
        .limit(1);
      if (conversationRow) return { project: mapProject(projectRow), conversation: mapConversation(conversationRow) };
    }
  }

  const [projectRow] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.userId, userId), eq(projectsTable.archived, false)))
    .orderBy(desc(projectsTable.createdAt))
    .limit(1);

  if (!projectRow) return createProject(userId);

  const [conversationRow] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.projectId, projectRow.id))
    .limit(1);

  if (conversationRow) return { project: mapProject(projectRow), conversation: mapConversation(conversationRow) };

  const conversation: Conversation = {
    id: id("conv"),
    projectId: projectRow.id,
    createdAt: nowIso()
  };
  await db.insert(conversationsTable).values({ id: conversation.id, projectId: projectRow.id });
  return { project: mapProject(projectRow), conversation };
}

export async function listMessages(conversationId: string, limit = 50): Promise<Message[]> {
  seedMemory();
  const db = getDb();
  if (!db) {
    return [...memory.messages.values()]
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit);
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt))
    .limit(limit);

  return rows.map(mapMessage);
}

export async function saveMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
}): Promise<Message> {
  seedMemory();
  const message: Message = {
    id: id("msg"),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    createdAt: nowIso()
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
  seedMemory();
  const generation: Generation = {
    id: id(`gen_${input.type}`),
    messageId: input.messageId,
    userId: input.userId,
    type: input.type,
    model: input.model,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    status: input.status,
    falJobId: input.falJobId,
    resultUrl: null,
    progress: input.status === "completed" ? 100 : 6,
    credits: input.credits,
    params: input.params ?? {},
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
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

export async function listGenerationsForMessages(messageIds: string[]): Promise<Generation[]> {
  seedMemory();
  if (!messageIds.length) return [];
  const db = getDb();
  if (!db) {
    return [...memory.generations.values()].filter((generation) => messageIds.includes(generation.messageId));
  }

  const rows = await db.select().from(generationsTable);
  return rows.map(mapGeneration).filter((generation) => messageIds.includes(generation.messageId));
}

export async function getGeneration(idValue: string): Promise<Generation | null> {
  seedMemory();
  const db = getDb();
  if (!db) return memory.generations.get(idValue) ?? null;

  const [row] = await db.select().from(generationsTable).where(eq(generationsTable.id, idValue)).limit(1);
  return row ? mapGeneration(row) : null;
}

export async function updateGeneration(
  idValue: string,
  patch: Partial<Pick<Generation, "status" | "resultUrl" | "progress" | "error">>
): Promise<Generation | null> {
  seedMemory();
  const existing = await getGeneration(idValue);
  if (!existing) return null;

  const next: Generation = {
    ...existing,
    ...patch,
    updatedAt: nowIso()
  };

  const db = getDb();
  if (!db) {
    memory.generations.set(idValue, next);
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
    .where(eq(generationsTable.id, idValue));

  return next;
}
