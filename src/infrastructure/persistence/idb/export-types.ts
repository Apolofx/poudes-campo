import type { VisitStatus } from '@/domain/entities/visit';
import type { ReminderStatus } from '@/domain/entities/reminder';
import type { MediaKind } from '@/domain/entities/visit-media';
import type { ZoneRecord, ClientRecord, FieldRecord } from './records';

export const CURRENT_EXPORT_VERSION = 1 as const;

export interface SerializedVisitRecord {
  id: string;
  fieldId: string;
  status: VisitStatus;
  plannedFor?: string; // ISO 8601
  visitedAt?: string; // ISO 8601
  reminderLeadDays?: number;
  notes?: string;
  createdAt: string; // ISO 8601
  cancelledAt?: string; // ISO 8601
}

export interface SerializedReminderRecord {
  id: string;
  visitId: string;
  fieldId: string;
  remindAt: string; // ISO 8601
  status: ReminderStatus;
}

export interface SerializedMediaRecord {
  id: string;
  visitId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: string; // ISO 8601
  blobDataUrl: string; // data:<mime>;base64,...
}

export interface CampoExport {
  version: typeof CURRENT_EXPORT_VERSION;
  exportedAt: string; // ISO 8601
  zones: ZoneRecord[];
  clients: ClientRecord[];
  fields: FieldRecord[];
  visits: SerializedVisitRecord[];
  reminders: SerializedReminderRecord[];
  media: SerializedMediaRecord[];
}

export interface ImportSummary {
  zones: number;
  clients: number;
  fields: number;
  visits: number;
  reminders: number;
  media: number;
}

export interface ImportResult {
  skipped: number;
}