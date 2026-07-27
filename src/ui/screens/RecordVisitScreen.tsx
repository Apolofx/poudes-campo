import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FollowUpInput } from '@/application/use-cases/record-visit';
import { useRecordVisit } from '@/ui/hooks/use-record-visit';
import { domainErrorMessage } from '@/ui/error-messages';

type FollowUpKind = 'interval' | 'date' | 'none';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function RecordVisitScreen() {
  const { fieldId = '' } = useParams();
  const navigate = useNavigate();
  const { submit, submitting, error, result } = useRecordVisit();

  const [visitDate, setVisitDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('interval');
  const [intervalDays, setIntervalDays] = useState(14);
  const [nextDate, setNextDate] = useState(todayIso());
  const [leadDays, setLeadDays] = useState(3);

  useEffect(() => {
    if (result) navigate('/');
  }, [result, navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let followUp: FollowUpInput;
    if (kind === 'interval') {
      followUp = { kind: 'interval', days: intervalDays, reminderLeadDays: leadDays };
    } else if (kind === 'date') {
      followUp = { kind: 'date', date: utcDate(nextDate), reminderLeadDays: leadDays };
    } else {
      followUp = { kind: 'none' };
    }
    submit({
      fieldId,
      visitDate: utcDate(visitDate),
      notes: notes.trim() === '' ? undefined : notes,
      followUp,
    });
  };

  return (
    <main>
      <h1>Registrar visita</h1>
      <form onSubmit={onSubmit}>
        <label>
          Fecha
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
        <label>
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <fieldset>
          <legend>Próxima visita</legend>
          <label>
            <input type="radio" name="kind" checked={kind === 'interval'} onChange={() => setKind('interval')} />
            En N días
          </label>
          <label>
            <input type="radio" name="kind" checked={kind === 'date'} onChange={() => setKind('date')} />
            En una fecha
          </label>
          <label>
            <input type="radio" name="kind" checked={kind === 'none'} onChange={() => setKind('none')} />
            Sin próxima
          </label>
          {kind === 'interval' && (
            <label>
              Días
              <input
                type="number"
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
              />
            </label>
          )}
          {kind === 'date' && (
            <label>
              Fecha próxima
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </label>
          )}
          {kind !== 'none' && (
            <label>
              Avisar días antes
              <input
                type="number"
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
              />
            </label>
          )}
        </fieldset>
        {error && <p role="alert">{domainErrorMessage(error)}</p>}
        <button type="submit" disabled={submitting}>
          Registrar
        </button>
      </form>
    </main>
  );
}
