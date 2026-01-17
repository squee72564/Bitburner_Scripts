import { NS } from '@ns';

export type ResultPayload = Record<string, unknown>;

export async function writeResult(ns: NS, filename: string, payload: ResultPayload): Promise<void> {
  const content = JSON.stringify(
    {
      timestamp: Date.now(),
      ...payload,
    },
    null,
    2,
  );
  await ns.write(filename, content, 'w');
}
