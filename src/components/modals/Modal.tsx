import { useEffect, useRef, type ReactNode } from 'react';
import { X } from '../icons';

const FOCUSABLE = 'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  width,
  onClose,
  closeDisabled = false,
  children,
}: {
  width: number;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeDisabledRef = useRef(closeDisabled);
  closeDisabledRef.current = closeDisabled;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!closeDisabledRef.current) onCloseRef.current();
      } else if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  const close = () => {
    if (!closeDisabled) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal modal-in"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={ref}
      >
        <button
          className="btn btn-icon"
          onClick={close}
          title="Close"
          style={{ position: 'absolute', top: 18, right: 18, zIndex: 3 }}
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
