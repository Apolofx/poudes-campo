import { flagsClient } from '@vercel/flags-core';
import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULTS: Record<string, boolean> = { onboardingNuevo: false };

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  try {
    const onboardingNuevo = await flagsClient.evaluate<boolean>('onboardingNuevo', false);
    res.end(JSON.stringify({ onboardingNuevo: onboardingNuevo.value }));
  } catch (error) {
    console.error('flags: evaluación falló, uso default', error);
    res.end(JSON.stringify(DEFAULTS));
  }
}
