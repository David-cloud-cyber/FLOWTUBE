import { Archive, Folder, ImageIcon, Plus, Search, Settings, Video } from "lucide-react";
import type { Project, User } from "../lib/types";

type Props = {
  user: User;
  projects: Project[];
  activeProjectId?: string;
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
};

export function Sidebar({ user, projects, activeProjectId, onNewProject, onSelectProject }: Props) {
  return (
    <aside className="hf-sidebar">
      <div className="flex items-center justify-between min-h-[34px]">
        <div className="flex items-center gap-[10px] min-w-0">
          <div className="hf-logo">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7">
              <path d="M5 5l6 7-6 7" />
              <path d="M13 5l6 7-6 7" />
            </svg>
          </div>
          <span className="text-[16px] font-bold tracking-tight whitespace-nowrap">Huggy flow</span>
        </div>
        <button className="hf-icon-button bg-transparent text-[#9A9A9C] hover:bg-white/[.06]" onClick={onNewProject}>
          <Plus size={17} />
        </button>
      </div>

      <button
        onClick={onNewProject}
        className="hf-primary flex items-center justify-center gap-2 w-full py-[11px] px-[14px] rounded-[13px] cursor-pointer text-[13.5px] font-bold transition-transform hover:-translate-y-px"
      >
        <Plus size={16} />
        <span>Nouveau projet</span>
      </button>

      <div className="flex items-center gap-[9px] py-[9px] px-[11px] rounded-[11px] bg-white/[.04] border border-white/[.06]">
        <Search size={15} className="text-[#6b6b6e]" />
        <input
          placeholder="Rechercher"
          className="bg-transparent border-none outline-none text-[#F5F5F4] text-[13px] w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-1 -mx-1.5 px-1.5">
        <div className="px-[11px] pt-2 pb-1 text-[11px] tracking-[.09em] uppercase text-[#5f5f62] font-semibold">
          Projets récents
        </div>
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className={`flex items-center gap-2.5 px-[11px] py-2 rounded-[10px] text-[13px] transition-colors text-left ${
              activeProjectId === project.id
                ? "bg-white/[.08] text-[#F5F5F4]"
                : "text-[#A8A8AA] hover:bg-white/[.05]"
            }`}
          >
            <Folder size={15} />
            <span className="truncate">{project.title}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-white/[.07] pt-[13px] flex flex-col gap-1">
        <div className="rounded-[11px] bg-white/[.04] border border-white/[.06] p-3">
          <div className="flex justify-between text-[12px] text-[#A8A8AA] mb-2">
            <span>Crédits</span>
            <strong className="text-[#F5F5F4]">{user.credits}</strong>
          </div>
          <div className="h-[6px] rounded bg-white/[.08] overflow-hidden">
            <div className="h-full w-[62%] rounded bg-[#D7F94B] shadow-lime" />
          </div>
        </div>
        <button className="flex items-center gap-2.5 px-[11px] py-2 rounded-[10px] text-[13px] text-[#A8A8AA] hover:bg-white/[.05]">
          <ImageIcon size={15} />
          Images
        </button>
        <button className="flex items-center gap-2.5 px-[11px] py-2 rounded-[10px] text-[13px] text-[#A8A8AA] hover:bg-white/[.05]">
          <Video size={15} />
          Vidéos
        </button>
        <button className="flex items-center gap-2.5 px-[11px] py-2 rounded-[10px] text-[13px] text-[#A8A8AA] hover:bg-white/[.05]">
          <Archive size={15} />
          Archives
        </button>
        <button className="flex items-center gap-2.5 px-[11px] py-2 rounded-[10px] text-[13px] text-[#A8A8AA] hover:bg-white/[.05]">
          <Settings size={15} />
          Paramètres
        </button>
      </div>
    </aside>
  );
}
