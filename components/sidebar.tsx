"use client";

import { Archive, Folder, ImageIcon, Plus, Search, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compactNumber, cn } from "@/lib/utils";
import type { Project, User } from "@/lib/types";

type SidebarProps = {
  user: User;
  projects: Project[];
  activeProjectId?: string;
  onNewProject: () => void;
  onSelectProject: (projectId: string) => void;
};

export function Sidebar({ user, projects, activeProjectId, onNewProject, onSelectProject }: SidebarProps) {
  return (
    <aside className="hidden h-screen w-[280px] shrink-0 flex-col border-r border-border bg-[#101012] p-4 lg:flex">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide">FlowTube</div>
            <div className="text-xs text-muted-foreground">{user.plan.toUpperCase()}</div>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onNewProject} aria-label="Nouveau projet">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-5 rounded-md border border-white/[0.08] bg-white/[0.05] p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Crédits</span>
          <span>{compactNumber(user.credits)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-accent shadow-glow" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.05] px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Rechercher"
        />
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Projets
        </div>
        <div className="space-y-1 overflow-y-auto pr-1">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground",
                activeProjectId === project.id && "bg-white/[0.08] text-foreground"
              )}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{project.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t border-border pt-4">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
          <ImageIcon className="h-4 w-4" />
          Images
        </button>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
          <Video className="h-4 w-4" />
          Vidéos
        </button>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
          <Archive className="h-4 w-4" />
          Archives
        </button>
      </div>
    </aside>
  );
}
