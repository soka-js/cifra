import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardián de los enlaces absolutos (QR del afiche, correo, WhatsApp).
 *
 * El 17 nov el QR de la vitrina apuntaba a `cifra-inky.vercel.app`, un dominio escrito a mano que
 * ya no existe, porque leía `NEXT_PUBLIC_APP_URL`, una variable que no está en ningún entorno. Toda
 * dirección pública sale de `siteUrl()` en `src/lib/site.ts`.
 */

const SRC = path.resolve(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}__tests__${path.sep}`))
  .map((f) => path.relative(SRC, f).split(path.sep).join('/'));

function hits(re: RegExp): string[] {
  return files.flatMap((file) =>
    readFileSync(path.join(SRC, file), 'utf8')
      .split('\n')
      .flatMap((line, i) => (re.test(line) ? [`${file}:${i + 1}  ${line.trim()}`] : [])),
  );
}

describe('las direcciones públicas salen de siteUrl()', () => {
  it('no hay dominios de Vercel escritos a mano', () => {
    expect(hits(/https?:\/\/[a-z0-9-]+\.vercel\.app/i)).toEqual([]);
  });

  it('nadie lee NEXT_PUBLIC_APP_URL, que no existe en Vercel', () => {
    expect(hits(/NEXT_PUBLIC_APP_URL/)).toEqual([]);
  });
});
