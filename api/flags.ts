import { flagsClient } from '@vercel/flags-core';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = JSON.stringify({ darkMode: false });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  try {
    const darkMode = await flagsClient.evaluate<boolean>('darkMode', false);
    res.end(JSON.stringify({ darkMode: darkMode.value }));
  } catch (error) {
    console.error('flags: evaluación falló, uso default', error);
    res.end(body);
  }
}
