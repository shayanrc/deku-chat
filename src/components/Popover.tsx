import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * <details class="pop"> popover matching the design prototype,
 * with close-on-outside-click and close-on-item-select.
 */
export function Popover({
  summary,
  summaryClass = 'pill-summary',
  summaryStyle,
  panelStyle,
  children,
}: {
  summary: ReactNode;
  summaryClass?: string;
  summaryStyle?: CSSProperties;
  panelStyle: CSSProperties;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key === 'Escape' && el?.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => {
    if (ref.current) ref.current.open = false;
  };

  return (
    <details className="pop" ref={ref}>
      <summary className={summaryClass} style={summaryStyle}>{summary}</summary>
      <div className="pop-panel" style={panelStyle}>
        {typeof children === 'function' ? children(close) : children}
      </div>
    </details>
  );
}
