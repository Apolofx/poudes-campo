import type { ZoneRecord, ClientRecord, FieldRecord } from '@/infrastructure/persistence/idb/records';

export const seedZones: ZoneRecord[] = [
  { id: 'zone-norte', name: 'Norte' },
  { id: 'zone-sur', name: 'Sur' },
  { id: 'zone-este', name: 'Este' },
  { id: 'zone-oeste', name: 'Oeste' },
];

export const seedClients: ClientRecord[] = [
  { id: 'client-perez', name: 'Establecimiento Pérez' },
  { id: 'client-gomez', name: 'Gómez Hnos.' },
  { id: 'client-lopez', name: 'La Lomada (López)' },
  { id: 'client-ruiz', name: 'Don Ruiz' },
  { id: 'client-molina', name: 'Campos Molina' },
  { id: 'client-sosa', name: 'Sosa y Cía.' },
];

const fieldNames = [
  'El Alto', 'La Baja', 'El Molino', 'Las Piedras', 'La Cañada', 'El Sauce',
  'Los Álamos', 'La Loma', 'El Bajo', 'La Isla', 'El Quebracho', 'Santa Rosa',
  'La Esperanza', 'El Ceibo', 'Los Toldos', 'La Invernada', 'El Retiro', 'La Costa',
  'El Espinillo', 'La Blanqueada',
];
const crops = ['soja', 'maíz', 'trigo', 'girasol', 'sorgo', 'pastura'];

export const seedFields: FieldRecord[] = Array.from({ length: 40 }, (_, i) => {
  const zone = seedZones[i % seedZones.length];
  const client = seedClients[i % seedClients.length];
  const baseName = fieldNames[i % fieldNames.length];
  const suffix = i < fieldNames.length ? '' : ` ${Math.floor(i / fieldNames.length) + 1}`;
  return {
    id: `field-${String(i + 1).padStart(4, '0')}`,
    name: `${baseName}${suffix}`,
    clientId: client.id,
    zoneId: zone.id,
    coordinates: { latitude: -33 - i * 0.01, longitude: -61 - i * 0.01 },
    hectares: 20 + (i % 8) * 15,
    crop: crops[i % crops.length],
  };
});
