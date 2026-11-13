import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Embudo de la feria: de abrir la página pública (`/`) a guardar la cifra, por día de Bogotá.
 *
 * Sale solo de la tabla `events`, que ya excluye bots y nunca guarda montos. Cada fila cuenta
 * visitantes distintos (`visitor_id`) de ese día; un visitante que vuelve otro día cuenta en los dos.
 *
 * "Creían poder gastar más" usa el campo opcional "¿cuánto crees que puedes gastar?" de la prueba:
 * el evento `try_cifra_done` lleva solo la dirección de la diferencia (`mas`, `menos`, `igual` o
 * `sin` si no lo llenó), nunca el monto. Si un visitante calculó varias veces ese día, cuenta la
 * última vez.
 */
export type FairFunnelDay = {
  /** Día de Bogotá, 'YYYY-MM-DD'. */
  day: string;
  /** Abrieron la página pública `/`. */
  visitors: number;
  /** Empezaron la prueba (tocaron la primera respuesta). */
  started: number;
  /** Vieron su cifra. */
  done: number;
  /** Tocaron "Guardar mi cifra". */
  saved: number;
  /** Crearon su cuenta después de tocar "Guardar mi cifra". */
  signedUp: number;
  /** De los que llenaron el campo opcional: creían poder gastar más, menos o lo mismo. */
  guessMore: number;
  guessLess: number;
  guessSame: number;
  /** Segundos de la primera prueba del día, mediana entre visitantes. null si nadie terminó. */
  medianSeconds: number | null;
};

const DAYS_MAX = 31;

/** Los últimos `days` días de Bogotá, de hoy hacia atrás, con ceros en los días sin visitas. */
export async function loadFairFunnel(days = 7): Promise<FairFunnelDay[]> {
  const n = Math.min(Math.max(Math.trunc(days), 1), DAYS_MAX);
  const rows = (await db.execute(sql`
    with dias as (
      select generate_series(
        (now() at time zone 'America/Bogota')::date - ${n - 1}::int,
        (now() at time zone 'America/Bogota')::date,
        interval '1 day'
      )::date as day
    ),
    ev as (
      select visitor_id, at, name, path, props,
        (at at time zone 'America/Bogota')::date as day
      from events
      where name in ('page_view', 'try_cifra_start', 'try_cifra_done', 'try_cifra_save', 'sign_up')
        and at >= ((now() at time zone 'America/Bogota')::date - ${n - 1}::int)::timestamp at time zone 'America/Bogota'
    ),
    por_visitante as (
      select day, visitor_id,
        bool_or(name = 'page_view' and path = '/') as visited,
        bool_or(name = 'try_cifra_start') as started,
        bool_or(name = 'try_cifra_done') as done,
        bool_or(name = 'try_cifra_save') as saved,
        bool_or(name = 'sign_up') as signed,
        (array_agg(props->>'guess' order by at desc) filter (where name = 'try_cifra_done'))[1] as guess,
        (array_agg((props->>'seconds')::numeric order by at)
          filter (where name = 'try_cifra_done' and props->>'seconds' ~ '^[0-9]+$'))[1] as seconds
      from ev
      group by day, visitor_id
    ),
    resumen as (
      select day,
        count(*) filter (where visited) as visitors,
        count(*) filter (where started) as started,
        count(*) filter (where done) as done,
        count(*) filter (where saved) as saved,
        count(*) filter (where saved and signed) as signed_up,
        count(*) filter (where guess = 'mas') as guess_more,
        count(*) filter (where guess = 'menos') as guess_less,
        count(*) filter (where guess = 'igual') as guess_same,
        percentile_cont(0.5) within group (order by seconds) filter (where seconds is not null) as median_seconds
      from por_visitante
      group by day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
      coalesce(r.visitors, 0) as visitors,
      coalesce(r.started, 0) as started,
      coalesce(r.done, 0) as done,
      coalesce(r.saved, 0) as saved,
      coalesce(r.signed_up, 0) as signed_up,
      coalesce(r.guess_more, 0) as guess_more,
      coalesce(r.guess_less, 0) as guess_less,
      coalesce(r.guess_same, 0) as guess_same,
      r.median_seconds
    from dias d left join resumen r using (day)
    order by d.day desc
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    day: String(r.day),
    visitors: Number(r.visitors),
    started: Number(r.started),
    done: Number(r.done),
    saved: Number(r.saved),
    signedUp: Number(r.signed_up),
    guessMore: Number(r.guess_more),
    guessLess: Number(r.guess_less),
    guessSame: Number(r.guess_same),
    medianSeconds: r.median_seconds == null ? null : Math.round(Number(r.median_seconds)),
  }));
}
