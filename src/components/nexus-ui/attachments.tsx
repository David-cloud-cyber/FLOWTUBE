import React, {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
} from 'react';

/* ─── Types ─────────────────────────────────────────────────── */

export interface AttachmentMeta {
  type: 'image' | 'video' | 'audio' | 'file';
  name: string;
  url?: string;
  mimeType?: string;
}

export interface AttachmentProps {
  attachment: AttachmentMeta;
  variant?: 'compact' | 'card';
  onRemove?: () => void;
}

/* ─── Context (shared tokens) ────────────────────────────────── */

interface AttachmentListCtx {
  variant: 'compact' | 'card';
}
const AttachmentListContext = createContext<AttachmentListCtx>({ variant: 'compact' });

/* ─── Icons ──────────────────────────────────────────────────── */

const FileIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

const VideoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="14" height="14" rx="2" />
    <path d="m22 8-6 4 6 4V8z" />
  </svg>
);

const AudioIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const RemoveIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ─── Thumbnail ──────────────────────────────────────────────── */

function Thumb({ attachment }: { attachment: AttachmentMeta }) {
  if (attachment.type === 'image' && attachment.url) {
    return (
      <img
        src={attachment.url}
        alt={attachment.name}
        loading="lazy"
        decoding="async"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '5px',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  const iconMap: Record<AttachmentMeta['type'], React.ReactNode> = {
    image: <FileIcon />,
    video: <VideoIcon />,
    audio: <AudioIcon />,
    file: <FileIcon />,
  };

  return (
    <span
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.05)',
        color: 'currentColor',
      }}
    >
      {iconMap[attachment.type]}
    </span>
  );
}

/* ─── Single Attachment chip ─────────────────────────────────── */

export function Attachment({ attachment, variant: variantProp, onRemove }: AttachmentProps) {
  const ctx = useContext(AttachmentListContext);
  const variant = variantProp ?? ctx.variant;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        maxWidth: '100%',
        padding: '4px 8px 4px 4px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.75)',
        fontSize: '12px',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      data-hf-attachment-chip="true"
    >
      {/* Thumbnail or icon */}
      <Thumb attachment={attachment} />

      {/* Filename */}
      <span
        style={{
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1,
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
          fontWeight: 500,
        }}
      >
        {attachment.name}
      </span>

      {/* Type badge */}
      <span
        style={{
          padding: '1px 5px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.06)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          flexShrink: 0,
        }}
      >
        {attachment.type}
      </span>

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Retirer"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '999px',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <RemoveIcon />
        </button>
      )}
    </span>
  );
}

/* ─── List wrapper ───────────────────────────────────────────── */

export interface AttachmentListProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'compact' | 'card';
  children?: React.ReactNode;
}

export function AttachmentList({ variant = 'compact', children, style, ...rest }: AttachmentListProps) {
  return (
    <AttachmentListContext.Provider value={{ variant }}>
      <div
        style={{
          display: 'flex',
          gap: '7px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: '10px',
          ...style,
        }}
        {...rest}
      >
        {children}
      </div>
    </AttachmentListContext.Provider>
  );
}
