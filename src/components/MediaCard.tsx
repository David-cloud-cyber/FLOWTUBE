import { Download, Film, ImageIcon, Loader2, Mic2, Pencil, RefreshCcw, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Generation } from "../lib/types";

type Props = {
  generation: Generation;
  onAction: (prompt: string) => void;
};

export function MediaCard({ generation, onAction }: Props) {
  const [current, setCurrent] = useState(generation);

  useEffect(() => setCurrent(generation), [generation]);

  useEffect(() => {
    if (current.status === "completed" || current.status === "failed") return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/generations/${current.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { generation: Generation };
      setCurrent(payload.generation);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [current.id, current.status]);

  const Icon = current.type === "video" ? Film : current.type === "audio" ? Mic2 : ImageIcon;
  const done = current.status === "completed" && current.resultUrl;

  return (
    <div className="hf-media">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/[.08]">
        <div className="min-w-0 flex items-center gap-2">
          <Icon size={16} className="text-[#D7F94B] shrink-0" />
          <span className="truncate text-[13px] font-semibold">{current.prompt}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hf-chip py-1 px-2">{current.model}</span>
          <span className="hf-chip py-1 px-2">{current.aspectRatio}</span>
          <span className="hf-chip py-1 px-2">{current.credits} crédits</span>
        </div>
      </div>

      <div className={`hf-media-stage ${current.type === "video" ? "aspect-video" : "aspect-[4/5] max-h-[620px]"}`}>
        {done && current.type === "image" ? (
          <img src={current.resultUrl!} alt={current.prompt} className="w-full h-full object-cover" />
        ) : null}
        {done && current.type === "video" ? (
          <video src={current.resultUrl!} className="w-full h-full object-cover" controls playsInline />
        ) : null}
        {done && current.type === "audio" ? (
          <div className="w-full max-w-md px-5">
            <audio src={current.resultUrl!} controls className="w-full" />
          </div>
        ) : null}
        {!done ? (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            {current.status === "failed" ? (
              <div className="text-red-200 text-sm rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3">
                {current.error || "La génération a échoué."}
              </div>
            ) : (
              <>
                <Loader2 className="animate-spin text-[#D7F94B]" size={32} />
                <div>
                  <div className="text-sm font-semibold">Génération en cours</div>
                  <div className="text-xs text-[#9A9A9C] mt-1">{Math.max(5, current.progress)}%</div>
                </div>
                <div className="hf-progress">
                  <span style={{ width: `${Math.min(100, Math.max(5, current.progress))}%` }} />
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-white/[.08]">
        {current.type === "image" ? (
          <button
            className="hf-chip"
            onClick={() => onAction(`Confirme et anime cette image ${current.id} en vidéo courte 9:16.`)}
          >
            <Wand2 size={14} />
            Animate
          </button>
        ) : null}
        <button className="hf-chip" onClick={() => onAction(`Retouche ce média ${current.id}: améliore la lumière.`)}>
          <Pencil size={14} />
          Edit
        </button>
        <button className="hf-chip" onClick={() => onAction(`Recrée une variante de: ${current.prompt}`)}>
          <RefreshCcw size={14} />
          Recreate
        </button>
        {current.resultUrl ? (
          <a className="hf-chip" href={current.resultUrl} target="_blank" rel="noreferrer">
            <Download size={14} />
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}
