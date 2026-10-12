import { useEffect, useRef, type ReactNode } from 'react';
/** Keep keyboard focus within the active game dialog, then return it to its opener. */
export function Modal({ label, children, onClose, className = '' }: { label: string; children: ReactNode; onClose?: () => void; className?: string }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = root.current?.querySelector<HTMLElement>('[data-autofocus], button:not(:disabled), input, select');
    (target ?? root.current)?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [label]);
  return <div className={`horde-modal ${className}`}><section ref={root} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); root.current?.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>{children}</section></div>;
}
