'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cop, shortDate } from '@/lib/format';

/**
 * El Hoy en una tarjeta: la cifra, su única equivalencia por día y, debajo (children), la resta
 * de dónde sale. Un solo número; nada que lo contradiga.
 *
 * El modo discreto oculta los números a quien mira la pantalla por encima del hombro; la
 * preferencia se guarda solo en el dispositivo.
 */
export function CifraHero({
  availableMinor,
  perDayMinor,
  daysLeft,
  nextIncomeOn,
  status,
  children,
}: {
  availableMinor: number;
  perDayMinor: number;
  daysLeft: number;
  nextIncomeOn: string;
  status: 'holgado' | 'justo' | 'en_rojo';
  children?: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('cifra_privacy_mode') === 'hidden') setHidden(true);
    } catch {
      // Navegador sin almacenamiento: el modo discreto simplemente no se recuerda.
    }
  }, []);

  function toggleHidden() {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cifra_privacy_mode', next ? 'hidden' : 'visible');
      } catch {
        // Ignorar.
      }
      return next;
    });
  }

  const negative = availableMinor < 0;
  const badge = negative
    ? { cls: 'badge-neg', text: 'No alcanza: revisemos' }
    : status === 'justo'
      ? { cls: 'badge-warn', text: 'Vas justo hasta tu pago' }
      : { cls: 'badge-primary', text: 'Vas con buen margen' };
  const color = negative ? 'text-neg' : status === 'justo' ? 'text-warn' : 'text-ink';
  const dayWord = daysLeft === 1 ? 'día' : 'días';

  return (
    <section aria-labelledby="cifra-label" className="ticket-surface p-5 sm:p-7">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={badge.cls}>{badge.text}</span>
          <span className="tnum text-[12.5px] font-medium text-ink-faint">
            Próximo pago: {shortDate(nextIncomeOn)} ({daysLeft} {dayWord})
          </span>
        </div>
        <button
          id="btn-cifra-privacy-toggle"
          type="button"
          onClick={toggleHidden}
          aria-pressed={hidden}
          aria-label={hidden ? 'Mostrar mis números' : 'Ocultar mis números'}
          title={hidden ? 'Mostrar mis números' : 'Ocultar mis números'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-paper/90 text-ink-muted hover:border-ink/30 hover:text-ink"
        >
          {hidden ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
        </button>
      </div>

      <p id="cifra-label" className="mt-4 text-[15px] font-medium text-ink-muted">
        {negative ? `Te faltan para llegar al ${shortDate(nextIncomeOn)}` : `Puedes gastar hasta el ${shortDate(nextIncomeOn)}`}
      </p>
      {hidden ? (
        <p className="mt-1 select-none font-mono text-[44px] font-extrabold leading-none tracking-[0.16em] text-ink/70" aria-label="Número oculto">
          ••••••
        </p>
      ) : (
        <p data-testid="cifra" className={`tnum mt-1 font-display text-[52px] font-extrabold leading-none tracking-[-0.04em] sm:text-[62px] ${color}`}>
          {cop(Math.abs(availableMinor))}
        </p>
      )}

      {!hidden && (
        <p className="mt-3 text-[15px] leading-snug text-ink-muted">
          {negative ? (
            'Este número solo mira de aquí a tu próximo pago. Abajo ves qué cobro o qué gasto diario lo aprieta.'
          ) : (
            <>
              Son unos <span className="tnum font-semibold text-ink">{cop(perDayMinor)}</span> por día durante {daysLeft} {dayWord},
              además de tu día a día.
            </>
          )}
        </p>
      )}

      <div className="ticket-divider" />

      <div className={hidden ? 'select-none blur-sm' : undefined} aria-hidden={hidden || undefined}>
        {children}
      </div>
    </section>
  );
}
