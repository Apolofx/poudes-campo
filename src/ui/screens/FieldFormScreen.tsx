import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCatalogFields } from '@/ui/hooks/use-catalog-fields';
import { useCampo } from '@/ui/CampoProvider';
import { catalogErrorMessage } from '@/ui/error-messages';

export function FieldFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { zones, clients } = useCatalogFields();
  const { createField, editField, listCatalogFields } = useCampo();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!id) return;
    void listCatalogFields.execute().then((rows) => {
      const row = rows.find((r) => r.field.id === id);
      if (row) {
        setName(row.field.name);
        setClientId(row.field.clientId ?? '');
        setZoneId(row.field.zoneId ?? '');
      }
    });
  }, [id, listCatalogFields]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const input = { name, clientId: clientId || undefined, zoneId: zoneId || undefined };
    try {
      if (id) await editField.execute({ id, ...input });
      else await createField.execute(input);
      navigate('/catalogo/lotes');
    } catch (err) {
      setError(catalogErrorMessage(err as Error));
    }
  };

  return (
    <main className="screen">
      <button type="button" className="back-link" onClick={() => navigate('/catalogo/lotes')}>‹ Lotes</button>
      <h1 className="screen-title">{id ? 'Editar lote' : 'Nuevo lote'}</h1>
      <form onSubmit={onSubmit} className="catalog-form">
        <label className="form-label">
          Nombre
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="form-label">
          Cliente
          <select className="form-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sin cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="form-label">
          Zona
          <select className="form-input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Sin zona</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn-primary">Guardar</button>
      </form>
    </main>
  );
}
