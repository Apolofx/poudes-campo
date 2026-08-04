import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '@/ui/hooks/use-pwa-install';

export function InstallBanner() {
  const { canPrompt, isIOS, promptToInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (canPrompt) {
    return (
      <aside className="install-banner" role="region" aria-label="Instalar la app">
        <div className="install-banner-head">
          <span className="install-banner-title">
            <Download size={16} aria-hidden="true" />
            Instalar Campo
          </span>
          <button
            className="install-banner-close"
            type="button"
            aria-label="Cerrar aviso de instalación"
            onClick={() => setDismissed(true)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="install-banner-text">Accedé desde tu pantalla de inicio y usala sin conexión.</p>
        <button className="btn-primary" type="button" onClick={() => void promptToInstall()}>
          Instalar
        </button>
      </aside>
    );
  }

  if (isIOS) {
    return (
      <aside className="install-banner is-ios" role="region" aria-label="Cómo instalar la app">
        <div className="install-banner-head">
          <span className="install-banner-title">
            <Share size={16} aria-hidden="true" />
            Instalar Campo
          </span>
          <button
            className="install-banner-close"
            type="button"
            aria-label="Cerrar aviso de instalación"
            onClick={() => setDismissed(true)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="install-banner-text">
          En Safari tocá <strong>Compartir</strong> y elegí <strong>Agregar a Inicio</strong>.
        </p>
      </aside>
    );
  }

  return null;
}
