import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROPIAS, SPECS, type Spec } from './acciones.matriz';
import { run } from './fake-next';
import { buildWorld, globalSnapshot, loginAs, truncateAll, victimSnapshot, type World } from './world';

/**
 * Una prueba de permisos por cada acción del servidor.
 *
 * Para cada acción se comprueba:
 *   1. Sin sesión: no hace nada y manda a entrar.
 *   2. Con la sesión de OTRA persona: no cambia nada de la víctima (y no le revela nada).
 *   3. Con la sesión del dueño legítimo: sí funciona. Sin este control, una entrada mal escrita
 *      pasaría la prueba 2 sin demostrar nada.
 *   4. (Negocio) Una persona sin negocio no entra. (Admin) Un no-admin recibe 404.
 */

let w: World;

beforeEach(async () => {
  await truncateAll();
  w = await buildWorld();
});

async function photo(spec: Spec): Promise<string> {
  const victim = await victimSnapshot(w);
  return spec.audience === 'admin' ? `${victim}\n${await globalSnapshot()}` : victim;
}

function ownerOf(spec: Spec) {
  if (spec.audience === 'admin') return w.admin;
  if (spec.audience === 'negocio') return w.victimOwner;
  return w.victim;
}

describe.each(SPECS)('$id', (spec) => {
  it('sin sesión: manda a entrar y no cambia nada', async () => {
    await loginAs(null);
    const before = await photo(spec);
    const outcome = await run(() => spec.call(w));
    expect(outcome.redirect, 'debe redirigir a /entrar').toMatch(/^\/entrar/);
    expect(await photo(spec)).toBe(before);
  });

  it('con la sesión de otra persona: no toca nada de la víctima', async () => {
    await loginAs(spec.audience === 'admin' ? w.plain : w.attacker);
    const before = await photo(spec);
    const outcome = await run(() => spec.call(w));
    if (spec.audience === 'admin') {
      expect(outcome.notFound, 'un no-admin debe recibir 404').toBe(true);
    } else {
      expect(outcome.error, 'no debe fallar con un error inesperado').toBeUndefined();
      if (spec.worked && !spec.selfOnly) {
        expect(spec.worked(outcome), 'no debe lograr su efecto sobre un recurso ajeno').toBe(false);
      }
    }
    expect(await photo(spec)).toBe(before);
  });

  it('con la sesión del dueño: funciona', async () => {
    await loginAs(ownerOf(spec));
    const before = await photo(spec);
    const outcome = await run(() => spec.call(w));
    expect(outcome.error, 'el dueño no debe recibir un error').toBeUndefined();
    expect(outcome.notFound, 'el dueño no debe recibir 404').toBeUndefined();
    const changed = (await photo(spec)) !== before;
    expect(changed || spec.worked?.(outcome) === true, 'la acción debe tener efecto para su dueño').toBe(true);
  });

  if (spec.audience === 'negocio') {
    it('una persona sin negocio: no entra', async () => {
      await loginAs(w.plain);
      const before = await photo(spec);
      const outcome = await run(() => spec.call(w));
      expect(outcome.redirect).toBe('/negocio/registro');
      expect(await photo(spec)).toBe(before);
    });
  }

  if (spec.audience === 'admin') {
    it('el dueño de un negocio tampoco es admin: 404', async () => {
      await loginAs(w.victimOwner);
      const before = await photo(spec);
      const outcome = await run(() => spec.call(w));
      expect(outcome.notFound).toBe(true);
      expect(await photo(spec)).toBe(before);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Metaprueba: ninguna acción del servidor se queda sin prueba de permisos.
// ---------------------------------------------------------------------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Todos los `export` de los archivos 'use server' de src/, como "archivo#nombre" relativo a src/app. */
function exportedServerActions(): string[] {
  const appDir = path.resolve(process.cwd(), 'src', 'app');
  const srcDir = path.resolve(process.cwd(), 'src');
  const found: string[] = [];
  for (const file of walk(srcDir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    // La directiva de archivo va antes de cualquier import.
    if (!/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(source)) continue;
    const rel = path.relative(appDir, file).split(path.sep).join('/');
    const names = [
      ...source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm),
      ...source.matchAll(/^export\s+const\s+([A-Za-z0-9_]+)\s*=/gm),
    ].map((m) => m[1]!);
    for (const name of names) found.push(`${rel}#${name}`);
  }
  return found.sort();
}

describe('cobertura de permisos', () => {
  const covered = [...SPECS.map((s) => s.id), ...Object.keys(PROPIAS)].sort();

  it('cada acción exportada desde un archivo "use server" tiene su prueba de permisos', () => {
    expect(covered).toEqual(exportedServerActions());
  });

  it('no hay acciones repetidas en la matriz', () => {
    expect(new Set(covered).size).toBe(covered.length);
  });

  it('las acciones con prueba propia tienen su describe en el archivo indicado', () => {
    for (const [id, file] of Object.entries(PROPIAS)) {
      const source = readFileSync(path.resolve(process.cwd(), 'test', 'integration', file), 'utf8');
      expect(source.includes(`'${id}'`), `${file} debe tener un describe('${id}')`).toBe(true);
    }
  });

  it('un archivo "use server" solo exporta funciones async (no ayudantes que reciban un userId)', () => {
    // Todo export de estos archivos es un endpoint público. Un ayudante que recibe userId
    // se saltaría la sesión: esos viven en src/lib.
    const srcDir = path.resolve(process.cwd(), 'src');
    const offenders: string[] = [];
    for (const file of walk(srcDir)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (!/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(source)) continue;
      for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm)) {
        if (/\buserId\b|\bmerchantId\s*:/.test(m[2] ?? '')) offenders.push(`${path.basename(file)}#${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
