import { Field } from '@/domain/entities/field';
import { Visit, type VisitStatus } from '@/domain/entities/visit';
import { Reminder, type ReminderStatus } from '@/domain/entities/reminder';
import { ScheduledVisit, type ScheduledVisitStatus } from '@/domain/entities/scheduled-visit';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { VisitInterval } from '@/domain/value-objects/visit-interval';

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
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: { nextVisitDate: Date; intervalDays: number };
  status: VisitStatus;
  cancelledAt?: Date;
}

export interface ReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: Date;
  status: ReminderStatus;
  scheduledVisitId?: string;
}

export interface ScheduledVisitRecord {
  id: string;
  fieldId: string;
  scheduledDate: Date;
  reminderLeadDays: number;
  createdAt: Date;
  notes?: string;
  status: ScheduledVisitStatus;
  cancelledAt?: Date;
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
    visitDate: v.visitDate,
    createdAt: v.createdAt,
    notes: v.notes,
    followUp: v.followUp
      ? { nextVisitDate: v.followUp.nextVisitDate, intervalDays: v.followUp.interval.days }
      : undefined,
    status: v.status,
    cancelledAt: v.cancelledAt,
  };
}

export function fromVisitRecord(r: VisitRecord): Visit {
  return new Visit({
    id: r.id,
    fieldId: r.fieldId,
    visitDate: r.visitDate,
    createdAt: r.createdAt,
    notes: r.notes,
    followUp: r.followUp
      ? { nextVisitDate: r.followUp.nextVisitDate, interval: VisitInterval.ofDays(r.followUp.intervalDays) }
      : undefined,
    status: r.status,
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
    scheduledVisitId: rm.scheduledVisitId,
  };
}

export function fromReminderRecord(r: ReminderRecord): Reminder {
  return new Reminder({
    id: r.id,
    visitId: r.visitId,
    fieldId: r.fieldId,
    remindAt: r.remindAt,
    status: r.status,
    scheduledVisitId: r.scheduledVisitId,
  });
}

export function toScheduledVisitRecord(s: ScheduledVisit): ScheduledVisitRecord {
  return {
    id: s.id,
    fieldId: s.fieldId,
    scheduledDate: s.scheduledDate,
    reminderLeadDays: s.reminderLeadDays,
    createdAt: s.createdAt,
    notes: s.notes,
    status: s.status,
    cancelledAt: s.cancelledAt,
  };
}

export function fromScheduledVisitRecord(r: ScheduledVisitRecord): ScheduledVisit {
  return new ScheduledVisit({
    id: r.id,
    fieldId: r.fieldId,
    scheduledDate: r.scheduledDate,
    reminderLeadDays: r.reminderLeadDays,
    createdAt: r.createdAt,
    notes: r.notes,
    status: r.status,
    cancelledAt: r.cancelledAt,
  });
}
