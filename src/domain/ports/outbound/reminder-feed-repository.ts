export interface PendingVisitFeedItem {
  visitId: string;
  fieldId: string;
  fieldName: string;
  clientName?: string;
  zoneName?: string;
  plannedFor: string;
  reminderLeadDays: number;
  notes?: string;
}

export interface ReminderFeedRepository {
  replace(items: PendingVisitFeedItem[]): Promise<void>;
}
