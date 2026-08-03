import type { PendingVisitFeedItem, ReminderFeedRepository } from '@/domain/ports/outbound/reminder-feed-repository';

export class HttpReminderFeedRepository implements ReminderFeedRepository {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async replace(items: PendingVisitFeedItem[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/pending-visits`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(items),
    });
    if (!res.ok) throw new Error(`reminder feed: HTTP ${res.status}`);
  }
}
