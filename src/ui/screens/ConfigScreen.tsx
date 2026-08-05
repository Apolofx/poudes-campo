import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '@/ui/TenantConfigProvider';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

export function ConfigScreen() {
  const { config, save } = useTenantConfig();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_REMINDERS_API_URL ?? '');
  const [localError, setLocalError] = useState<string | undefined>();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || !config) return;
    hydrated.current = true;
    setApiKey(config.apiKey ?? '');
    setApiUrl(config.apiUrl ?? '');
  }, [config]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiUrl.trim()) {
      setLocalError('Completá la clave de acceso y la URL de la API.');
      return;
    }
    setLocalError(undefined);
    await save({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim() });
    navigate('/', { replace: true });
  };

  return (
    <main className="screen record">
      <h1 className="screen-title">Configuración</h1>
      <p className="field-sub">Pegá la clave de acceso que te pasaron para activar los recordatorios por email.</p>
      <div className="field config-theme">
        <span className="field-label">Tema</span>
        <ThemeToggle />
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Clave de acceso</span>
          <input className="control" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">URL de la API</span>
          <input className="control" type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        </label>
        {localError && (
          <p className="alert" role="alert">
            {localError}
          </p>
        )}
        <button className="btn-primary" type="submit">
          Guardar
        </button>
      </form>
    </main>
  );
}
