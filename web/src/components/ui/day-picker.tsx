'use client';

import { CalendarDays } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { todayInBogota } from '@/lib/engine/dates';

/**
 * Elegir un día del mes en un calendario desplegable en lugar de una lista de 31 opciones.
 * El valor viaja en un campo oculto con el mismo `name` de antes, así que las acciones del
 * servidor y `parseQuickForm` reciben exactamente lo mismo. Es un día que se repite cada mes:
 * por eso el calendario muestra del 1 al 31 sin días de la semana, que cambian de un mes a otro.
 */
export function DayPicker({
  id,
  name,
  defaultValue = null,
  min = 1,
  max = 31,
  placeholder = 'Elegir día',
  ariaLabel,
  align = 'left',
  compact = false,
}: {
  id?: string;
  name: string;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  placeholder?: string;
  /** Para lectores de pantalla cuando no hay `<label htmlFor>` visible. */
  ariaLabel?: string;
  /** Hacia dónde abre el calendario: a la derecha de la caja ('left') o hacia la izquierda ('right'). */
  align?: 'left' | 'right';
  /** En renglones angostos (los cobros fijos): caja más baja y sin la nota de fin de mes. */
  compact?: boolean;
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const buttonId = id ?? `day-${autoId}`;
  const panelId = `${buttonId}-calendario`;

  useEffect(() => {
    if (!open) return;
    setToday(Number(todayInBogota().slice(8, 10)));
    const start = value ?? Math.min(max, Math.max(min, Number(todayInBogota().slice(8, 10))));
    root.current?.querySelector<HTMLButtonElement>(`[data-day="${start}"]`)?.focus();
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // Solo al abrir: el foco va al día elegido o al de hoy.
  }, [open]);

  function choose(d: number) {
    setValue(d);
    setOpen(false);
    trigger.current?.focus();
  }

  // Flechas: un día a los lados, una semana arriba o abajo, como en cualquier calendario.
  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const current = Number((document.activeElement as HTMLElement | null)?.dataset.day ?? value ?? min);
    const target = Math.min(max, Math.max(min, current + step));
    root.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus();
  }

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value ?? ''} />
      <button
        ref={trigger}
        id={buttonId}
        type="button"
        data-day-picker={name}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${value ? `día ${value}` : 'sin elegir'}` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`field flex items-center justify-between gap-2 text-left ${compact ? 'py-2.5' : ''} ${value ? 'text-ink' : 'text-ink-faint'}`}
      >
        <span className="tnum truncate">{value ? `Día ${value}` : placeholder}</span>
        <CalendarDays size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
      {!compact && !open && value !== null && value >= 29 && (
        <p className="mt-1.5 text-[12.5px] text-ink-faint">En los meses más cortos cuenta el último día.</p>
      )}

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={ariaLabel ?? 'Elegir el día del mes'}
          data-day-panel={name}
          className={`absolute z-40 mt-2 w-[18.5rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-3.5 shadow-[0_12px_32px_rgba(16,29,26,0.16)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="mb-2.5 text-[13px] font-semibold text-ink">Día del mes</p>
          <div role="group" aria-label="Días del 1 al 31" className="grid grid-cols-7 gap-1" onKeyDown={onGridKey}>
            {days.map((d) => {
              const disabled = d < min || d > max;
              const selected = d === value;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  data-day={d}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`Día ${d}${isToday ? ', hoy' : ''}`}
                  onClick={() => choose(d)}
                  className={`tnum relative flex h-9 items-center justify-center rounded-lg text-[14.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    selected
                      ? 'bg-primary font-semibold text-white'
                      : disabled
                        ? 'cursor-not-allowed text-ink-faint/50'
                        : 'text-ink hover:bg-primary-light'
                  } ${isToday && !selected ? 'ring-1 ring-inset ring-primary/40' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12px] leading-snug text-ink-muted">
            {today !== null && <>El marco señala hoy ({today}). </>}
            Si el mes no tiene ese día, cuenta el último.
          </p>
        </div>
      )}
    </div>
  );
}

const WEEKDAYS: Array<[string, string]> = [
  ['Lun', 'Lunes'],
  ['Mar', 'Martes'],
  ['Mié', 'Miércoles'],
  ['Jue', 'Jueves'],
  ['Vie', 'Viernes'],
  ['Sáb', 'Sábado'],
  ['Dom', 'Domingo'],
];

/** El día de la semana como una fila de calendario (Lun a Dom) en lugar de una lista. Valor ISO: 1 = lunes. */
export function WeekdayPicker({ name, defaultValue = 5, legend }: { name: string; defaultValue?: number; legend: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-7 gap-1.5" data-weekday-picker={name}>
        {WEEKDAYS.map(([short, long], i) => {
          const selected = value === i + 1;
          return (
            <button
              key={short}
              type="button"
              aria-pressed={selected}
              aria-label={long}
              data-weekday={i + 1}
              onClick={() => setValue(i + 1)}
              className={`rounded-xl border py-2.5 text-[13.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                selected ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:border-line-strong'
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
