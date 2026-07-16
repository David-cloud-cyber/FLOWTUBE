/**
 * HFComponents entry point
 *
 * This IIFE bundle is loaded AFTER React/ReactDOM are already on window
 * (mounted by support.js). It exposes a global `window.HFComponents` object
 * that the dc-runtime can call to mount React components into the existing UI.
 *
 * Usage in the dc-runtime template (via React.createElement):
 *   React.createElement(window.HFComponents.AttachmentList, {...})
 *
 * Or imperatively for a plain DOM slot:
 *   window.HFComponents.mountAttachments(domEl, attachments, onRemove)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Attachment, AttachmentList, type AttachmentMeta } from '@/components/nexus-ui/attachments';

// Re-export for use as React elements within dc-runtime computed props
export { Attachment, AttachmentList };
export type { AttachmentMeta };

/**
 * Imperatively mount / update the attachment list into a DOM element.
 * Called by the dc-runtime's `localView()` whenever `attachments` changes.
 */
export function mountAttachments(
  container: HTMLElement,
  attachments: Array<AttachmentMeta & { onRemove?: () => void }>,
) {
  const root = (container as any).__hfRoot;
  const render = () => (
    <AttachmentList>
      {attachments.map((a) => (
        <Attachment
          key={`${a.name}-${a.type}`}
          variant="compact"
          attachment={a}
          onRemove={a.onRemove}
        />
      ))}
    </AttachmentList>
  );

  if (!root) {
    (container as any).__hfRoot = ReactDOM.createRoot(container);
    (container as any).__hfRoot.render(render());
  } else {
    root.render(render());
  }
}

// Expose on window so support.js / dc-runtime can call it without imports
declare global {
  interface Window {
    HFComponents: typeof import('./components-entry');
  }
}
(window as any).HFComponents = { Attachment, AttachmentList, mountAttachments };
