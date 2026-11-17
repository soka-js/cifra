/**
 * La guía de primera vez del Hoy recuerda lo que la persona ya hizo con dos cookies sin datos
 * personales. Viven aquí (y no en el componente) porque las leen el servidor y el navegador.
 */
export const GUIDE_COOKIE = 'cf_guia';
export const ASKED_COOKIE = 'cf_pregunto';
/** Lo avisa "¿Puedo gastar?" cuando la persona pregunta, para marcar el paso sin recargar. */
export const ASKED_EVENT = 'cifra:pregunto';
/** La guía solo sale en cuentas nuevas. */
export const GUIDE_DAYS = 14;

const YEAR = 60 * 60 * 24 * 365;

/** Solo en el navegador. */
export function rememberCookie(name: string): void {
  try {
    document.cookie = `${name}=1; path=/; max-age=${YEAR}; samesite=lax`;
  } catch {
    // Sin cookies: la guía simplemente vuelve a salir.
  }
}
