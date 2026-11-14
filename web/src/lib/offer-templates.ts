import { cop } from '@/lib/format';

/**
 * Plantillas para la primera oferta de un negocio, según su tipo. Son un punto de partida que el
 * tendero edita antes de publicar: los porcentajes y montos son sugerencias de la plantilla, no
 * datos del negocio, y la pantalla las presenta como plantillas. Función pura, sin base de datos.
 *
 * La de "antes del cierre" solo aparece donde hay producto del día que se pierde (pan, comida,
 * fruta). A una peluquería o una papelería no se le sugiere sacar el inventario del día.
 */

export interface OfferTemplate {
  id: string;
  badge: string;
  title: string;
  description: string;
  kind: 'percent' | 'fixed';
  percent: number;
  /** Pesos enteros, como los escribe el tendero en el formulario. */
  fixedPesos: string;
  minPesos: string;
  newOnly: boolean;
  isFlash: boolean;
  startHour: string;
  endHour: string;
  stock: string;
  hours: string;
}

/** Lo que se pierde al final del día en cada tipo de negocio, para la oferta antes del cierre. */
const END_OF_DAY: Record<string, string> = {
  panaderia: 'pan y horneados de la tarde',
  cafeteria: 'onces y postres de la tarde',
  restaurante: 'el menú del día',
  fruver: 'frutas y verduras del día',
  tienda: 'productos frescos del día',
};

const pesos = (wholePesos: string) => cop(Number(wholePesos) * 100);

export function offerTemplates(category: string): OfferTemplate[] {
  const welcome: OfferTemplate = {
    id: 'bienvenida-10',
    badge: 'Recomendada · Primera visita',
    title: '10 % de descuento en tu primera compra',
    description: 'Para vecinos de la zona que todavía no conocen el negocio.',
    kind: 'percent',
    percent: 10,
    fixedPesos: '3000',
    minPesos: '12000',
    newOnly: true,
    isFlash: false,
    startHour: '14',
    endHour: '18',
    stock: '10',
    hours: '',
  };

  const endOfDayItems = Object.hasOwn(END_OF_DAY, category) ? END_OF_DAY[category] : null;
  const beforeClosing: OfferTemplate[] = endOfDayItems
    ? [
        {
          id: 'por-horas-cierre',
          badge: 'Por horas · Antes del cierre',
          title: `25 % de descuento en ${endOfDayItems}`,
          description: 'Para no perder lo que queda del día, con cupos contados.',
          kind: 'percent',
          percent: 25,
          fixedPesos: '3000',
          minPesos: '0',
          newOnly: false,
          isFlash: true,
          startHour: '16',
          endHour: '19',
          stock: '8',
          hours: '4:00 p. m. a 7:00 p. m.',
        },
      ]
    : [];

  const quietHours: OfferTemplate = {
    id: 'por-horas-tarde',
    badge: 'Por horas · Tarde tranquila',
    title: '20 % de descuento en la hora tranquila de la tarde',
    description: 'Para atraer clientes en las horas de menos movimiento.',
    kind: 'percent',
    percent: 20,
    fixedPesos: '3000',
    minPesos: '10000',
    newOnly: false,
    isFlash: true,
    startHour: '14',
    endHour: '17',
    stock: '12',
    hours: '2:00 p. m. a 5:00 p. m.',
  };

  const fixedPesos = '3000';
  const fixedMin = '20000';
  const fixed: OfferTemplate = {
    id: 'bono-fijo',
    badge: 'Monto fijo en pesos',
    title: `${pesos(fixedPesos)} de descuento por compras desde ${pesos(fixedMin)}`,
    description: 'Un descuento fijo, fácil de explicar en el mostrador.',
    kind: 'fixed',
    percent: 10,
    fixedPesos,
    minPesos: fixedMin,
    newOnly: true,
    isFlash: false,
    startHour: '14',
    endHour: '18',
    stock: '10',
    hours: '',
  };

  return [welcome, ...beforeClosing, quietHours, fixed];
}
