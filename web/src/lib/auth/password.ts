import 'server-only';
import { hash, verify } from '@node-rs/argon2';

// Parámetros recomendados por OWASP para argon2id (19 MiB, 2 iteraciones).
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
