import { RefreshCw, X } from 'lucide-react';
import { useSWUpdate } from '@/ui/hooks/useSWUpdate';

export function UpdateBanner() {
  const { updated, dismiss } = useSWUpdate();

  if (!updated) return null;

  return (
    <aside className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-head">
        <span className="update-banner-title">
          <RefreshCw size={16} aria-hidden="true" />
          Campo se actualizó a v{__APP_VERSION__}
        </span>
        <button
          className="update-banner-close"
          type="button"
          aria-label="Cerrar aviso de actualización"
          onClick={dismiss}
        >
          <X size={16} />
        </button>
      </div>
      {__CHANGELOG__.entries.length > 0 && (
        <ul className="update-banner-list">
          {__CHANGELOG__.entries.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
