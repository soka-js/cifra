import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardián de la regla "cada número tiene recibo": todo peso en pantalla sale de los datos del
 * usuario o va rotulado como ejemplo. Esta prueba lee el código de las pantallas y falla si
 * aparece un monto escrito a mano que no esté en la lista de excepciones revisadas.
 *
 * Si falla: lo normal es que el número deba salir de un dato (y entonces el literal sobra).
 * Solo si de verdad es un ejemplo rotulado o un umbral de validación, agrégalo a la lista
 * con su porqué.
 */

const ROOT = process.cwd();
const SCREEN_DIRS = ['src/app', 'src/components'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const screenFiles = SCREEN_DIRS.flatMap((d) => walk(path.join(ROOT, d)))
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));

function hits(file: string, re: RegExp): string[] {
  const out: string[] = [];
  readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(re)) out.push(`${file}:${i + 1}  ${m[0]}`);
    });
  return out;
}

function check(re: RegExp, allowed: Record<string, { max: number; why: string }>) {
  const problems: string[] = [];
  for (const file of screenFiles) {
    const found = hits(file, re);
    const limit = allowed[file]?.max ?? 0;
    if (found.length > limit) {
      problems.push(`${file}: ${found.length} (permitidos ${limit})`, ...found.map((h) => `    ${h}`));
    }
  }
  // La lista de excepciones no puede quedar vieja: si un archivo ya no los tiene, se quita de la lista.
  for (const [file, { max }] of Object.entries(allowed)) {
    const count = screenFiles.includes(file) ? hits(file, re).length : 0;
    if (count < max) problems.push(`${file}: la lista permite ${max} y quedan ${count}. Baja el número o quita la entrada.`);
  }
  return problems;
}

describe('cada número tiene recibo', () => {
  it('no hay montos en centavos escritos a mano en pantallas ni componentes', () => {
    // Literales como 1_800_000_00 o 24_000_00.
    const problems = check(/\b\d[\d_]*_\d{3}_00\b/g, {
      'src/components/landing/receipt.tsx': {
        max: 3,
        why: 'Ejemplo fijo de la página de presentación, rotulado como ejemplo en pantalla.',
      },
      'src/app/actions/v3.ts': {
        max: 1,
        why: 'Umbral de validación (meta diaria mínima de un negocio). No se muestra como dato.',
      },
      'src/app/app/gasto/ask.tsx': {
        max: 4,
        why: 'PENDIENTE Etapa 2: alternativa sugerida con un factor 0,65 sin explicar y umbral del simulador de cuotas.',
      },
      'src/components/app/spending-dashboard-chart.tsx': {
        max: 7,
        why: 'PENDIENTE Etapa 2: umbrales de escala de la gráfica y etiquetas "$45k" armadas a mano.',
      },
    });
    expect(problems).toEqual([]);
  });

  it('ningún monto se formatea a mano: todo pasa por cop()', () => {
    // Plantillas que arman "$" + número, por ejemplo `$${valor}`.
    const problems = check(/`[^`\n]*\$\$\{/g, {
      'src/components/app/spending-dashboard-chart.tsx': {
        max: 2,
        why: 'PENDIENTE Etapa 2: etiquetas compactas del eje ("$1.2M", "$45k").',
      },
    });
    expect(problems).toEqual([]);
  });

  it('los miles van con punto, no con coma', () => {
    // 1,234 o 1,234,567 dentro del texto. No aplica a cuantificadores de expresiones regulares ({20,100}).
    const problems = check(/(?<![\d.,{])\d{1,3}(?:,\d{3})+(?![\d,}])/g, {});
    expect(problems).toEqual([]);
  });
});
