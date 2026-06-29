import {
  ArrowUp,
  ChevronDown,
  Film,
  ImageIcon,
  Loader2,
  Menu,
  Mic2,
  Sparkles,
  UserCircle
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaCard } from "./components/MediaCard";
import { Sidebar } from "./components/Sidebar";
import { parseSse } from "./lib/sse";
import type { Conversation, Generation, Message, ModelEntry, Project, User } from "./lib/types";

type Bootstrap = {
  user: User;
  projects: Project[];
  conversation: Conversation;
  messages: Message[];
  models: ModelEntry[];
};

const fallbackUser: User = {
  id: "loading",
  email: "studio@flowtube.ai",
  name: "FlowTube Studio",
  plan: "pro",
  credits: 4500
};

export function App() {
  const [user, setUser] = useState<User>(fallbackUser);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>();
  const [conversationId, setConversationId] = useState<string>("conv_demo");
  const [messages, setMessages] = useState<Message[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelId, setModelId] = useState("");
  const [ratio, setRatio] = useState("4:5");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const streamId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((response) => response.json())
      .then((data: Bootstrap) => {
        setUser(data.user);
        setProjects(data.projects);
        setActiveProjectId(data.projects[0]?.id);
        setConversationId(data.conversation.id);
        setMessages(data.messages);
        setModels(data.models);
        setModelId(data.models.find((model) => model.default)?.id ?? data.models[0]?.id ?? "");
      })
      .catch(() => {
        setMessages([
          {
            id: "offline",
            conversationId: "conv_demo",
            role: "assistant",
            content: "L’interface est prête. Vérifie les routes API si le backend ne répond pas.",
            createdAt: new Date().toISOString()
          }
        ]);
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generations]);

  const generationsByMessage = useMemo(() => {
    const map = new Map<string, Generation[]>();
    for (const generation of generations) {
      const list = map.get(generation.messageId) ?? [];
      list.push(generation);
      map.set(generation.messageId, list);
    }
    return map;
  }, [generations]);

  async function createProject() {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nouveau projet" })
    });
    if (!response.ok) return;
    const data = await response.json();
    setProjects((current) => [data.project, ...current]);
    setActiveProjectId(data.project.id);
    setConversationId(data.conversation.id);
    setMessages([]);
    setGenerations([]);
  }

  async function sendMessage(custom?: string) {
    const text = (custom ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    streamId.current = null;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        projectId: activeProjectId,
        conversationId,
        aspectRatio: ratio,
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
      const parsed = parseSse(buffer);
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
          if (!streamId.current) {
            streamId.current = `stream_${Date.now()}`;
            setMessages((current) => [
              ...current,
              {
                id: streamId.current!,
                conversationId,
                role: "assistant",
                content: "",
                createdAt: new Date().toISOString()
              }
            ]);
          }
          setMessages((current) =>
            current.map((message) =>
              message.id === streamId.current ? { ...message, content: message.content + item.data.delta } : message
            )
          );
        }
        if (item.event === "done") {
          setMessages((current) =>
            current.map((message) => (message.id === streamId.current ? item.data.assistantMessage : message))
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

  const activeModel = models.find((model) => model.id === modelId);

  return (
    <div className="hf-shell">
      <Sidebar
        user={user}
        projects={projects}
        activeProjectId={activeProjectId}
        onNewProject={createProject}
        onSelectProject={setActiveProjectId}
      />

      <main className="hf-main">
        <header className="hf-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button className="hf-icon-button bg-white/[.05] text-[#A8A8AA] lg:hidden">
              <Menu size={18} />
            </button>
            <div>
              <div className="text-[15px] font-bold">Assistant créatif</div>
              <div className="text-[12px] text-[#8A8A8C]">Images, vidéos, voix, lipsync et storyboards</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="hf-chip">
              <Sparkles size={14} />
              {user.credits} crédits
            </button>
            <button className="hf-chip">
              <UserCircle size={15} />
              {user.plan}
            </button>
          </div>
        </header>

        <section className="hf-chat" ref={scrollRef}>
          <div className="hf-chat-inner">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className={`hf-message ${message.role === "user" ? "hf-message-user" : "hf-message-assistant"}`}>
                  {message.content}
                </div>
                {(generationsByMessage.get(message.id) ?? []).map((generation) => (
                  <MediaCard key={generation.id} generation={generation} onAction={(prompt) => void sendMessage(prompt)} />
                ))}
              </div>
            ))}

            {!messages.length ? (
              <div className="mx-auto mt-16 max-w-[760px] text-center">
                <div className="hf-logo mx-auto mb-5 w-12 h-12">
                  <Sparkles size={24} />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Huggy flow</h1>
                <p className="mt-4 text-[#A8A8AA] leading-7">
                  Décris un visuel, un clip, une voix off ou un storyboard. L’architecture interne lance les jobs,
                  suit les statuts et garde les crédits visibles.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="hf-input-wrap">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button className="hf-chip">
              <ImageIcon size={15} />
              Image
            </button>
            <button className="hf-chip">
              <Film size={15} />
              Vidéo
            </button>
            <button className="hf-chip">
              <Mic2 size={15} />
              Voix
            </button>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={ratio}
                onChange={(event) => setRatio(event.target.value)}
                className="hf-chip bg-[#151517] outline-none"
              >
                {["1:1", "4:5", "9:16", "16:9", "3:4", "4:3"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="hf-chip bg-[#151517] outline-none max-w-[210px]"
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
              rows={1}
              placeholder="Décris ce que tu veux créer..."
              className="flex-1 min-h-[42px] max-h-36 bg-transparent border-none outline-none text-[14px] text-[#F5F5F4] px-2 py-2"
            />
            <button
              className={`hf-icon-button ${input.trim() ? "hf-primary" : "bg-white/[.08] text-[#6b6b6e]"}`}
              onClick={() => void sendMessage()}
              disabled={busy || !input.trim()}
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowUp size={18} />}
            </button>
          </div>
          {activeModel ? (
            <div className="flex items-center gap-1 mt-2 text-[11px] text-[#8A8A8C]">
              <span>{activeModel.provider}</span>
              <ChevronDown size={12} />
              <span>{activeModel.credits} crédits estimés</span>
              <span>•</span>
              <span>{activeModel.pricingHint}</span>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
