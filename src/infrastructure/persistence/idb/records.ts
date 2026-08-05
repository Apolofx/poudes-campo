import { Field } from '@/domain/entities/field';
import { Visit, type VisitStatus } from '@/domain/entities/visit';
import { Reminder, type ReminderStatus } from '@/domain/entities/reminder';
import { VisitMedia, type MediaKind } from '@/domain/entities/visit-media';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';

export interface ZoneRecord {
  id: string;
  name: string;
  archived?: boolean;
}

export interface ClientRecord {
  id: string;
  name: string;
  archived?: boolean;
}

export interface FieldRecord {
  id: string;
  name: string;
  clientId?: string;
  zoneId?: string;
  coordinates?: { latitude: number; longitude: number };
  hectares?: number;
  crop?: string;
  archived?: boolean;
}

export interface VisitRecord {
  id: string;
  fieldId: string;
  status: VisitStatus;
  plannedFor?: Date;
  visitedAt?: Date;
  reminderLeadDays?: number;
  notes?: string;
  createdAt: Date;
  cancelledAt?: Date;
}

export interface ReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: Date;
  status: ReminderStatus;
}

export interface MediaRecord {
  id: string;
  visitId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  blob: Blob;
}

export function toZoneRecord(z: Zone): ZoneRecord {
  return { id: z.id, name: z.name, archived: z.archived };
}

export function fromZoneRecord(r: ZoneRecord): Zone {
  return new Zone(r.id, r.name, r.archived ?? false);
}

export function toClientRecord(c: Client): ClientRecord {
  return { id: c.id, name: c.name, archived: c.archived };
}

export function fromClientRecord(r: ClientRecord): Client {
  return new Client(r.id, r.name, r.archived ?? false);
}

export function toFieldRecord(f: Field): FieldRecord {
  return {
    id: f.id,
    name: f.name,
    clientId: f.clientId,
    zoneId: f.zoneId,
    coordinates: f.coordinates
      ? { latitude: f.coordinates.latitude, longitude: f.coordinates.longitude }
      : undefined,
    hectares: f.hectares?.value,
    crop: f.crop,
    archived: f.archived,
  };
}

export function fromFieldRecord(r: FieldRecord): Field {
  return new Field({
    id: r.id,
    name: r.name,
    clientId: r.clientId,
    zoneId: r.zoneId,
    coordinates: r.coordinates
      ? Coordinates.of(r.coordinates.latitude, r.coordinates.longitude)
      : undefined,
    hectares: r.hectares !== undefined ? Hectares.of(r.hectares) : undefined,
    crop: r.crop,
    archived: r.archived ?? false,
  });
}

export function toVisitRecord(v: Visit): VisitRecord {
  return {
    id: v.id,
    fieldId: v.fieldId,
    status: v.status,
    plannedFor: v.plannedFor,
    visitedAt: v.visitedAt,
    reminderLeadDays: v.reminderLeadDays,
    notes: v.notes,
    createdAt: v.createdAt,
    cancelledAt: v.cancelledAt,
  };
}

export function fromVisitRecord(r: VisitRecord): Visit {
  return new Visit({
    id: r.id,
    fieldId: r.fieldId,
    status: r.status,
    plannedFor: r.plannedFor,
    visitedAt: r.visitedAt,
    reminderLeadDays: r.reminderLeadDays,
    notes: r.notes,
    createdAt: r.createdAt,
    cancelledAt: r.cancelledAt,
  });
}

export function toReminderRecord(rm: Reminder): ReminderRecord {
  return {
    id: rm.id,
    visitId: rm.visitId,
    fieldId: rm.fieldId,
    remindAt: rm.remindAt,
    status: rm.status,
  };
}

export function fromReminderRecord(r: ReminderRecord): Reminder {
  return new Reminder({
    id: r.id,
    visitId: r.visitId,
    fieldId: r.fieldId,
    remindAt: r.remindAt,
    status: r.status,
  });
}

export function toMediaRecord(m: VisitMedia): MediaRecord {
  return {
    id: m.id,
    visitId: m.visitId,
    kind: m.kind,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    createdAt: m.createdAt,
    blob: m.blob,
  };
}

export function fromMediaRecord(r: MediaRecord): VisitMedia {
  return new VisitMedia({
    id: r.id,
    visitId: r.visitId,
    kind: r.kind,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    createdAt: r.createdAt,
    blob: r.blob,
  });
}
