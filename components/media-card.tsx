"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Film, ImageIcon, Loader2, Mic2, Pencil, RefreshCcw, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Generation } from "@/lib/types";
import { cn } from "@/lib/utils";

type MediaCardProps = {
  generation: Generation;
  onAnimate?: (generation: Generation) => void;
  onEdit?: (generation: Generation) => void;
  onRecreate?: (generation: Generation) => void;
};

export function MediaCard({ generation, onAnimate, onEdit, onRecreate }: MediaCardProps) {
  const [current, setCurrent] = useState(generation);

  useEffect(() => {
    setCurrent(generation);
  }, [generation]);

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
  const isDone = current.status === "completed" && current.resultUrl;
  const progressLabel = useMemo(() => {
    if (current.status === "failed") return "Échec";
    if (isDone) return "Terminé";
    return `${Math.max(5, current.progress)}%`;
  }, [current.progress, current.status, isDone]);

  return (
    <div className="mt-3 w-full max-w-[760px] overflow-hidden rounded-md border border-white/[0.1] bg-[#141416]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-accent" />
          <span className="truncate text-sm font-semibold">{current.prompt}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge>{current.model}</Badge>
          <Badge>{current.aspectRatio}</Badge>
          <Badge>{current.credits} crédits</Badge>
        </div>
      </div>

      <div
        className={cn(
          "relative flex min-h-[280px] items-center justify-center overflow-hidden bg-black media-grid-bg",
          current.type === "video" && "aspect-video",
          current.type === "image" && "aspect-[4/5] max-h-[620px]"
        )}
      >
        {isDone && current.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.resultUrl!} alt={current.prompt} className="h-full w-full object-cover" />
        ) : null}

        {isDone && current.type === "video" ? (
          <video src={current.resultUrl!} className="h-full w-full object-cover" controls playsInline />
        ) : null}

        {isDone && current.type === "audio" ? (
          <div className="w-full max-w-md px-6">
            <audio src={current.resultUrl!} controls className="w-full" />
          </div>
        ) : null}

        {!isDone ? (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            {current.status === "failed" ? (
              <div className="rounded-md border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {current.error || "La génération a échoué."}
              </div>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <div>
                  <div className="text-sm font-semibold">Génération en cours</div>
                  <div className="mt-1 text-xs text-muted-foreground">{progressLabel}</div>
                </div>
                <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, Math.max(5, current.progress))}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] px-3 py-2">
        {current.type === "image" ? (
          <Button size="sm" variant="subtle" onClick={() => onAnimate?.(current)}>
            <Wand2 className="h-4 w-4" />
            Animate
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => onEdit?.(current)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onRecreate?.(current)}>
          <RefreshCcw className="h-4 w-4" />
          Recreate
        </Button>
        {current.resultUrl ? (
          <Button size="sm" variant="ghost" asChild>
            <a href={current.resultUrl} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
