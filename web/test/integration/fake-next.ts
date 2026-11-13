/**
 * Doble de las piezas de Next.js que usa el código de servidor, para poder llamar acciones y
 * manejadores de ruta desde una prueba: un tarro de cookies en memoria (la "petición" actual)
 * y señales que reemplazan a redirect() y notFound().
 */

/** Cookies de la petición simulada. La sesión de la prueba vive aquí (cookie cf_session). */
export const jar = new Map<string, string>();

/** Encabezados de la petición simulada. */
export const requestHeaders = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'Mozilla/5.0 (prueba de integración)',
});

/** Lo que lanza redirect() en las pruebas. */
export class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect(${url})`);
  }
}

/** Lo que lanza notFound() en las pruebas. */
export class NotFoundSignal extends Error {
  constructor() {
    super('notFound()');
  }
}

export interface Outcome {
  /** Valor devuelto, si la llamada terminó normalmente. */
  result?: unknown;
  /** Destino, si la llamada terminó en redirect(). */
  redirect?: string;
  /** true si la llamada terminó en notFound(). */
  notFound?: boolean;
  /** Cualquier otro error lanzado. */
  error?: unknown;
}

/** Ejecuta una llamada de servidor y dice cómo terminó, sin dejar escapar las señales. */
export async function run(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { result: await fn() };
  } catch (e) {
    if (e instanceof RedirectSignal) return { redirect: e.url };
    if (e instanceof NotFoundSignal) return { notFound: true };
    return { error: e };
  }
}

/** FormData a partir de un objeto plano. */
export function fd(fields: Record<string, string | number | undefined>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) form.append(k, String(v));
  }
  return form;
}
