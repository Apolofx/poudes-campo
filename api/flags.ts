import { flagsClient } from '@vercel/flags-core';
import type { IncomingMessage, ServerResponse } from 'node:http';

const FLAGS = ['onboardingNuevo', 'mediaVisitas'] as const;
type FlagName = (typeof FLAGS)[number];

const DEFAULTS: Record<FlagName, boolean> = { onboardingNuevo: false, mediaVisitas: false };

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  try {
    const entries = await Promise.all(
      FLAGS.map(async (name) => [name, (await flagsClient.evaluate<boolean>(name, false)).value] as const),
    );
    res.end(JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    console.error('flags: evaluación falló, uso default', error);
    res.end(JSON.stringify(DEFAULTS));
  }
}
