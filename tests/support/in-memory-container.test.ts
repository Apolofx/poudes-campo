import { describe, it, expect } from 'vitest';
import { makeInMemoryContainer } from './in-memory-container';

describe('in-memory container — etapa 4a wiring', () => {
  it('records a visit then cancels it through the container', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const { visitId } = await c.recordVisit.execute({
      fieldId: 'f1',
      visitDate: new Date('2026-07-27T10:00:00Z'),
      followUp: { kind: 'interval', days: 7 },
    });
    await c.cancelVisit.execute({ visitId });
    const view = await c.getFieldHistory.execute('f1');
    expect(view?.visits[0].status).toBe('CANCELLED');
    const visit = await c.getVisit.execute(visitId);
    expect(visit?.status).toBe('CANCELLED');
  });
});
