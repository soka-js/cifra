import { LogOut, Store, UserRound } from 'lucide-react';
import { exitDemo, openDemoAs } from '@/app/admin/actions';

/**
 * Franja fija que se ve SIEMPRE que un admin está mirando la demo. Deja claro que todo lo que hay
 * en pantalla son datos de ejemplo, permite pasar de la persona a la tendera y salir.
 * Solo se renderiza cuando la sesión está en modo demo (ver getSessionContext).
 */
export function DemoBar({ viewing }: { viewing: 'persona' | 'tendero' }) {
  return (
    <div
      role="status"
      data-testid="demo-bar"
      className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 bg-ink px-3.5 py-2 text-[12.5px] text-white"
    >
      <span className="font-semibold">
        Demo <span className="font-normal text-white/75">· datos de ejemplo, no son de una persona real</span>
      </span>
      <span className="flex items-center gap-1.5">
        <form action={openDemoAs}>
          <input type="hidden" name="role" value="persona" />
          <button
            type="submit"
            aria-pressed={viewing === 'persona'}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
              viewing === 'persona' ? 'bg-white text-ink' : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <UserRound size={13} aria-hidden="true" /> Persona
          </button>
        </form>
        <form action={openDemoAs}>
          <input type="hidden" name="role" value="tendero" />
          <button
            type="submit"
            aria-pressed={viewing === 'tendero'}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
              viewing === 'tendero' ? 'bg-white text-ink' : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Store size={13} aria-hidden="true" /> Tendero
          </button>
        </form>
        <form action={exitDemo}>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full border border-white/30 px-2.5 py-1 font-semibold text-white hover:bg-white/10"
          >
            <LogOut size={13} aria-hidden="true" /> Salir
          </button>
        </form>
      </span>
    </div>
  );
}
