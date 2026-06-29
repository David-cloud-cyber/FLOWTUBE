"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  Film,
  ImageIcon,
  Loader2,
  Mic2,
  Plus,
  Sparkles,
  SquarePen
} from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Generation, Message, ModelRegistryEntry, Project, User } from "@/lib/types";

type SafeModel = Omit<ModelRegistryEntry, "falEndpoint"> & { credits: number };

type ChatShellProps = {
  user: User;
  projects: Project[];
  initialProjectId: string;
  initialConversationId: string;
  initialMessages: Message[];
  initialGenerations: Generation[];
  models: SafeModel[];
};

function parseSseChunk(buffer: string) {
  const events: Array<{ event: string; data: any }> = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";

  for (const block of blocks) {
    const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
    if (!eventLine || !dataLine) continue;

    const event = eventLine.replace("event:", "").trim();
    const rawData = dataLine.replace("data:", "").trim();
    try {
      events.push({ event, data: JSON.parse(rawData) });
    } catch {
      events.push({ event, data: rawData });
    }
  }

  return { events, rest };
}

export function ChatShell({
  user,
  projects,
  initialProjectId,
  initialConversationId,
  initialMessages,
  initialGenerations,
  models
}: ChatShellProps) {
  const [projectList, setProjectList] = useState(projects);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [generations, setGenerations] = useState(initialGenerations);
  const [input, setInput] = useState("");
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [modelId, setModelId] = useState(models.find((model) => model.default)?.id ?? models[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const streamingAssistantId = useRef<string | null>(null);

  const generationsByMessage = useMemo(() => {
    const map = new Map<string, Generation[]>();
    for (const generation of generations) {
      const list = map.get(generation.messageId) ?? [];
      list.push(generation);
      map.set(generation.messageId, list);
    }
    return map;
  }, [generations]);

  const activeModel = models.find((model) => model.id === modelId) ?? models[0];

  async function createProject() {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nouveau projet" })
    });
    if (!response.ok) return;
    const payload = await response.json();
    setProjectList((current) => [payload.project, ...current]);
    setActiveProjectId(payload.project.id);
    setConversationId(payload.conversation.id);
    setMessages([]);
    setGenerations([]);
  }

  async function selectProject(projectId: string) {
    setActiveProjectId(projectId);
    const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setConversationId(payload.conversation.id);
    setMessages(payload.messages);
    setGenerations(payload.generations);
  }

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    streamingAssistantId.current = null;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        projectId: activeProjectId,
        conversationId,
        aspectRatio,
        modelId
      })
    });

    if (!response.body) {
      setBusy(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;

      for (const item of parsed.events) {
        if (item.event === "user_message") {
          setConversationId(item.data.conversationId);
          setMessages((current) => [...current, item.data.message]);
        }

        if (item.event === "generation") {
          setGenerations((current) => [...current, item.data.generation]);
        }

        if (item.event === "text") {
          if (!streamingAssistantId.current) {
            streamingAssistantId.current = `stream_${Date.now()}`;
            setMessages((current) => [
              ...current,
              {
                id: streamingAssistantId.current!,
                conversationId,
                role: "assistant",
                content: "",
                createdAt: new Date().toISOString()
              }
            ]);
          }

          setMessages((current) =>
            current.map((message) =>
              message.id === streamingAssistantId.current
                ? { ...message, content: message.content + item.data.delta }
                : message
            )
          );
        }

        if (item.event === "done") {
          setMessages((current) =>
            current.map((message) =>
              message.id === streamingAssistantId.current ? item.data.assistantMessage : message
            )
          );
          setBusy(false);
        }

        if (item.event === "error") {
          setMessages((current) => [
            ...current,
            {
              id: `error_${Date.now()}`,
              conversationId,
              role: "assistant",
              content: item.data.message,
              createdAt: new Date().toISOString()
            }
          ]);
          setBusy(false);
        }
      }
    }

    setBusy(false);
  }

  function mediaAction(kind: "animate" | "edit" | "recreate", generation: Generation) {
    const prompts = {
      animate: `Confirme et anime cette image (${generation.id}) en vidéo courte 9:16, mouvement caméra fluide, même style.`,
      edit: `Retouche ce média (${generation.id}) : améliore la lumière, renforce le sujet principal et garde le format.`,
      recreate: `Recrée une variante de ce média : ${generation.prompt}`
    };

    void sendMessage(prompts[kind]);
  }

  return (
    <main className="grain flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        user={user}
        projects={projectList}
        activeProjectId={activeProjectId}
        onNewProject={createProject}
        onSelectProject={(projectId) => void selectProject(projectId)}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-black/20 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground lg:hidden">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">Studio conversationnel</div>
              <div className="truncate text-xs text-muted-foreground">
                Agent créatif, images, vidéos, voix et lipsync
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="hidden sm:inline-flex">{user.credits} crédits</Badge>
            <Button size="sm" variant="outline" onClick={createProject}>
              <Plus className="h-4 w-4" />
              Projet
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-36">
            {messages.length === 0 ? (
              <div className="mx-auto mt-16 max-w-2xl text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-glow">
                  <SquarePen className="h-7 w-7" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">FlowTube</h1>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Décris une affiche, un clip, une voix off ou un storyboard. Nova transforme la demande en production suivie dans le fil.
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[820px] rounded-md px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : "border border-white/[0.08] bg-white/[0.055] text-foreground"
                  )}
                >
                  {message.content}
                </div>
                <div className={cn("w-full", message.role === "user" ? "flex justify-end" : "")}>
                  {(generationsByMessage.get(message.id) ?? []).map((generation) => (
                    <MediaCard
                      key={generation.id}
                      generation={generation}
                      onAnimate={(item) => mediaAction("animate", item)}
                      onEdit={(item) => mediaAction("edit", item)}
                      onRecreate={(item) => mediaAction("recreate", item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-4 pb-4 lg:left-[280px]">
          <div className="pointer-events-auto mx-auto max-w-4xl rounded-md glass p-3 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className="flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                Image
              </button>
              <button className="flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-muted-foreground">
                <Film className="h-4 w-4" />
                Vidéo
              </button>
              <button className="flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-muted-foreground">
                <Mic2 className="h-4 w-4" />
                Voix
              </button>

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                  className="h-8 rounded-md border border-white/[0.1] bg-black/40 px-2 text-xs outline-none"
                >
                  {["1:1", "4:5", "9:16", "16:9", "3:4", "4:3"].map((ratio) => (
                    <option key={ratio}>{ratio}</option>
                  ))}
                </select>
                <select
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  className="h-8 max-w-[180px] rounded-md border border-white/[0.1] bg-black/40 px-2 text-xs outline-none"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Décris le média à créer..."
                rows={1}
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button size="icon" disabled={busy || !input.trim()} onClick={() => void sendMessage()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>

            {activeModel ? (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>{activeModel.provider}</span>
                <ChevronDown className="h-3 w-3" />
                <span>{activeModel.credits} crédits estimés</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
