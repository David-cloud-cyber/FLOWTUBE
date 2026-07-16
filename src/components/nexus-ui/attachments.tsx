import React, {
  createContext,
  useContext,
  memo,
  type HTMLAttributes,
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

/* ─── Icons (memoized to prevent unnecessary re-renders) ─────── */

const FileIcon = memo(() => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
));

const VideoIcon = memo(() => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="14" height="14" rx="2" />
    <path d="m22 8-6 4 6 4V8z" />
  </svg>
));

const AudioIcon = memo(() => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
));

const RemoveIcon = memo(() => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
));

/* ─── Single Attachment card (memoized) ──────────────────────── */

export const Attachment = memo(function Attachment({ attachment, variant: variantProp, onRemove }: AttachmentProps) {
  const ctx = useContext(AttachmentListContext);
  const variant = variantProp ?? ctx.variant;

  const isImage = attachment.type === 'image';
  const hasPreview = isImage && !!attachment.url;

  const iconMap: Record<AttachmentMeta['type'], React.ReactNode> = {
    image: <FileIcon />,
    video: <VideoIcon />,
    audio: <AudioIcon />,
    file: <FileIcon />,
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '52px',
        height: '52px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: hasPreview ? '#1c54e0' : 'rgba(255,255,255,0.03)',
        border: hasPreview ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
        boxSizing: 'border-box',
        overflow: 'visible',
        color: '#ffffff',
        transition: 'all 0.2s ease',
      }}
      data-hf-attachment-chip="true"
    >
      {hasPreview ? (
        <img
          src={attachment.url}
          alt={attachment.name}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '12px',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div style={{ opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {iconMap[attachment.type]}
        </div>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Retirer"
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            background: '#ffffff',
            color: '#1a1d20',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transition: 'transform 0.15s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          <RemoveIcon />
        </button>
      )}
    </div>
  );
});

/* ─── List wrapper (memoized) ────────────────────────────────── */

export interface AttachmentListProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'compact' | 'card';
  children?: React.ReactNode;
}

export const AttachmentList = memo(function AttachmentList({ variant = 'compact', children, style, ...rest }: AttachmentListProps) {
  return (
    <AttachmentListContext.Provider value={{ variant }}>
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: '4px',
          marginBottom: '12px',
          paddingLeft: '2px',
          ...style,
        }}
        {...rest}
      >
        {children}
      </div>
    </AttachmentListContext.Provider>
  );
});
