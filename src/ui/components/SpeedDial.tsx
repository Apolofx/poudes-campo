import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';

export interface SpeedDialAction {
  label: string;
  to: string;
  icon: ReactNode;
}

interface SpeedDialProps {
  actions: SpeedDialAction[];
  ariaLabel: string;
}

export function SpeedDial({ actions, ariaLabel }: SpeedDialProps) {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const onOpenRef = useRef(setOpen);
  onOpenRef.current = setOpen;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenRef.current(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="speed-dial">
      {open && <div className="speed-dial-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="speed-dial-actions">
          {actions.map((a) => (
            <Link
              key={a.to}
              className="speed-dial-action"
              to={a.to}
              onClick={() => setOpen(false)}
            >
              <span className="speed-dial-action-label">{a.label}</span>
              <span className="speed-dial-action-icon">{a.icon}</span>
            </Link>
          ))}
        </div>
      )}
      <button
        ref={fabRef}
        type="button"
        className="fab"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={26} aria-hidden="true" /> : <Plus size={26} aria-hidden="true" />}
      </button>
    </div>
  );
}
