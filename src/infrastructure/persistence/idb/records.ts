import { Field } from '@/domain/entities/field';
import { Visit, type VisitStatus } from '@/domain/entities/visit';
import { Reminder, type ReminderStatus } from '@/domain/entities/reminder';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { VisitInterval } from '@/domain/value-objects/visit-interval';

export interface ZoneRecord {
  id: string;
  name: string;
}

export interface ClientRecord {
  id: string;
  name: string;
}

export interface FieldRecord {
  id: string;
  name: string;
  clientId: string;
  zoneId: string;
  coordinates?: { latitude: number; longitude: number };
  hectares?: number;
  crop?: string;
}

export interface VisitRecord {
  id: string;
  fieldId: string;
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: { nextVisitDate: Date; intervalDays: number };
  status: VisitStatus;
}

export interface ReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: Date;
  status: ReminderStatus;
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
